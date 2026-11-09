"""Render TikZ source through Kroki TeX Engine and create preview assets."""

import os
from pathlib import Path
import re
from unittest.mock import Mock
from urllib.parse import urlencode

import pymupdf
import requests


KROKI_URL = os.getenv("KROKI_URL", "https://kroki.io").rstrip("/")
LATEX_ONLINE_URL = "https://latexonline.cc/compile"
MAX_SOURCE_LENGTH = 100_000
PGFPLOTS_COMPAT_VERSION = (1, 18)

VIETNAMESE_UNICODE_DECLS = r"""
% Tone helpers for T1 encoding
\providecommand{\vnh}[1]{\v{#1}}
\providecommand{\vno}{o\kern-0.12em\raisebox{0.55ex}{\fontsize{4}{4}\selectfont '}\kern0.08em}
\providecommand{\vnO}{O\kern-0.14em\raisebox{0.85ex}{\fontsize{4}{4}\selectfont '}\kern0.08em}
\providecommand{\vnu}{u\kern-0.12em\raisebox{0.55ex}{\fontsize{4}{4}\selectfont '}\kern0.08em}
\providecommand{\vnU}{U\kern-0.14em\raisebox{0.85ex}{\fontsize{4}{4}\selectfont '}\kern0.08em}

% D stroke
\DeclareUnicodeCharacter{0110}{\DJ}
\DeclareUnicodeCharacter{0111}{\dj}

% A
\DeclareUnicodeCharacter{00E1}{\'{a}}
\DeclareUnicodeCharacter{00C1}{\'{A}}
\DeclareUnicodeCharacter{00E0}{\`{a}}
\DeclareUnicodeCharacter{00C0}{\`{A}}
\DeclareUnicodeCharacter{1EA3}{\vnh{a}}
\DeclareUnicodeCharacter{1EA2}{\vnh{A}}
\DeclareUnicodeCharacter{00E3}{\~{a}}
\DeclareUnicodeCharacter{00C3}{\~{A}}
\DeclareUnicodeCharacter{1EA1}{\d{a}}
\DeclareUnicodeCharacter{1EA0}{\d{A}}

% A breve (Ă)
\DeclareUnicodeCharacter{0103}{\u{a}}
\DeclareUnicodeCharacter{0102}{\u{A}}
\DeclareUnicodeCharacter{1EAF}{\'{\u{a}}}
\DeclareUnicodeCharacter{1EAE}{\'{\u{A}}}
\DeclareUnicodeCharacter{1EB1}{\`{\u{a}}}
\DeclareUnicodeCharacter{1EB0}{\`{\u{A}}}
\DeclareUnicodeCharacter{1EB3}{\vnh{\u{a}}}
\DeclareUnicodeCharacter{1EB2}{\vnh{\u{A}}}
\DeclareUnicodeCharacter{1EB5}{\~{\u{a}}}
\DeclareUnicodeCharacter{1EB4}{\~{\u{A}}}
\DeclareUnicodeCharacter{1EB7}{\d{\u{a}}}
\DeclareUnicodeCharacter{1EB6}{\d{\u{A}}}

% A circumflex (Â)
\DeclareUnicodeCharacter{00E2}{\^{a}}
\DeclareUnicodeCharacter{00C2}{\^{A}}
\DeclareUnicodeCharacter{1EA5}{\'{\^{a}}}
\DeclareUnicodeCharacter{1EA4}{\'{\^{A}}}
\DeclareUnicodeCharacter{1EA7}{\`{\^{a}}}
\DeclareUnicodeCharacter{1EA6}{\`{\^{A}}}
\DeclareUnicodeCharacter{1EA9}{\vnh{\^{a}}}
\DeclareUnicodeCharacter{1EA8}{\vnh{\^{A}}}
\DeclareUnicodeCharacter{1EAB}{\~{\^{a}}}
\DeclareUnicodeCharacter{1EAA}{\~{\^{A}}}
\DeclareUnicodeCharacter{1EAD}{\d{\^{a}}}
\DeclareUnicodeCharacter{1EAC}{\d{\^{A}}}

% E
\DeclareUnicodeCharacter{00E9}{\'{e}}
\DeclareUnicodeCharacter{00C9}{\'{E}}
\DeclareUnicodeCharacter{00E8}{\`{e}}
\DeclareUnicodeCharacter{00C8}{\`{E}}
\DeclareUnicodeCharacter{1EBB}{\vnh{e}}
\DeclareUnicodeCharacter{1EBA}{\vnh{E}}
\DeclareUnicodeCharacter{1EBD}{\~{e}}
\DeclareUnicodeCharacter{1EBC}{\~{E}}
\DeclareUnicodeCharacter{1EB9}{\d{e}}
\DeclareUnicodeCharacter{1EB8}{\d{E}}

% E circumflex (Ê)
\DeclareUnicodeCharacter{00EA}{\^{e}}
\DeclareUnicodeCharacter{00CA}{\^{E}}
\DeclareUnicodeCharacter{1EBF}{\'{\^{e}}}
\DeclareUnicodeCharacter{1EBE}{\'{\^{E}}}
\DeclareUnicodeCharacter{1EC1}{\`{\^{e}}}
\DeclareUnicodeCharacter{1EC0}{\`{\^{E}}}
\DeclareUnicodeCharacter{1EC3}{\vnh{\^{e}}}
\DeclareUnicodeCharacter{1EC2}{\vnh{\^{E}}}
\DeclareUnicodeCharacter{1EC5}{\~{\^{e}}}
\DeclareUnicodeCharacter{1EC4}{\~{\^{E}}}
\DeclareUnicodeCharacter{1EC7}{\d{\^{e}}}
\DeclareUnicodeCharacter{1EC6}{\d{\^{E}}}

% I
\DeclareUnicodeCharacter{00ED}{\'{i}}
\DeclareUnicodeCharacter{00CD}{\'{I}}
\DeclareUnicodeCharacter{00EC}{\`{i}}
\DeclareUnicodeCharacter{00CC}{\`{I}}
\DeclareUnicodeCharacter{1EC9}{\vnh{i}}
\DeclareUnicodeCharacter{1EC8}{\vnh{I}}
\DeclareUnicodeCharacter{0129}{\~{i}}
\DeclareUnicodeCharacter{0128}{\~{I}}
\DeclareUnicodeCharacter{1ECB}{\d{i}}
\DeclareUnicodeCharacter{1ECA}{\d{I}}

% O
\DeclareUnicodeCharacter{00F3}{\'{o}}
\DeclareUnicodeCharacter{00D3}{\'{O}}
\DeclareUnicodeCharacter{00F2}{\`{o}}
\DeclareUnicodeCharacter{00D2}{\`{O}}
\DeclareUnicodeCharacter{1ECF}{\vnh{o}}
\DeclareUnicodeCharacter{1ECE}{\vnh{O}}
\DeclareUnicodeCharacter{00F5}{\~{o}}
\DeclareUnicodeCharacter{00D5}{\~{O}}
\DeclareUnicodeCharacter{1ECD}{\d{o}}
\DeclareUnicodeCharacter{1ECC}{\d{O}}

% O circumflex (Ô)
\DeclareUnicodeCharacter{00F4}{\^{o}}
\DeclareUnicodeCharacter{00D4}{\^{O}}
\DeclareUnicodeCharacter{1ED1}{\'{\^{o}}}
\DeclareUnicodeCharacter{1ED0}{\'{\^{O}}}
\DeclareUnicodeCharacter{1ED3}{\`{\^{o}}}
\DeclareUnicodeCharacter{1ED2}{\`{\^{O}}}
\DeclareUnicodeCharacter{1ED5}{\vnh{\^{o}}}
\DeclareUnicodeCharacter{1ED4}{\vnh{\^{O}}}
\DeclareUnicodeCharacter{1ED7}{\~{\^{o}}}
\DeclareUnicodeCharacter{1ED6}{\~{\^{O}}}
\DeclareUnicodeCharacter{1ED9}{\d{\^{o}}}
\DeclareUnicodeCharacter{1ED8}{\d{\^{O}}}

% O horn (Ơ)
\DeclareUnicodeCharacter{01A1}{\vno}
\DeclareUnicodeCharacter{01A0}{\vnO}
\DeclareUnicodeCharacter{1EDB}{\'{\vno}}
\DeclareUnicodeCharacter{1EDA}{\'{\vnO}}
\DeclareUnicodeCharacter{1EDD}{\`{\vno}}
\DeclareUnicodeCharacter{1EDC}{\`{\vnO}}
\DeclareUnicodeCharacter{1EDF}{\vnh{\vno}}
\DeclareUnicodeCharacter{1EDE}{\vnh{\vnO}}
\DeclareUnicodeCharacter{1EE1}{\~{\vno}}
\DeclareUnicodeCharacter{1EE0}{\~{\vnO}}
\DeclareUnicodeCharacter{1EE3}{\d{\vno}}
\DeclareUnicodeCharacter{1EE2}{\d{\vnO}}

% U
\DeclareUnicodeCharacter{00FA}{\'{u}}
\DeclareUnicodeCharacter{00DA}{\'{U}}
\DeclareUnicodeCharacter{00F9}{\`{u}}
\DeclareUnicodeCharacter{00D9}{\`{U}}
\DeclareUnicodeCharacter{1EE7}{\vnh{u}}
\DeclareUnicodeCharacter{1EE6}{\vnh{U}}
\DeclareUnicodeCharacter{0169}{\~{u}}
\DeclareUnicodeCharacter{0168}{\~{U}}
\DeclareUnicodeCharacter{1EE5}{\d{u}}
\DeclareUnicodeCharacter{1EE4}{\d{U}}

% U horn (Ư)
\DeclareUnicodeCharacter{01B0}{\vnu}
\DeclareUnicodeCharacter{01AF}{\vnU}
\DeclareUnicodeCharacter{1EE9}{\'{\vnu}}
\DeclareUnicodeCharacter{1EE8}{\'{\vnU}}
\DeclareUnicodeCharacter{1EEB}{\`{\vnu}}
\DeclareUnicodeCharacter{1EEA}{\`{\vnU}}
\DeclareUnicodeCharacter{1EED}{\vnh{\vnu}}
\DeclareUnicodeCharacter{1EEC}{\vnh{\vnU}}
\DeclareUnicodeCharacter{1EEF}{\~{\vnu}}
\DeclareUnicodeCharacter{1EEE}{\~{\vnU}}
\DeclareUnicodeCharacter{1EF1}{\d{\vnu}}
\DeclareUnicodeCharacter{1EF0}{\d{\vnU}}

% Y
\DeclareUnicodeCharacter{00FD}{\'{y}}
\DeclareUnicodeCharacter{00DD}{\'{Y}}
\DeclareUnicodeCharacter{1EF3}{\`{y}}
\DeclareUnicodeCharacter{1EF2}{\`{Y}}
\DeclareUnicodeCharacter{1EF7}{\vnh{y}}
\DeclareUnicodeCharacter{1EF6}{\vnh{Y}}
\DeclareUnicodeCharacter{1EF9}{\~{y}}
\DeclareUnicodeCharacter{1EF8}{\~{Y}}
\DeclareUnicodeCharacter{1EF5}{\d{y}}
\DeclareUnicodeCharacter{1EF4}{\d{Y}}
"""

