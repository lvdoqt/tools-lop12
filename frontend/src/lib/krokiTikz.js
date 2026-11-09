/**
 * Client-side Kroki TeX Engine integration for TikZ diagrams and A4 Exam Documents.
 * Supports tkz-tab, tkz-euclide, pgfplots, amsmath, ex_test, and Vietnamese text.
 */

export const KROKI_TIKZ_ENDPOINT = 'https://kroki.io/tikz';

export const VIETNAMESE_DECLS = `
% Tone helpers for T1 encoding
\\providecommand{\\vnh}[1]{\\v{#1}}
\\providecommand{\\vno}{o\\kern-0.12em\\raisebox{0.55ex}{\\fontsize{4}{4}\\selectfont '}\\kern0.08em}
\\providecommand{\\vnO}{O\\kern-0.14em\\raisebox{0.85ex}{\\fontsize{4}{4}\\selectfont '}\\kern0.08em}
\\providecommand{\\vnu}{u\\kern-0.12em\\raisebox{0.55ex}{\\fontsize{4}{4}\\selectfont '}\\kern0.08em}
\\providecommand{\\vnU}{U\\kern-0.14em\\raisebox{0.85ex}{\\fontsize{4}{4}\\selectfont '}\\kern0.08em}

% D stroke
\\DeclareUnicodeCharacter{0110}{\\DJ}
\\DeclareUnicodeCharacter{0111}{\\dj}

% A
\\DeclareUnicodeCharacter{00E1}{\\'{a}}
\\DeclareUnicodeCharacter{00C1}{\\'{A}}
\\DeclareUnicodeCharacter{00E0}{\\\x60{a}}
\\DeclareUnicodeCharacter{00C0}{\\\x60{A}}
\\DeclareUnicodeCharacter{1EA3}{\\vnh{a}}
\\DeclareUnicodeCharacter{1EA2}{\\vnh{A}}
\\DeclareUnicodeCharacter{00E3}{\\~{a}}
\\DeclareUnicodeCharacter{00C3}{\\~{A}}
\\DeclareUnicodeCharacter{1EA1}{\\d{a}}
\\DeclareUnicodeCharacter{1EA0}{\\d{A}}

% A breve (Ă)
\\DeclareUnicodeCharacter{0103}{\\u{a}}
\\DeclareUnicodeCharacter{0102}{\\u{A}}
\\DeclareUnicodeCharacter{1EAF}{\\'{\\u{a}}}
\\DeclareUnicodeCharacter{1EAE}{\\'{\\u{A}}}
\\DeclareUnicodeCharacter{1EB1}{\\\x60{\\u{a}}}
\\DeclareUnicodeCharacter{1EB0}{\\\x60{\\u{A}}}
\\DeclareUnicodeCharacter{1EB3}{\\vnh{\\u{a}}}
\\DeclareUnicodeCharacter{1EB2}{\\vnh{\\u{A}}}
\\DeclareUnicodeCharacter{1EB5}{\\~{\\u{a}}}
\\DeclareUnicodeCharacter{1EB4}{\\~{\\u{A}}}
\\DeclareUnicodeCharacter{1EB7}{\\d{\\u{a}}}
\\DeclareUnicodeCharacter{1EB6}{\\d{\\u{A}}}

% A circumflex (Â)
\\DeclareUnicodeCharacter{00E2}{\\^{a}}
\\DeclareUnicodeCharacter{00C2}{\\^{A}}
\\DeclareUnicodeCharacter{1EA5}{\\'{\\^{a}}}
\\DeclareUnicodeCharacter{1EA4}{\\'{\\^{A}}}
\\DeclareUnicodeCharacter{1EA7}{\\\x60{\\^{a}}}
\\DeclareUnicodeCharacter{1EA6}{\\\x60{\\^{A}}}
\\DeclareUnicodeCharacter{1EA9}{\\vnh{\\^{a}}}
\\DeclareUnicodeCharacter{1EA8}{\\vnh{\\^{A}}}
\\DeclareUnicodeCharacter{1EAB}{\\~{\\^{a}}}
\\DeclareUnicodeCharacter{1EAA}{\\~{\\^{A}}}
\\DeclareUnicodeCharacter{1EAD}{\\d{\\^{a}}}
\\DeclareUnicodeCharacter{1EAC}{\\d{\\^{A}}}

% E
\\DeclareUnicodeCharacter{00E9}{\\'{e}}
\\DeclareUnicodeCharacter{00C9}{\\'{E}}
\\DeclareUnicodeCharacter{00E8}{\\\x60{e}}
\\DeclareUnicodeCharacter{00C8}{\\\x60{E}}
\\DeclareUnicodeCharacter{1EBB}{\\vnh{e}}
\\DeclareUnicodeCharacter{1EBA}{\\vnh{E}}
\\DeclareUnicodeCharacter{1EBD}{\\~{e}}
\\DeclareUnicodeCharacter{1EBC}{\\~{E}}
\\DeclareUnicodeCharacter{1EB9}{\\d{e}}
\\DeclareUnicodeCharacter{1EB8}{\\d{E}}

% E circumflex (Ê)
\\DeclareUnicodeCharacter{00EA}{\\^{e}}
\\DeclareUnicodeCharacter{00CA}{\\^{E}}
\\DeclareUnicodeCharacter{1EBF}{\\'{\\^{e}}}
\\DeclareUnicodeCharacter{1EBE}{\\'{\\^{E}}}
\\DeclareUnicodeCharacter{1EC1}{\\\x60{\\^{e}}}
\\DeclareUnicodeCharacter{1EC0}{\\\x60{\\^{E}}}
\\DeclareUnicodeCharacter{1EC3}{\\vnh{\\^{e}}}
\\DeclareUnicodeCharacter{1EC2}{\\vnh{\\^{E}}}
\\DeclareUnicodeCharacter{1EC5}{\\~{\\^{e}}}
\\DeclareUnicodeCharacter{1EC4}{\\~{\\^{E}}}
\\DeclareUnicodeCharacter{1EC7}{\\d{\\^{e}}}
\\DeclareUnicodeCharacter{1EC6}{\\d{\\^{E}}}

% I
\\DeclareUnicodeCharacter{00ED}{\\'{i}}
\\DeclareUnicodeCharacter{00CD}{\\'{I}}
\\DeclareUnicodeCharacter{00EC}{\\\x60{i}}
\\DeclareUnicodeCharacter{00CC}{\\\x60{I}}
\\DeclareUnicodeCharacter{1EC9}{\\vnh{i}}
\\DeclareUnicodeCharacter{1EC8}{\\vnh{I}}
\\DeclareUnicodeCharacter{0129}{\\~{i}}
\\DeclareUnicodeCharacter{0128}{\\~{I}}
\\DeclareUnicodeCharacter{1ECB}{\\d{i}}
\\DeclareUnicodeCharacter{1ECA}{\\d{I}}

% O
\\DeclareUnicodeCharacter{00F3}{\\'{o}}
\\DeclareUnicodeCharacter{00D3}{\\'{O}}
\\DeclareUnicodeCharacter{00F2}{\\\x60{o}}
\\DeclareUnicodeCharacter{00D2}{\\\x60{O}}
\\DeclareUnicodeCharacter{1ECF}{\\vnh{o}}
\\DeclareUnicodeCharacter{1ECE}{\\vnh{O}}
\\DeclareUnicodeCharacter{00F5}{\\~{o}}
\\DeclareUnicodeCharacter{00D5}{\\~{O}}
\\DeclareUnicodeCharacter{1ECD}{\\d{o}}
\\DeclareUnicodeCharacter{1ECC}{\\d{O}}

% O circumflex (Ô)
\\DeclareUnicodeCharacter{00F4}{\\^{o}}
\\DeclareUnicodeCharacter{00D4}{\\^{O}}
\\DeclareUnicodeCharacter{1ED1}{\\'{\\^{o}}}
\\DeclareUnicodeCharacter{1ED0}{\\'{\\^{O}}}
\\DeclareUnicodeCharacter{1ED3}{\\\x60{\\^{o}}}
\\DeclareUnicodeCharacter{1ED2}{\\\x60{\\^{O}}}
\\DeclareUnicodeCharacter{1ED5}{\\vnh{\\^{o}}}
\\DeclareUnicodeCharacter{1ED4}{\\vnh{\\^{O}}}
\\DeclareUnicodeCharacter{1ED7}{\\~{\\^{o}}}
\\DeclareUnicodeCharacter{1ED6}{\\~{\\^{O}}}
\\DeclareUnicodeCharacter{1ED9}{\\d{\\^{o}}}
\\DeclareUnicodeCharacter{1ED8}{\\d{\\^{O}}}

% O horn (Ơ)
\\DeclareUnicodeCharacter{01A1}{\\vno}
\\DeclareUnicodeCharacter{01A0}{\\vnO}
\\DeclareUnicodeCharacter{1EDB}{\\'{\\vno}}
\\DeclareUnicodeCharacter{1EDA}{\\'{\\vnO}}
\\DeclareUnicodeCharacter{1EDD}{\\\x60{\\vno}}
\\DeclareUnicodeCharacter{1EDC}{\\\x60{\\vnO}}
\\DeclareUnicodeCharacter{1EDF}{\\vnh{\\vno}}
\\DeclareUnicodeCharacter{1EDE}{\\vnh{\\vnO}}
\\DeclareUnicodeCharacter{1EE1}{\\~{\\vno}}
\\DeclareUnicodeCharacter{1EE0}{\\~{\\vnO}}
\\DeclareUnicodeCharacter{1EE3}{\\d{\\vno}}
\\DeclareUnicodeCharacter{1EE2}{\\d{\\vnO}}

% U
\\DeclareUnicodeCharacter{00FA}{\\'{u}}
\\DeclareUnicodeCharacter{00DA}{\\'{U}}
\\DeclareUnicodeCharacter{00F9}{\\\x60{u}}
\\DeclareUnicodeCharacter{00D9}{\\\x60{U}}
\\DeclareUnicodeCharacter{1EE7}{\\vnh{u}}
\\DeclareUnicodeCharacter{1EE6}{\\vnh{U}}
\\DeclareUnicodeCharacter{0169}{\\~{u}}
\\DeclareUnicodeCharacter{0168}{\\~{U}}
\\DeclareUnicodeCharacter{1EE5}{\\d{u}}
\\DeclareUnicodeCharacter{1EE4}{\\d{U}}

% U horn (Ư)
\\DeclareUnicodeCharacter{01B0}{\\vnu}
\\DeclareUnicodeCharacter{01AF}{\\vnU}
\\DeclareUnicodeCharacter{1EE9}{\\'{\\vnu}}
\\DeclareUnicodeCharacter{1EE8}{\\'{\\vnU}}
\\DeclareUnicodeCharacter{1EEB}{\\\x60{\\vnu}}
\\DeclareUnicodeCharacter{1EEA}{\\\x60{\\vnU}}
\\DeclareUnicodeCharacter{1EED}{\\vnh{\\vnu}}
\\DeclareUnicodeCharacter{1EEC}{\\vnh{\\vnU}}
\\DeclareUnicodeCharacter{1EEF}{\\~{\\vnu}}
\\DeclareUnicodeCharacter{1EEE}{\\~{\\vnU}}
\\DeclareUnicodeCharacter{1EF1}{\\d{\\vnu}}
\\DeclareUnicodeCharacter{1EF0}{\\d{\\vnU}}

% Y
\\DeclareUnicodeCharacter{00FD}{\\'{y}}
\\DeclareUnicodeCharacter{00DD}{\\'{Y}}
\\DeclareUnicodeCharacter{1EF3}{\\\x60{y}}
\\DeclareUnicodeCharacter{1EF2}{\\\x60{Y}}
\\DeclareUnicodeCharacter{1EF7}{\\vnh{y}}
\\DeclareUnicodeCharacter{1EF6}{\\vnh{Y}}
\\DeclareUnicodeCharacter{1EF9}{\\~{y}}
\\DeclareUnicodeCharacter{1EF8}{\\~{Y}}
\\DeclareUnicodeCharacter{1EF5}{\\d{y}}
\\DeclareUnicodeCharacter{1EF4}{\\d{Y}}
`;

