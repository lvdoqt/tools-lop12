"""Parse ex_test exercises without evaluating user supplied TeX."""

import re
from html import escape


def strip_comments(source):
    return re.sub(r"(?<!\\)((?:\\\\)*)%[^\n]*", r"\1", source)


def group(source, start, opening="{", closing="}"):
    while start < len(source) and source[start].isspace():
        start += 1
    if start >= len(source) or source[start] != opening:
        raise ValueError(f"Thiếu {opening} gần: {source[start:start + 50]}")
    depth, pos = 1, start + 1
    while pos < len(source):
        if source[pos] == "\\":
            pos += 2
            continue
        if source[pos] == opening:
            depth += 1
        elif source[pos] == closing:
            depth -= 1
            if depth == 0:
                return source[start + 1:pos], pos + 1
        pos += 1
    raise ValueError(f"Thiếu dấu đóng {closing}.")


def optional(source, pos):
    while pos < len(source) and source[pos].isspace():
        pos += 1
    if pos < len(source) and source[pos] == "[":
        _, pos = group(source, pos, "[", "]")
    return pos


def flatten_immini(source):
    # Place the illustration before a choice embedded in the first argument.
    pattern = re.compile(r"\\immini\b\*?")
    while match := pattern.search(source):
        pos = optional(source, match.end())
        body, pos = group(source, pos)
        picture, end = group(source, pos)
        body = flatten_immini(body)
        choice = re.search(r"\\(?:choiceTFt?|choice|shortans)\b", body)
        cut = choice.start() if choice else len(body)
        source = source[:match.start()] + body[:cut] + "\n" + picture + "\n" + body[cut:] + source[end:]
    return source


def clean_text(source):
    # Preserve all math, including nested braces and line breaks in aligned/cases.
    math = []
    def protect(match):
        math.append(match.group())
        return f"\x00M{len(math) - 1}\x00"
    source = re.sub(r"(?s)\$\$.*?\$\$|(?<!\\)\$(?:\\.|[^$])*?\$|\\\[.*?\\\]|\\\(.*?\\\)", protect, source)
    source = re.sub(r"\\(?:begin|end)\{(?:center|flushleft|flushright|itemchoice|itemize|enumerate)\}(?:\[[^\]]*\])?", "\n", source)
    source = re.sub(r"\\item(?:ch)?\b(?:\[[^\]]*\])?", "\n- ", source)
    source = re.sub(r"\\(?:par|noindent|smallskip|medskip|bigskip)\b", "\n", source)
    source = source.replace("\\\\", "\n")
    source = re.sub(r"\\(?:textbf|textit|emph)\s*\{([^{}]*)\}", r"\1", source)
    source = re.sub(r"[ \t]+", " ", source)
    source = re.sub(r" *\n *", "\n", source)
    source = re.sub(r"\n{3,}", "\n\n", source).strip()
    return re.sub(r"\x00M(\d+)\x00", lambda m: math[int(m[1])], source)


def table_html(source):
    match = re.match(r"\\begin\{tabular\}(?:\[[^\]]*\])?", source)
    _, pos = group(source, match.end())
    body = source[pos:source.rfind(r"\end{tabular}")]
    body = re.sub(r"\\(?:hline|toprule|midrule|bottomrule)\b", "", body)
    rows = []
    for row in re.split(r"\\\\", body):
        if row.strip():
            cells = re.split(r"(?<!\\)&", row)
            rows.append([escape(clean_text(cell)) for cell in cells])
    if not rows or any(len(row) != len(rows[0]) for row in rows):
        raise ValueError("Bảng tabular có số cột không đều hoặc cấu trúc chưa hỗ trợ.")
    if re.search(r"\\(?:multicolumn|multirow|cline)\b", body):
        raise ValueError("Bảng gộp ô chưa được hỗ trợ. Hãy đổi thành bảng đơn giản.")
    return "\n\n<table>" + "".join("<tr>" + "".join(f"<td>{cell}</td>" for cell in row) + "</tr>" for row in rows) + "</table>\n\n"