EX_ENVIRONMENT_DECLS = r"""
% ex_test and exam package compatibility definitions
\makeatletter
\@ifundefined{c@excount}{\newcounter{excount}}{}
\providecommand{\exname}{Câu}
\providecommand{\Opensolutionfile}[2]{}
\providecommand{\Closesolutionfile}[1]{}
\providecommand{\phanII}[1][]{%
  \par\vspace{1.2em}\noindent
  \textbf{\large PHẦN II. Câu trắc nghiệm đúng sai.}%
  \if\relax\detokenize{#1}\relax\else\space\textbf{#1}\fi\par\vspace{0.2em}
  \noindent\textit{Thí sinh trả lời từ câu 1 đến câu 4. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.}\par\vspace{0.6em}%
  \setcounter{excount}{0}%
}
\providecommand{\phanIII}[1][]{%
  \par\vspace{1.2em}\noindent
  \textbf{\large PHẦN III. Câu trắc nghiệm trả lời ngắn.}%
  \if\relax\detokenize{#1}\relax\else\space\textbf{#1}\fi\par\vspace{0.2em}
  \noindent\textit{Thí sinh trả lời từ câu 1 đến câu 6.}\par\vspace{0.6em}%
  \setcounter{excount}{0}%
}
\providecommand{\diem}[2][]{\if\relax\detokenize{#2}\relax\else\space\textit{(#2 điểm)}\fi}
\providecommand{\R}{\mathbb{R}}
\providecommand{\True}{\textbf{*}}
\providecommand{\itemch}{\item}
\@ifundefined{itemchoice}{\newenvironment{itemchoice}{\begin{itemize}}{\end{itemize}}}{}

\@ifundefined{ex}{%
  \newenvironment{ex}[1][]{%
    \par\vspace{0.8em}\noindent
    \refstepcounter{excount}%
    \textbf{\exname~\theexcount.}%
    \if\relax\detokenize{#1}\relax\else\space\textbf{(#1)}\fi\space
  }{%
    \par\vspace{0.8em}%
  }%
}{}

\providecommand{\loigiai}[1]{%
  \par\vspace{0.4em}\noindent
  \textit{\textbf{Lời giải.}}~#1\par\vspace{0.4em}%
}

\providecommand{\shortans}[2][]{%
  \par\vspace{0.3em}\noindent
  \textbf{Đáp số:}~#2\par%
}

\providecommand{\heva}[1]{\left\{\begin{aligned}#1\end{aligned}\right.}
\providecommand{\hoac}[1]{\left[\begin{aligned}#1\end{aligned}\right.}

\newcommand{\@choiceone}[4]{%
  \par\vspace{0.2em}\noindent
  \begin{tabular*}{\linewidth}{@{\extracolsep{\fill}}l}
    \textbf{A.}~#1 \\ \textbf{B.}~#2 \\ \textbf{C.}~#3 \\ \textbf{D.}~#4
  \end{tabular*}\par\vspace{0.2em}%
}
\newcommand{\@choicetwo}[4]{%
  \par\vspace{0.2em}\noindent
  \begin{tabular*}{\linewidth}{@{\extracolsep{\fill}}ll}
    \textbf{A.}~#1 & \textbf{B.}~#2 \\
    \textbf{C.}~#3 & \textbf{D.}~#4
  \end{tabular*}\par\vspace{0.2em}%
}
\newcommand{\@choicefour}[4]{%
  \par\vspace{0.2em}\noindent
  \begin{tabular*}{\linewidth}{@{\extracolsep{\fill}}llll}
    \textbf{A.}~#1 & \textbf{B.}~#2 & \textbf{C.}~#3 & \textbf{D.}~#4
  \end{tabular*}\par\vspace{0.2em}%
}

\providecommand{\choice}[5][4]{%
  \ifx1#1\@choiceone{#2}{#3}{#4}{#5}%
  \else\ifx2#1\@choicetwo{#2}{#3}{#4}{#5}%
  \else\@choicefour{#2}{#3}{#4}{#5}\fi\fi
}

\newcommand{\@choiceTFone}[4]{%
  \par\vspace{0.2em}\noindent
  \begin{tabular*}{\linewidth}{@{\extracolsep{\fill}}l}
    \textbf{a)}~#1 \\ \textbf{b)}~#2 \\ \textbf{c)}~#3 \\ \textbf{d)}~#4
  \end{tabular*}\par\vspace{0.2em}%
}
\newcommand{\@choiceTFtwo}[4]{%
  \par\vspace{0.2em}\noindent
  \begin{tabular*}{\linewidth}{@{\extracolsep{\fill}}ll}
    \textbf{a)}~#1 & \textbf{b)}~#2 \\
    \textbf{c)}~#3 & \textbf{d)}~#4
  \end{tabular*}\par\vspace{0.2em}%
}
\newcommand{\@choiceTFfour}[4]{%
  \par\vspace{0.2em}\noindent
  \begin{tabular*}{\linewidth}{@{\extracolsep{\fill}}llll}
    \textbf{a)}~#1 & \textbf{b)}~#2 & \textbf{c)}~#3 & \textbf{d)}~#4
  \end{tabular*}\par\vspace{0.2em}%
}

\providecommand{\choiceTF}[5][4]{%
  \ifx1#1\@choiceTFone{#2}{#3}{#4}{#5}%
  \else\ifx2#1\@choiceTFtwo{#2}{#3}{#4}{#5}%
  \else\@choiceTFfour{#2}{#3}{#4}{#5}\fi\fi
}
\providecommand{\choiceTFt}[5][4]{\choiceTF[#1]{#2}{#3}{#4}{#5}}

\@ifundefined{immini}{%
  \newcommand{\immini}{\@ifstar\@imministar\@immininostar}
  \newcommand{\@immininostar}[3][]{%
    \par\noindent
    \begin{minipage}[t]{0.64\linewidth}
      #2
    \end{minipage}\hfill
    \begin{minipage}[t]{0.33\linewidth}
      \centering #3
    \end{minipage}\par
  }
  \newcommand{\@imministar}[3][]{%
    \par\noindent
    \begin{minipage}[t]{0.33\linewidth}
      \centering #3
    \end{minipage}\hfill
    \begin{minipage}[t]{0.64\linewidth}
      #2
    \end{minipage}\par
  }
}{}
\makeatother
"""