export const EX_ENVIRONMENT_DECLS = `
% ex_test and exam package compatibility definitions
\\makeatletter
\\@ifundefined{c@excount}{\\newcounter{excount}}{}
\\providecommand{\\exname}{Câu}
\\providecommand{\\Opensolutionfile}[2]{}
\\providecommand{\\Closesolutionfile}[1]{}
\\providecommand{\\diem}[2][]{\\if\\relax\\detokenize{#2}\\relax\\else\\space\\textit{(#2 điểm)}\\fi}
\\providecommand{\\R}{\\mathbb{R}}
\\providecommand{\\True}{\\textbf{*}}
\\providecommand{\\itemch}{\\item}
\\@ifundefined{itemchoice}{\\newenvironment{itemchoice}{\\begin{itemize}}{\\end{itemize}}}{}

\\@ifundefined{ex}{%
  \\newenvironment{ex}[1][]{%
    \\par\\vspace{0.7em}\\noindent
    \\refstepcounter{excount}%
    \\textbf{\\exname~\\theexcount.}%
    \\if\\relax\\detokenize{#1}\\relax\\else\\space\\textbf{(#1)}\\fi\\space
  }{%
    \\par\\vspace{0.7em}%
  }%
}{}

\\providecommand{\\loigiai}[1]{%
  \\par\\vspace{0.4em}\\noindent
  \\textit{\\textbf{Lời giải.}}~#1\\par\\vspace{0.4em}%
}

\\providecommand{\\shortans}[2][]{%
  \\par\\vspace{0.3em}\\noindent
  \\textbf{Đáp số:}~#2\\par%
}

\\providecommand{\\heva}[1]{\\left\\{\\begin{aligned}#1\\end{aligned}\\right.}
\\providecommand{\\hoac}[1]{\\left[\\begin{aligned}#1\\end{aligned}\\right.}

\\newcommand{\\@choiceone}[4]{%
  \\par\\vspace{0.2em}\\noindent
  \\begin{tabular*}{\\linewidth}{@{\\extracolsep{\\fill}}l}
    \\textbf{A.}~#1 \\\\ \\textbf{B.}~#2 \\\\ \\textbf{C.}~#3 \\\\ \\textbf{D.}~#4
  \\end{tabular*}\\par\\vspace{0.2em}%
}
\\newcommand{\\@choicetwo}[4]{%
  \\par\\vspace{0.2em}\\noindent
  \\begin{tabular*}{\\linewidth}{@{\\extracolsep{\\fill}}ll}
    \\textbf{A.}~#1 & \\textbf{B.}~#2 \\\\
    \\textbf{C.}~#3 & \\textbf{D.}~#4
  \\end{tabular*}\\par\\vspace{0.2em}%
}
\\newcommand{\\@choicefour}[4]{%
  \\par\\vspace{0.2em}\\noindent
  \\begin{tabular*}{\\linewidth}{@{\\extracolsep{\\fill}}llll}
    \\textbf{A.}~#1 & \\textbf{B.}~#2 & \\textbf{C.}~#3 & \\textbf{D.}~#4
  \\end{tabular*}\\par\\vspace{0.2em}%
}

\\providecommand{\\choice}[5][4]{%
  \\ifx1#1\\@choiceone{#2}{#3}{#4}{#5}%
  \\else\\ifx2#1\\@choicetwo{#2}{#3}{#4}{#5}%
  \\else\\@choicefour{#2}{#3}{#4}{#5}\\fi\\fi
}

\\newcommand{\\@choiceTFone}[4]{%
  \\par\\vspace{0.2em}\\noindent
  \\begin{tabular*}{\\linewidth}{@{\\extracolsep{\\fill}}l}
    \\textbf{a)}~#1 \\\\ \\textbf{b)}~#2 \\\\ \\textbf{c)}~#3 \\\\ \\textbf{d)}~#4
  \\end{tabular*}\\par\\vspace{0.2em}%
}
\\newcommand{\\@choiceTFtwo}[4]{%
  \\par\\vspace{0.2em}\\noindent
  \\begin{tabular*}{\\linewidth}{@{\\extracolsep{\\fill}}ll}
    \\textbf{a)}~#1 & \\textbf{b)}~#2 \\\\
    \\textbf{c)}~#3 & \\textbf{d)}~#4
  \\end{tabular*}\\par\\vspace{0.2em}%
}
\\newcommand{\\@choiceTFfour}[4]{%
  \\par\\vspace{0.2em}\\noindent
  \\begin{tabular*}{\\linewidth}{@{\\extracolsep{\\fill}}llll}
    \\textbf{a)}~#1 & \\textbf{b)}~#2 & \\textbf{c)}~#3 & \\textbf{d)}~#4
  \\end{tabular*}\\par\\vspace{0.2em}%
}

\\providecommand{\\choiceTF}[5][4]{%
  \\ifx1#1\\@choiceTFone{#2}{#3}{#4}{#5}%
  \\else\\ifx2#1\\@choiceTFtwo{#2}{#3}{#4}{#5}%
  \\else\\@choiceTFfour{#2}{#3}{#4}{#5}\\fi\\fi
}
\\providecommand{\\choiceTFt}[5][4]{\\choiceTF[#1]{#2}{#3}{#4}{#5}}

\\providecommand{\\phanII}[1][]{%
  \\par\\vspace{1.2em}\\noindent
  \\textbf{\\large PHẦN II. Câu trắc nghiệm đúng sai.}%
  \\if\\relax\\detokenize{#1}\\relax\\else\\space\\textbf{#1}\\fi\\par\\vspace{0.2em}
  \\noindent\\textit{Thí sinh trả lời từ câu 1 đến câu 4. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.}\\par\\vspace{0.6em}%
  \\setcounter{excount}{0}%
}

\\providecommand{\\phanIII}[1][]{%
  \\par\\vspace{1.2em}\\noindent
  \\textbf{\\large PHẦN III. Câu trắc nghiệm trả lời ngắn.}%
  \\if\\relax\\detokenize{#1}\\relax\\else\\space\\textbf{#1}\\fi\\par\\vspace{0.2em}
  \\noindent\\textit{Thí sinh trả lời từ câu 1 đến câu 6.}\\par\\vspace{0.6em}%
  \\setcounter{excount}{0}%
}

\\@ifundefined{immini}{%
  \\newcommand{\\immini}{\\@ifstar\\@imministar\\@immininostar}
  \\newcommand{\\@immininostar}[3][]{%
    \\par\\noindent
    \\begin{minipage}[t]{0.64\\linewidth}
      #2
    \\end{minipage}\\hfill
    \\begin{minipage}[t]{0.33\\linewidth}
      \\centering #3
    \\end{minipage}\\par
  }
  \\newcommand{\\@imministar}[3][]{%
    \\par\\noindent
    \\begin{minipage}[t]{0.33\\linewidth}
      \\centering #3
    \\end{minipage}\\hfill
    \\begin{minipage}[t]{0.64\\linewidth}
      #2
    \\end{minipage}\\par
  }
}{}
\\makeatother
`;