def parse_quiz(source, title="Toán 12", difficulty="easy"):
    source = strip_comments(source.lstrip("\ufeff"))
    blocks, stack, start = [], [], 0
    for match in re.finditer(r"\\(begin|end)\s*\{ex\}", source):
        if match[1] == "begin":
            if stack:
                raise ValueError("Môi trường ex bị lồng nhau hoặc thiếu end{ex}.")
            stack.append(match.start())
            start = optional(source, match.end())
        else:
            if not stack:
                raise ValueError("Có end{ex} nhưng thiếu begin{ex}.")
            stack.pop()
            blocks.append(source[start:match.start()])
    if stack:
        raise ValueError("Thiếu end{ex} ở câu cuối.")
    if not blocks:
        raise ValueError("Không tìm thấy câu hỏi trong môi trường \\begin{ex} ... \\end{ex}.")
    if len(blocks) > 300:
        raise ValueError("Mỗi lần hỗ trợ tối đa 300 câu.")
    questions, diagrams, warnings = [], [], []
    for number, block in enumerate(blocks, 1):
        try:
            block = flatten_immini(block)
            def diagram(match):
                identifier = f"tikz-{len(diagrams) + 1}"
                diagrams.append({"id": identifier, "question_number": number, "source": match.group(), "token": f"@@{identifier}@@"})
                return f"\n\n@@{identifier}@@\n\n"
            block = re.sub(r"(?s)\\begin\{tikzpicture\}.*?\\end\{tikzpicture\}", diagram, block)
            if r"\begin{tikzpicture}" in block or r"\end{tikzpicture}" in block:
                raise ValueError("Hình TikZ thiếu begin hoặc end.")
            block = re.sub(r"(?s)\\begin\{tabular\}.*?\\end\{tabular\}", lambda m: table_html(m.group()), block)
            solution = re.search(r"\\loigiai\b", block)
            explanation = ""
            if solution:
                explanation, end = group(block, solution.end())
                if block[end:].strip():
                    raise ValueError("Có nội dung ngoài loigiai chưa xác định được vị trí.")
                block = block[:solution.start()]
            else:
                warnings.append(f"Câu {number}: chưa có lời giải.")
            match = re.search(r"\\(choiceTFt?|choice|shortans)\b", block)
            if not match:
                raise ValueError("Thiếu choice, choiceTF hoặc shortans.")
            question = {"type": "sa" if match[1] == "shortans" else "mcq" if match[1] == "choice" else "msq", "question": clean_text(block[:match.start()])}
            pos = optional(block, match.end())
            if question["type"] == "sa":
                answer, pos = group(block, pos)
                answer = answer.strip().strip("$").replace("{,}", ",").strip()
                if not answer:
                    raise ValueError("Đáp án trả lời ngắn đang trống.")
                question["correct_option"] = answer
            else:
                correct = []
                for letter in "ABCD":
                    option, pos = group(block, pos)
                    if re.search(r"\\True\b", option):
                        correct.append(letter)
                    option = clean_text(re.sub(r"\\True\b", "", option))
                    if not option:
                        raise ValueError(f"Phương án {letter} đang trống.")
                    question[f"option_{letter.lower()}"] = option
                if question["type"] == "mcq" and len(correct) != 1:
                    raise ValueError("Trắc nghiệm phải có đúng một phương án đánh dấu \\True.")
                question["correct_option"] = ",".join(correct)
            if block[pos:].strip():
                raise ValueError("Có nội dung thừa sau đáp án; hãy kiểm tra cấu trúc câu.")
            if not question["question"]:
                raise ValueError("Nội dung câu hỏi đang trống.")
            question.update(explanation=clean_text(explanation), difficulty_level=difficulty, is_dynamic=False)
            unsupported = re.findall(r"\\(?:includegraphics|input|begin\{(?:tabular|tabularx|longtable))", str(question))
            if unsupported:
                raise ValueError("Có ảnh ngoài hoặc bảng chưa hỗ trợ; hãy nhúng TikZ/bảng tabular đơn giản.")
            questions.append(question)
        except ValueError as exc:
            raise ValueError(f"Câu {number}: {exc}") from exc
    return {"quiz": {"title": title.strip() or "Toán 12", "questions": questions}, "diagrams": diagrams, "warnings": warnings}