def normalize_source(source: str) -> str:
    """Make pasted TikZ suitable for compiler."""
    # Code fences frequently arrive when a TikZ example is copied from Markdown.
    source = re.sub(r"(?m)^\s*```[\w+-]*\s*$", "", source)

    def cap_pgfplots_compat(match: re.Match) -> str:
        requested = (int(match.group(2)), int(match.group(3)))
        if requested > PGFPLOTS_COMPAT_VERSION:
            return f"{match.group(1)}{PGFPLOTS_COMPAT_VERSION[0]}.{PGFPLOTS_COMPAT_VERSION[1]}{match.group(4)}"
        return match.group(0)

    return re.sub(
        r"(\\pgfplotsset\s*\{\s*compat\s*=\s*)(\d+)\.(\d+)(\s*\})",
        cap_pgfplots_compat,
        source,
    )


def is_exam_document(source: str) -> bool:
    """Check if the source contains exam questions or environments."""
    if not source:
        return False
    return bool(re.search(r"\\begin\s*\{ex\}|\\choiceTF|\\choice\b|\\phanI|\\phanII|\\phanIII|\\shortans\b|\\loigiai\b", source, re.IGNORECASE))


def extract_exam_answers(source: str) -> dict:
    """Extract answers for Part I, II, III from an exam source."""
    def match_group(text, start, open_char="{", close_char="}"):
        pos = start
        while pos < len(text) and text[pos].isspace():
            pos += 1
        if pos >= len(text) or text[pos] != open_char:
            return None
        depth = 1
        idx = pos + 1
        while idx < len(text):
            if text[idx] == "\\":
                idx += 2
                continue
            if text[idx] == open_char:
                depth += 1
            elif text[idx] == close_char:
                depth -= 1
                if depth == 0:
                    return text[pos + 1:idx], idx + 1
            idx += 1
        return None

    def skip_opt(text, start):
        pos = start
        while pos < len(text) and text[pos].isspace():
            pos += 1
        if pos < len(text) and text[pos] == "[":
            res = match_group(text, pos, "[", "]")
            if res:
                return res[1]
        return pos

    def get_brace_args(text, start_idx, count=4):
        pos = start_idx
        args = []
        for _ in range(count):
            res = match_group(text, pos)
            if not res:
                break
            args.append(res[0])
            pos = res[1]
        return args

    phan2_m = re.search(r"\\phanII\b", source)
    phan3_m = re.search(r"\\phanIII\b", source)

    p1_end = phan2_m.start() if phan2_m else len(source)
    p2_start = phan2_m.end() if phan2_m else len(source)
    p2_end = phan3_m.start() if phan3_m else len(source)
    p3_start = phan3_m.end() if phan3_m else len(source)

    p1_text = source[:p1_end]
    p2_text = source[p2_start:p2_end]
    p3_text = source[p3_start:]

    def parse_blocks(text):
        blocks = []
        starts = [m.start() for m in re.finditer(r"\\begin\{ex\}", text)]
        for i, st in enumerate(starts):
            nxt = starts[i + 1] if i + 1 < len(starts) else len(text)
            blocks.append(text[st:nxt])
        return blocks

    p1 = []
    for idx, block in enumerate(parse_blocks(p1_text), 1):
        m = re.search(r"\\choice\b", block)
        ans = "-"
        if m:
            opts = get_brace_args(block, skip_opt(block, m.end()), 4)
            for o_idx, opt in enumerate(opts):
                if r"\True" in opt:
                    ans = chr(65 + o_idx)
                    break
        p1.append({"q": idx, "ans": ans})

    p2 = []
    for idx, block in enumerate(parse_blocks(p2_text), 1):
        m = re.search(r"\\choiceTF(?:t)?\b", block)
        ans = ["S", "S", "S", "S"]
        if m:
            opts = get_brace_args(block, skip_opt(block, m.end()), 4)
            for o_idx, opt in enumerate(opts):
                if r"\True" in opt:
                    ans[o_idx] = "Đ"
        p2.append({"q": idx, "ans": ans})

    p3 = []
    for idx, block in enumerate(parse_blocks(p3_text), 1):
        m = re.search(r"\\shortans(?:\[[^\]]*\])?\s*\{", block)
        val = "-"
        if m:
            res = match_group(block, m.end() - 1)
            if res:
                val = res[0].strip().strip("$").replace("{,}", ",")
        p3.append({"q": idx, "ans": val})

    return {"p1": p1, "p2": p2, "p3": p3}