/**
 * Checks if source is an exam with multiple questions.
 */
export function isExamDocument(source) {
  if (!source) return false;
  return /\\begin\s*\{ex\}|\\choiceTF|\\choice\b|\\phanI|\\phanII|\\phanIII|\\shortans\b|\\loigiai\b/i.test(source);
}

/**
 * Match nested braces group { ... }
 */
function matchGroup(text, start, open = '{', close = '}') {
  let pos = start;
  while (pos < text.length && /\s/.test(text[pos])) pos++;
  if (pos >= text.length || text[pos] !== open) return null;
  let depth = 1;
  let idx = pos + 1;
  while (idx < text.length) {
    if (text[idx] === '\\') {
      idx += 2;
      continue;
    }
    if (text[idx] === open) depth++;
    else if (text[idx] === close) {
      depth--;
      if (depth === 0) {
        return { content: text.slice(pos + 1, idx), end: idx + 1 };
      }
    }
    idx++;
  }
  return null;
}

function skipOptional(text, start) {
  let pos = start;
  while (pos < text.length && /\s/.test(text[pos])) pos++;
  if (pos < text.length && text[pos] === '[') {
    const res = matchGroup(text, pos, '[', ']');
    if (res) return res.end;
  }
  return pos;
}

function getBraceArgs(text, startIdx, count = 4) {
  let pos = startIdx;
  const args = [];
  for (let i = 0; i < count; i++) {
    const res = matchGroup(text, pos);
    if (!res) break;
    args.push(res.content);
    pos = res.end;
  }
  return args;
}

