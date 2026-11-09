/**
 * Client-side Kroki TeX Engine integration for TikZ diagrams.
 * Supports tkz-tab, tkz-euclide, pgfplots, amsmath, and Vietnamese text.
 */

export const KROKI_TIKZ_ENDPOINT = 'https://kroki.io/tikz';

const VIETNAMESE_DECLS = `
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

const EX_ENVIRONMENT_DECLS = `
% ex_test and exam package compatibility definitions
\\makeatletter
\\@ifundefined{c@excount}{\\newcounter{excount}}{}
\\providecommand{\\exname}{Câu}
\\providecommand{\\Opensolutionfile}[2]{}
\\providecommand{\\Closesolutionfile}[1]{}
\\providecommand{\\phanII}[1][]{\\par\\vspace{1em}\\noindent\\textbf{\\large PHẦN II. #1}\\par\\vspace{0.5em}}
\\providecommand{\\phanIII}[1][]{\\par\\vspace{1em}\\noindent\\textbf{\\large PHẦN III. #1}\\par\\vspace{0.5em}}
\\providecommand{\\diem}[2][]{\\if\\relax\\detokenize{#2}\\relax\\else\\space\\textit{(#2 điểm)}\\fi}
\\providecommand{\\R}{\\mathbb{R}}
\\providecommand{\\True}{\\textbf{*}}
\\providecommand{\\itemch}{\\item}
\\@ifundefined{itemchoice}{\\newenvironment{itemchoice}{\\begin{itemize}}{\\end{itemize}}}{}

\\@ifundefined{ex}{%
  \\newenvironment{ex}[1][]{%
    \\par\\vspace{0.8em}\\noindent
    \\refstepcounter{excount}%
    \\textbf{\\exname~\\theexcount.}%
    \\if\\relax\\detokenize{#1}\\relax\\else\\space\\textbf{(#1)}\\fi\\space
  }{%
    \\par\\vspace{0.8em}%
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
 * Prepares LaTeX TikZ document suitable for Kroki TeX Engine.
 */
export function buildKrokiDocument(source) {
  let doc = (source || '').trim();
  // Strip code fences
  doc = doc.replace(/^```[\w+-]*\s*$/gm, '').trim();

  if (doc.includes('\\documentclass')) {
    // Replace T5 fontenc with T1 because Kroki lacks vntex t5enc.def
    doc = doc.replace(/\\usepackage\s*\[\s*T5\s*\]\s*\{\s*fontenc\s*\}/g, '\\usepackage[T1]{fontenc}');
    // Remove unsupported vietnamese babel option
    doc = doc.replace(/\\usepackage\s*\[\s*vietnamese\s*\]\s*\{\s*babel\s*\}/g, '');
    // Cap pgfplots compat
    doc = doc.replace(/(\\pgfplotsset\s*\{\s*compat\s*=\s*)([2-9]\.\d+|1\.(?:19|\d{3,}))(\s*\})/g, '$11.18$3');

    // If user provided a full document, inject missing packages if needed
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

    if (injections) {
      doc = doc.replace('\\begin{document}', `${injections}\\begin{document}`);
    }
    return doc;
  }

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
function parseKrokiError(raw) {
  if (!raw) return 'Biên dịch TikZ thất bại.';
  const clean = raw.replace(/^Error \d+:\s*/i, '').trim();
  // Match standard LaTeX errors like ! Package ... Error: ... or ! LaTeX Error: ...
  const match = clean.match(/!(?:[^\n]+\n(?:[^\n]+\n)?)/);
  if (match) {
    const lines = match[0].split('\n').map(l => l.trim()).filter(Boolean);
    return lines.join(' - ');
  }
  return clean.slice(0, 300);
}

/**
 * Render TikZ code to SVG via Kroki TeX Engine.
 */
export async function renderTikzWithKroki(source, { signal } = {}) {
  const document = buildKrokiDocument(source);

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

  return { svg, document };
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
  if (!res.ok) throw new Error('Không thể tải PDF từ Kroki TeX Engine.');
  return await res.blob();
}

/**
 * Render SVG to PNG blob at requested DPI via browser HTML Canvas.
 */
export async function svgToPngBlob(svgString, dpi = 180) {
  return new Promise((resolve, reject) => {
    try {
      const scale = dpi / 72;
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');
      const svgEl = doc.querySelector('svg');
      if (!svgEl) return reject(new Error('Mã SVG không hợp lệ.'));

      // Read dimensions
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