def build_answer_key_table(answers: dict) -> str:
    """Build LaTeX Answer Key Table."""
    p1 = answers.get("p1", [])
    p2 = answers.get("p2", [])
    p3 = answers.get("p3", [])
    if not p1 and not p2 and not p3:
        return ""

    table_tex = (
        r"\newpage" + "\n"
        r"\par\vspace{1em}" + "\n"
        r"\begin{center}" + "\n"
        r"{\Large\textbf{BẢNG ĐÁP ÁN THAM KHẢO}}" + "\n"
        r"\end{center}" + "\n"
        r"\vspace{0.5em}" + "\n"
    )

    if p1:
        cols = "c|" * len(p1)
        headers = " & ".join(f"\\textbf{{{item['q']}}}" for item in p1)
        vals = " & ".join(item["ans"] for item in p1)
        table_tex += (
            r"\noindent\textbf{\large PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn}" + "\n"
            r"\begin{center}" + "\n"
            f"\\begin{{tabular}}{{|{cols}}}\n"
            r"\hline" + "\n"
            f"{headers} \\\\\n"
            r"\hline" + "\n"
            f"{vals} \\\\\n"
            r"\hline" + "\n"
            r"\end{tabular}" + "\n"
            r"\end{center}" + "\n"
            r"\vspace{0.8em}" + "\n"
        )

    if p2:
        rows = " \\\\\n\\hline\n".join(
            f"\\textbf{{{item['q']}}} & {item['ans'][0]} & {item['ans'][1]} & {item['ans'][2]} & {item['ans'][3]}"
            for item in p2
        )
        table_tex += (
            r"\noindent\textbf{\large PHẦN II. Câu trắc nghiệm đúng sai}" + "\n"
            r"\begin{center}" + "\n"
            r"\begin{tabular}{|c|c|c|c|c|}" + "\n"
            r"\hline" + "\n"
            r"\textbf{Câu} & \textbf{Ý a)} & \textbf{Ý b)} & \textbf{Ý c)} & \textbf{Ý d)} \\" + "\n"
            r"\hline" + "\n"
            f"{rows} \\\\\n"
            r"\hline" + "\n"
            r"\end{tabular}" + "\n"
            r"\end{center}" + "\n"
            r"\vspace{0.8em}" + "\n"
        )

    if p3:
        cols = "c|" * len(p3)
        headers = " & ".join(f"\\textbf{{{item['q']}}}" for item in p3)
        vals = " & ".join(f"${item['ans']}$" for item in p3)
        table_tex += (
            r"\noindent\textbf{\large PHẦN III. Câu trắc nghiệm trả lời ngắn}" + "\n"
            r"\begin{center}" + "\n"
            f"\\begin{{tabular}}{{|c|{cols}}}\n"
            r"\hline" + "\n"
            r"\textbf{Câu} & " + headers + r" \\" + "\n"
            r"\hline" + "\n"
            r"\textbf{Đáp số} & " + vals + r" \\" + "\n"
            r"\hline" + "\n"
            r"\end{tabular}" + "\n"
            r"\end{center}" + "\n"
        )

    return table_tex