/**
 * Parses answers from an exam source (Part 1: 12 MCQ, Part 2: 4 TF, Part 3: 6 Short answers).
 */
export function extractExamAnswers(source) {
  const p1 = [];
  const p2 = [];
  const p3 = [];

  const phan2Match = /\\phanII\b/.exec(source);
  const phan3Match = /\\phanIII\b/.exec(source);

  const p1End = phan2Match ? phan2Match.index : source.length;
  const p2Start = phan2Match ? phan2Match.index + phan2Match[0].length : source.length;
  const p2End = phan3Match ? phan3Match.index : source.length;
  const p3Start = phan3Match ? phan3Match.index + phan3Match[0].length : source.length;

  const p1Text = source.slice(0, p1End);
  const p2Text = source.slice(p2Start, p2End);
  const p3Text = source.slice(p3Start);

  function parseExBlocks(text) {
    const blocks = [];
    const exRegex = /\\begin\{ex\}/g;
    let match;
    const starts = [];
    while ((match = exRegex.exec(text)) !== null) {
      starts.push(match.index);
    }
    for (let i = 0; i < starts.length; i++) {
      const nextStart = i + 1 < starts.length ? starts[i + 1] : text.length;
      blocks.push(text.slice(starts[i], nextStart));
    }
    return blocks;
  }

  // Part 1: Multiple Choice
  parseExBlocks(p1Text).forEach((block, idx) => {
    const choiceMatch = /\\choice\b/.exec(block);
    let ans = null;
    if (choiceMatch) {
      const startPos = skipOptional(block, choiceMatch.index + choiceMatch[0].length);
      const opts = getBraceArgs(block, startPos, 4);
      opts.forEach((opt, oIdx) => {
        if (/\\True\b/.test(opt)) ans = String.fromCharCode(65 + oIdx);
      });
    }
    p1.push({ q: idx + 1, ans: ans || '-' });
  });

  // Part 2: True/False
  parseExBlocks(p2Text).forEach((block, idx) => {
    const tfMatch = /\\choiceTF(?:t)?\b/.exec(block);
    const answers = ['S', 'S', 'S', 'S'];
    if (tfMatch) {
      const startPos = skipOptional(block, tfMatch.index + tfMatch[0].length);
      const opts = getBraceArgs(block, startPos, 4);
      opts.forEach((opt, oIdx) => {
        if (/\\True\b/.test(opt)) answers[oIdx] = 'Đ';
      });
    }
    p2.push({ q: idx + 1, ans: answers });
  });

  // Part 3: Short Answers
  parseExBlocks(p3Text).forEach((block, idx) => {
    const saMatch = /\\shortans(?:\[[^\]]*\])?\s*\{/.exec(block);
    let val = '-';
    if (saMatch) {
      const res = matchGroup(block, saMatch.index + saMatch[0].length - 1);
      if (res) {
        val = res.content.trim().replace(/^\$+/g, '').replace(/\$+$/g, '').replace(/\{,\}/g, ',');
      }
    }
    p3.push({ q: idx + 1, ans: val });
  });

  return { p1, p2, p3 };
}