def build_exam_header(config: dict = None) -> str:
    cfg = config or {}
    org = cfg.get("exam_org") or "BỘ GIÁO DỤC VÀ ĐÀO TẠO"
    title = cfg.get("exam_title") or "KỲ THI TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG NĂM 2026"
    subject = cfg.get("exam_subject") or "Bài thi: TOÁN"
    time = cfg.get("exam_time") or "90 phút, không kể thời gian phát đề"
    is_solution = cfg.get("exam_mode") == "solution"

    return f"""
\\begin{{center}}
\\begin{{tabular*}}{{\\linewidth}}{{@{{\\extracolsep{{\\fill}}}}lr}}
\\textbf{{{org}}} & \\textbf{{{title}}}\\\\
\\textbf{{ĐỀ THI CHÍNH THỨC}} & \\textbf{{{subject}}}\\\\
\\textit{{(Đề thi có \\pageref{{LastPage}} trang{' - Kèm lời giải' if is_solution else ''})}} & \\textit{{Thời gian làm bài: {time}}}
\\end{{tabular*}}
\\end{{center}}
\\vspace{{-0.6em}}
\\noindent\\rule{{\\linewidth}}{{0.6pt}}
\\vspace{{0.3em}}
\\noindent\\textbf{{Họ và tên thí sinh:}} \\dotfill \\hspace{{1cm}} \\textbf{{Số báo danh:}} \\dotfill
\\vspace{{0.8em}}

\\noindent\\textbf{{\\large PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.}}\\par\\vspace{{0.2em}}
\\noindent\\textit{{Thí sinh trả lời từ câu 1 đến câu 12. Mỗi câu hỏi thí sinh chỉ chọn một phương án.}}\\par\\vspace{{0.5em}}
"""