/**
 * Builds LaTeX code for the Answer Key Table.
 */
export function buildAnswerKeyTableLatex(answers) {
  if (!answers || (!answers.p1.length && !answers.p2.length && !answers.p3.length)) {
    return '';
  }

  let tableTex = `
\\newpage
\\par\\vspace{1em}
\\begin{center}
{\\Large\\textbf{BẢNG ĐÁP ÁN THAM KHẢO}}
\\end{center}
\\vspace{0.5em}
`;

  if (answers.p1.length) {
    tableTex += `
\\noindent\\textbf{\\large PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn}
\\begin{center}
\\begin{tabular}{|${answers.p1.map(() => 'c|').join('')}}
\\hline
${answers.p1.map(item => `\\textbf{${item.q}}`).join(' & ')} \\\\
\\hline
${answers.p1.map(item => item.ans).join(' & ')} \\\\
\\hline
\\end{tabular}
\\end{center}
\\vspace{0.8em}
`;
  }

  if (answers.p2.length) {
    tableTex += `
\\noindent\\textbf{\\large PHẦN II. Câu trắc nghiệm đúng sai}
\\begin{center}
\\begin{tabular}{|c|c|c|c|c|}
\\hline
\\textbf{Câu} & \\textbf{Ý a)} & \\textbf{Ý b)} & \\textbf{Ý c)} & \\textbf{Ý d)} \\\\
\\hline
${answers.p2.map(item => `\\textbf{${item.q}} & ${item.ans[0]} & ${item.ans[1]} & ${item.ans[2]} & ${item.ans[3]}`).join(' \\\\\n\\hline\n')} \\\\
\\hline
\\end{tabular}
\\end{center}
\\vspace{0.8em}
`;
  }

  if (answers.p3.length) {
    tableTex += `
\\noindent\\textbf{\\large PHẦN III. Câu trắc nghiệm trả lời ngắn}
\\begin{center}
\\begin{tabular}{|c|${answers.p3.map(() => 'c|').join('')}}
\\hline
\\textbf{Câu} & ${answers.p3.map(item => `\\textbf{${item.q}}`).join(' & ')} \\\\
\\hline
\\textbf{Đáp số} & ${answers.p3.map(item => `$${item.ans}$`).join(' & ')} \\\\
\\hline
\\end{tabular}
\\end{center}
`;
  }

  return tableTex;
}

/**
 * Builds LaTeX Exam Header box.
 */
export function buildExamHeader(config = {}) {
  const org = config.examOrg || 'BỘ GIÁO DỤC VÀ ĐÀO TẠO';
  const title = config.examTitle || 'KỲ THI TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG NĂM 2026';
  const subject = config.examSubject || 'Bài thi: TOÁN';
  const time = config.examTime || '90 phút, không kể thời gian phát đề';
  const examMode = config.examMode || 'student';
  const isSolution = examMode === 'solution';

  return `
\\begin{center}
\\begin{tabular*}{\\linewidth}{@{\\extracolsep{\\fill}}lr}
\\textbf{${org}} & \\textbf{${title}}\\\\
\\textbf{ĐỀ THI CHÍNH THỨC} & \\textbf{${subject}}\\\\
\\textit{(Đề thi có \\pageref{LastPage} trang${isSolution ? ' - Kèm lời giải' : ''})} & \\textit{Thời gian làm bài: ${time}}
\\end{tabular*}
\\end{center}
\\vspace{-0.6em}
\\noindent\\rule{\\linewidth}{0.6pt}
\\vspace{0.3em}
\\noindent\\textbf{Họ và tên thí sinh:} \\dotfill \\hspace{1cm} \\textbf{Số báo danh:} \\dotfill
\\vspace{0.8em}

\\noindent\\textbf{\\large PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.}\\par\\vspace{0.2em}
\\noindent\\textit{Thí sinh trả lời từ câu 1 đến câu 12. Mỗi câu hỏi thí sinh chỉ chọn một phương án.}\\par\\vspace{0.5em}
`;
}

/**
 * Prepares LaTeX document suitable for Kroki TeX Engine.
 * Supports standalone diagrams and A4 Exam documents (2026 graduation format).
 */