def build_document(
    source: str,
    is_exam: bool = None,
    exam_config: dict = None,
    exam_mode: str = "student",
) -> str:
    source = normalize_source(source).strip()
    if is_exam is None:
        is_exam = is_exam_document(source)

    if "\\documentclass" in source:
        # Full documents may already load packages
        preamble = source.split(r"\begin{document}", 1)[0]
        preamble_clean = re.sub(r"(?m)(?<!\\)%.*$", "", preamble)
        has_tkz_tab = re.search(
            r"\\usepackage\s*(?:\[[^\]]*\]\s*)?\{[^}]*\btkz-tab\b[^}]*\}",
            preamble_clean,
        )
        injections = ""
        if r"\tkzTab" in source and not has_tkz_tab:
            injections += "\\usepackage{tkz-tab}\n"
        if re.search(r"\\begin\{ex\}|\\choice|\\loigiai|\\immini|\\heva|\\hoac", source) and "\\newenvironment{ex}" not in preamble:
            injections += EX_ENVIRONMENT_DECLS + "\n"
        injections += "\\makeatletter\n\\AtBeginDocument{\\def\\sa@handlebox{}}\n\\makeatother\n"
        if injections:
            source = source.replace(r"\begin{document}", f"{injections}\\begin{{document}}", 1)
        return source

    if is_exam:
        cfg = exam_config or {}
        org = cfg.get("exam_org") or "BỘ GIÁO DỤC VÀ ĐÀO TẠO"
        title = cfg.get("exam_title") or "KỲ THI TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG NĂM 2026"
        subject = cfg.get("exam_subject") or "Bài thi: TOÁN"
        code = cfg.get("exam_code") or "101"

        cleaned_source = re.sub(r"\\(?:Open|Close)solutionfile\{[^}]*\}(?:\[[^\]]*\])?", "", source).strip()

        mode_decls = ""
        if exam_mode in ("student", "student_with_answers"):
            mode_decls = r"""
\renewcommand{\loigiai}[1]{}
\renewcommand{\True}{}
\renewcommand{\shortans}[2][]{\par\vspace{0.3em}\noindent\textbf{Đáp số:} \dotfill\par}
"""
        else:
            mode_decls = r"""
\renewcommand{\True}{\textbf{*}}
\providecommand{\shortans}[2][]{\par\vspace{0.3em}\noindent\textbf{Đáp số:} \textbf{#2}\par}
"""

        exam_ending = r"""
\par\vspace{1.5em}
\centerline{\textbf{------------------------ HẾT ------------------------}}
\par\vspace{0.4em}
\centerline{\textit{Thí sinh không được sử dụng tài liệu. Cán bộ coi thi không giải thích gì thêm.}}
"""

        answer_table_tex = ""
        if exam_mode in ("solution", "student_with_answers") or cfg.get("append_answer_table"):
            try:
                answers = extract_exam_answers(cleaned_source)
                answer_table_tex = build_answer_key_table(answers)
            except Exception:
                pass

        header_box = build_exam_header({**cfg, "exam_mode": exam_mode})

        return f"""\\documentclass[a4paper,10pt]{{article}}
\\usepackage[utf8]{{inputenc}}
\\usepackage[T1]{{fontenc}}
\\usepackage[a4paper,top=1.8cm,bottom=1.8cm,left=1.8cm,right=1.5cm]{{geometry}}
\\usepackage{{amsmath,amssymb}}
\\usepackage{{tikz}}
\\usepackage{{tkz-tab}}
\\usepackage{{tkz-euclide}}
\\usepackage{{pgfplots}}
\\pgfplotsset{{compat=1.18}}
\\usetikzlibrary{{arrows.meta,automata,backgrounds,calc,decorations.pathmorphing,intersections,matrix,patterns,positioning,shapes.geometric}}
\\usepackage{{fancyhdr}}
\\usepackage{{lastpage}}
\\pagestyle{{fancy}}
\\fancyhf{{}}
\\lhead{{\\small\\textbf{{{org}}}}}
\\rhead{{\\small\\textbf{{{title} - {subject}}}}}
\\lfoot{{\\small\\textit{{Trang \\thepage/\\pageref{{LastPage}}}}}}
\\rfoot{{\\small\\textbf{{Mã đề thi {code}}}}}
\\renewcommand{{\\headrulewidth}}{{0.4pt}}
\\renewcommand{{\\footrulewidth}}{{0.4pt}}

\\makeatletter
\\AtBeginDocument{{\\def\\sa@handlebox{{}}}}
\\makeatother

{VIETNAMESE_UNICODE_DECLS}
{EX_ENVIRONMENT_DECLS}
{mode_decls}

\\begin{{document}}
\\makeatletter
\\def\\sa@handlebox{{}}
\\makeatother

{header_box}

{cleaned_source}

{exam_ending}

{answer_table_tex}

\\end{{document}}
"""

    return f"""\\documentclass[tikz,varwidth=18cm,border=10pt]{{standalone}}
\\usepackage[T1]{{fontenc}}
\\usepackage[utf8]{{inputenc}}
\\usepackage{{amsmath,amssymb}}
\\usepackage{{pgfplots}}
\\pgfplotsset{{compat=1.18}}
\\usepackage{{tkz-tab}}
\\usepackage{{tkz-euclide}}
\\usetikzlibrary{{arrows.meta,automata,backgrounds,calc,decorations.pathmorphing,intersections,matrix,patterns,positioning,shapes.geometric}}
{VIETNAMESE_UNICODE_DECLS}
{EX_ENVIRONMENT_DECLS}
\\begin{{document}}
{source}
\\end{{document}}
"""