export function buildKrokiDocument(source, options = {}) {
  let doc = (source || '').trim();
  // Strip markdown code fences
  doc = doc.replace(/^```[\w+-]*\s*$/gm, '').trim();

  const mode = options.mode || (isExamDocument(doc) ? 'exam' : 'tikz');
  const examMode = options.examMode || 'student'; // 'student' | 'solution' | 'student_with_answers'
  const examCode = options.examCode || '101';
  const examOrg = options.examOrg || 'BỘ GIÁO DỤC VÀ ĐÀO TẠO';
  const examTitle = options.examTitle || 'KỲ THI TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG NĂM 2026';
  const examSubject = options.examSubject || 'Bài thi: TOÁN';

  // If user provided a complete document with \documentclass
  if (doc.includes('\\documentclass')) {
    // Replace T5 fontenc with T1 because Kroki lacks vntex t5enc.def
    doc = doc.replace(/\\usepackage\s*\[\s*T5\s*\]\s*\{\s*fontenc\s*\}/g, '\\usepackage[T1]{fontenc}');
    // Remove unsupported vietnamese babel option
    doc = doc.replace(/\\usepackage\s*\[\s*vietnamese\s*\]\s*\{\s*babel\s*\}/g, '');
    // Cap pgfplots compat
    doc = doc.replace(/(\\pgfplotsset\s*\{\s*compat\s*=\s*)([2-9]\.\d+|1\.(?:19|\d{3,}))(\s*\})/g, '$11.18$3');

    const preamble = doc.split('\\begin{document}')[0];
    const preambleClean = preamble.replace(/%.*$/gm, '');
    let injections = '';

    if (/\\tkzTab/.test(doc) && !/\\usepackage\s*(?:\[[^\]]*\]\s*)?\{[^}]*\btkz-tab\b[^}]*\}/.test(preambleClean)) {
      injections += '\\usepackage{tkz-tab}\n';
    }
    if (/\\tkz(Def|Draw|Label|Get)/.test(doc) && !/\\usepackage\s*(?:\[[^\]]*\]\s*)?\{[^}]*\btkz-euclide\b[^}]*\}/.test(preambleClean)) {
      injections += '\\usepackage{tkz-euclide}\n';
    }
    if (/(?:\\begin\{axis\}|\\pgfplotsset|\\addplot)/.test(doc) && !/\\usepackage\s*(?:\[[^\]]*\]\s*)?\{[^}]*\bpgfplots\b[^}]*\}/.test(preambleClean)) {
      injections += '\\usepackage{pgfplots}\n\\pgfplotsset{compat=1.18}\n';
    }
    if (!doc.includes('\\DeclareUnicodeCharacter{0110}')) {
      injections += VIETNAMESE_DECLS + '\n';
    }
    if (/\\begin\{ex\}|\\choice|\\loigiai|\\immini|\\heva|\\hoac/.test(doc) && !doc.includes('\\newenvironment{ex}')) {
      injections += EX_ENVIRONMENT_DECLS + '\n';
    }

    // Always inject standalone handlebox preventer so TikZ pictures don't shrink document pages
    injections += `\\makeatletter\n\\AtBeginDocument{\\def\\sa@handlebox{}}\n\\makeatother\n`;

    if (injections) {
      doc = doc.replace('\\begin{document}', `${injections}\\begin{document}`);
    }
    return doc;
  }

  // A4 Exam Document Mode
  if (mode === 'exam') {
    // Clean redundant solution file commands if any
    let cleanedSource = doc
      .replace(/\\Opensolutionfile\{[^}]*\}(?:\[[^\]]*\])?/g, '')
      .replace(/\\Closesolutionfile\{[^}]*\}/g, '')
      .trim();

    // Mode-specific declarations
    let modeDecls = '';
    if (examMode === 'student' || examMode === 'student_with_answers') {
      modeDecls = `
\\renewcommand{\\loigiai}[1]{}
\\renewcommand{\\True}{}
\\renewcommand{\\shortans}[2][]{\\par\\vspace{0.3em}\\noindent\\textbf{Đáp số:} \\dotfill\\par}
`;
    } else {
      modeDecls = `
\\renewcommand{\\True}{\\textbf{*}}
\\providecommand{\\shortans}[2][]{\\par\\vspace{0.3em}\\noindent\\textbf{Đáp số:} \\textbf{#2}\\par}
`;
    }

    // Ending text
    const examEnding = `
\\par\\vspace{1.5em}
\\centerline{\\textbf{------------------------ HẾT ------------------------}}
\\par\\vspace{0.4em}
\\centerline{\\textit{Thí sinh không được sử dụng tài liệu. Cán bộ coi thi không giải thích gì thêm.}}
`;

    // Answer table if requested
    let answerTableTex = '';
    if (examMode === 'solution' || examMode === 'student_with_answers' || options.appendAnswerTable) {
      try {
        const answers = extractExamAnswers(cleanedSource);
        answerTableTex = buildAnswerKeyTableLatex(answers);
      } catch {
        /* ignore table generation errors */
      }
    }

    const examHeaderBox = buildExamHeader({
      examOrg,
      examTitle,
      examSubject,
      examTime: options.examTime || '90 phút, không kể thời gian phát đề',
      examMode,
    });

    return `\\documentclass[a4paper,10pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[a4paper,top=1.8cm,bottom=1.8cm,left=1.8cm,right=1.5cm]{geometry}
\\usepackage{amsmath,amssymb}
\\usepackage{tikz}
\\usepackage{tkz-tab}
\\usepackage{tkz-euclide}
\\usepackage{pgfplots}
\\pgfplotsset{compat=1.18}
\\usetikzlibrary{arrows.meta,automata,backgrounds,calc,decorations.pathmorphing,intersections,matrix,patterns,positioning,shapes.geometric}
\\usepackage{fancyhdr}
\\usepackage{lastpage}
\\pagestyle{fancy}
\\fancyhf{}
\\lhead{\\small\\textbf{${examOrg}}}
\\rhead{\\small\\textbf{${examTitle} - ${examSubject}}}
\\lfoot{\\small\\textit{Trang \\thepage/\\pageref{LastPage}}}
\\rfoot{\\small\\textbf{Mã đề thi ${examCode}}}
\\renewcommand{\\headrulewidth}{0.4pt}
\\renewcommand{\\footrulewidth}{0.4pt}

\\makeatletter
\\AtBeginDocument{\\def\\sa@handlebox{}}
\\makeatother

${VIETNAMESE_DECLS}
${EX_ENVIRONMENT_DECLS}
${modeDecls}

\\begin{document}
\\makeatletter
\\def\\sa@handlebox{}
\\makeatother

${examHeaderBox}

${cleanedSource}

${examEnding}

${answerTableTex}

\\end{document}
`;
  }

  // Standalone TikZ Diagram Mode
  return `\\documentclass[tikz,varwidth=18cm,border=10pt]{standalone}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath,amssymb}
\\usepackage{pgfplots}
\\pgfplotsset{compat=1.18}
\\usepackage{tkz-tab}
\\usepackage{tkz-euclide}
\\usetikzlibrary{arrows.meta,automata,backgrounds,calc,decorations.pathmorphing,intersections,matrix,patterns,positioning,shapes.geometric}
${VIETNAMESE_DECLS}
${EX_ENVIRONMENT_DECLS}
\\begin{document}
${doc}
\\end{document}
`;
}

/**
 * Parse human-readable error from Kroki TeX output.
 */
export function parseKrokiError(raw) {
  if (!raw) return 'Biên dịch TeX / TikZ thất bại.';
  const clean = raw.replace(/^Error \d+:\s*/i, '').trim();
  const match = clean.match(/!(?:[^\n]+\n(?:[^\n]+\n)?)/);
  if (match) {
    const lines = match[0].split('\n').map(l => l.trim()).filter(Boolean);
    return lines.join(' - ');
  }
  return clean.slice(0, 300);
}

/**
 * Render TikZ code or Exam to PDF/SVG via Kroki TeX Engine.
 */
export async function renderTikzWithKroki(source, options = {}) {
  const { signal } = options;
  const isExam = options.mode === 'exam' || (options.mode !== 'tikz' && isExamDocument(source));
  const document = buildKrokiDocument(source, { ...options, mode: isExam ? 'exam' : 'tikz' });

  // For exams, we directly compile to PDF (skip /svg to avoid single-page cutoff and timeout)
  if (isExam) {
    const pdfBlob = await fetchKrokiPdf(document, { signal });
    return {
      document,
      isExam: true,
      pdfBlob,
      svg: null,
    };
  }

  // For standalone TikZ diagrams, render SVG
  const res = await fetch(`${KROKI_TIKZ_ENDPOINT}/svg`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    body: document,
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(parseKrokiError(errText));
  }

  const svg = await res.text();
  if (!svg.includes('<svg')) {
    throw new Error('Đầu ra từ Kroki TeX Engine không phải định dạng SVG hợp lệ.');
  }

  return { svg, document, isExam: false };
}

/**
 * Fetch PDF from Kroki TeX Engine.
 */
export async function fetchKrokiPdf(document, { signal } = {}) {
  const res = await fetch(`${KROKI_TIKZ_ENDPOINT}/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    body: document,
    signal,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(parseKrokiError(errText) || 'Không thể tải PDF từ Kroki TeX Engine.');
  }
  return await res.blob();
}

/**
 * Render SVG to PNG blob at requested DPI via browser HTML Canvas.
 */
export async function svgToPngBlob(svgString, dpi = 180) {
  if (!svgString) return null;
  return new Promise((resolve, reject) => {
    try {
      const scale = dpi / 72;
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');
      const svgEl = doc.querySelector('svg');
      if (!svgEl) return reject(new Error('Mã SVG không hợp lệ.'));

      let width = parseFloat(svgEl.getAttribute('width'));
      let height = parseFloat(svgEl.getAttribute('height'));

      if (!width || !height || isNaN(width) || isNaN(height)) {
        const viewBox = svgEl.getAttribute('viewBox');
        if (viewBox) {
          const parts = viewBox.trim().split(/[\s,]+/).map(parseFloat);
          if (parts.length === 4) {
            width = parts[2];
            height = parts[3];
          }
        }
      }

      width = Math.max(width || 400, 50);
      height = Math.max(height || 300, 50);

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Không khởi tạo được Canvas 2D.'));

      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        try {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          canvas.toBlob(pngBlob => {
            if (pngBlob) resolve(pngBlob);
            else reject(new Error('Không thể chuyển SVG thành PNG.'));
          }, 'image/png');
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Trình duyệt không thể đọc ảnh SVG để vẽ PNG.'));
      };

      img.src = url;
    } catch (e) {
      reject(e);
    }
  });
}