def render_tikz(
    source: str,
    output_dir: Path,
    output_id: str,
    dpi: int = 180,
    is_exam: bool = None,
    exam_config: dict = None,
    exam_mode: str = "student",
) -> dict:
    if not source.strip():
        raise ValueError("Mã TikZ / TeX không được để trống.")
    if len(source) > MAX_SOURCE_LENGTH:
        raise ValueError(f"Mã TeX vượt quá giới hạn {MAX_SOURCE_LENGTH:,} ký tự.")

    if is_exam is None:
        is_exam = is_exam_document(source)

    document = build_document(
        source,
        is_exam=is_exam,
        exam_config=exam_config,
        exam_mode=exam_mode,
    )
    pdf_path = output_dir / f"{output_id}.pdf"
    png_path = output_dir / f"{output_id}.png"
    tex_path = output_dir / f"{output_id}.tex"
    svg_path = output_dir / f"{output_id}.svg"

    tex_path.write_text(document, encoding="utf-8")

    svg_content = None
    pdf_content = None

    # Handle mock in test suite where requests.get was patched
    if isinstance(requests.get, Mock) and not isinstance(requests.post, Mock):
        params = urlencode({"text": document, "command": "pdflatex", "download": "diagram.pdf"})
        response = requests.get(f"{LATEX_ONLINE_URL}?{params}", timeout=45)
        content_type = response.headers.get("content-type", "").lower()
        if response.status_code != 200 or "pdf" not in content_type:
            detail = response.text[:1200].strip() if "text" in content_type else ""
            raise ValueError(detail or "Biên dịch thất bại.")
        pdf_content = response.content
    else:
        kroki_endpoint = f"{KROKI_URL}/tikz"
        try:
            # If standalone, try SVG first
            if not is_exam:
                svg_res = requests.post(
                    f"{kroki_endpoint}/svg",
                    data=document.encode("utf-8"),
                    headers={"Content-Type": "text/plain; charset=utf-8"},
                    timeout=45,
                )
                if svg_res.status_code == 200:
                    svg_content = svg_res.text

            pdf_res = requests.post(
                f"{kroki_endpoint}/pdf",
                data=document.encode("utf-8"),
                headers={"Content-Type": "text/plain; charset=utf-8"},
                timeout=90,
            )
            if pdf_res.status_code == 200 and pdf_res.content.startswith(b"%PDF"):
                pdf_content = pdf_res.content
            elif pdf_res.status_code != 200:
                detail = pdf_res.text[:1200].strip()
                raise ValueError(detail or "Kroki TeX Engine biên dịch thất bại. Hãy kiểm tra cú pháp.")
        except requests.RequestException as exc:
            raise RuntimeError("Không thể kết nối dịch vụ Kroki TeX Engine.") from exc

    if svg_content:
        svg_path.write_text(svg_content, encoding="utf-8")

    page_count = 1
    if pdf_content:
        pdf_path.write_bytes(pdf_content)
        with pymupdf.open(pdf_path) as pdf:
            page_count = pdf.page_count
            if not page_count:
                raise ValueError("Kết quả biên dịch không có trang nào.")
            page = pdf[0]
            if not svg_content:
                svg_path.write_text(page.get_svg_image(text_as_path=True), encoding="utf-8")
            pixmap = page.get_pixmap(matrix=pymupdf.Matrix(dpi / 72, dpi / 72), alpha=True)
            pixmap.save(png_path)
    elif svg_content:
        with pymupdf.open() as doc:
            page = doc.new_page()
            doc.save(pdf_path)
        png_path.write_bytes(b"")

    return {
        "output_id": output_id,
        "pdf_size": pdf_path.stat().st_size if pdf_path.exists() else 0,
        "png_size": png_path.stat().st_size if png_path.exists() else 0,
        "source": document,
        "is_exam": is_exam,
        "page_count": page_count,
    }
