/**
 * Client-side Kroki TeX Engine integration for TikZ diagrams.
 * Supports tkz-tab, tkz-euclide, pgfplots, amsmath, and Vietnamese text.
 */

export const KROKI_TIKZ_ENDPOINT = 'https://kroki.io/tikz';

const VIETNAMESE_DECLS = `
\\DeclareUnicodeCharacter{0110}{\\DJ}
\\DeclareUnicodeCharacter{0111}{\\dj}
\\DeclareUnicodeCharacter{00E1}{\\'{a}}
\\DeclareUnicodeCharacter{00E0}{\\\x60{a}}
\\DeclareUnicodeCharacter{1EA3}{\\h{a}}
\\DeclareUnicodeCharacter{00E3}{\\~{a}}
\\DeclareUnicodeCharacter{1EA1}{\\d{a}}
\\DeclareUnicodeCharacter{0103}{\\u{a}}
\\DeclareUnicodeCharacter{1EAF}{\\'{a}}
\\DeclareUnicodeCharacter{1EB1}{\\\x60{a}}
\\DeclareUnicodeCharacter{1EB3}{\\u{a}}
\\DeclareUnicodeCharacter{1EB5}{\\~{a}}
\\DeclareUnicodeCharacter{1EB7}{\\d{a}}
\\DeclareUnicodeCharacter{00E2}{\\^{a}}
\\DeclareUnicodeCharacter{1EA5}{\\'{a}}
\\DeclareUnicodeCharacter{1EA7}{\\\x60{a}}
\\DeclareUnicodeCharacter{1EA9}{\\^{a}}
\\DeclareUnicodeCharacter{1EAB}{\\~{a}}
\\DeclareUnicodeCharacter{1EAD}{\\d{a}}
\\DeclareUnicodeCharacter{00E9}{\\'{e}}
\\DeclareUnicodeCharacter{00E8}{\\\x60{e}}
\\DeclareUnicodeCharacter{1EBB}{\\h{e}}
\\DeclareUnicodeCharacter{1EBD}{\\~{e}}
\\DeclareUnicodeCharacter{1EB9}{\\d{e}}
\\DeclareUnicodeCharacter{00EA}{\\^{e}}
\\DeclareUnicodeCharacter{1EBF}{\\'{e}}
\\DeclareUnicodeCharacter{1EC1}{\\\x60{e}}
\\DeclareUnicodeCharacter{1EC3}{\\^{e}}
\\DeclareUnicodeCharacter{1EC5}{\\~{e}}
\\DeclareUnicodeCharacter{1EC7}{\\d{e}}
\\DeclareUnicodeCharacter{00ED}{\\'{i}}
\\DeclareUnicodeCharacter{00EC}{\\\x60{i}}
\\DeclareUnicodeCharacter{1EC9}{\\h{i}}
\\DeclareUnicodeCharacter{0129}{\\~{i}}
\\DeclareUnicodeCharacter{1ECB}{\\d{i}}
\\DeclareUnicodeCharacter{00F3}{\\'{o}}
\\DeclareUnicodeCharacter{00F2}{\\\x60{o}}
\\DeclareUnicodeCharacter{1ECF}{\\h{o}}
\\DeclareUnicodeCharacter{00F5}{\\~{o}}
\\DeclareUnicodeCharacter{1ECD}{\\d{o}}
\\DeclareUnicodeCharacter{00F4}{\\^{o}}
\\DeclareUnicodeCharacter{1ED1}{\\'{o}}
\\DeclareUnicodeCharacter{1ED3}{\\\x60{o}}
\\DeclareUnicodeCharacter{1ED5}{\\^{o}}
\\DeclareUnicodeCharacter{1ED7}{\\~{o}}
\\DeclareUnicodeCharacter{1ED9}{\\d{o}}
\\DeclareUnicodeCharacter{01A1}{\\^{o}}
\\DeclareUnicodeCharacter{1EDB}{\\'{o}}
\\DeclareUnicodeCharacter{1EDD}{\\\x60{o}}
\\DeclareUnicodeCharacter{1EDF}{\\^{o}}
\\DeclareUnicodeCharacter{1EE1}{\\~{o}}
\\DeclareUnicodeCharacter{1EE3}{\\d{o}}
\\DeclareUnicodeCharacter{00FA}{\\'{u}}
\\DeclareUnicodeCharacter{00F9}{\\\x60{u}}
\\DeclareUnicodeCharacter{1EE7}{\\h{u}}
\\DeclareUnicodeCharacter{0169}{\\~{u}}
\\DeclareUnicodeCharacter{1EE5}{\\d{u}}
\\DeclareUnicodeCharacter{01B0}{\\^{u}}
\\DeclareUnicodeCharacter{1EE9}{\\'{u}}
\\DeclareUnicodeCharacter{1EEB}{\\\x60{u}}
\\DeclareUnicodeCharacter{1EED}{\\^{u}}
\\DeclareUnicodeCharacter{1EEF}{\\~{u}}
\\DeclareUnicodeCharacter{1EF1}{\\d{u}}
\\DeclareUnicodeCharacter{00FD}{\\'{y}}
\\DeclareUnicodeCharacter{1EF3}{\\\x60{y}}
\\DeclareUnicodeCharacter{1EF7}{\\h{y}}
\\DeclareUnicodeCharacter{1EF9}{\\~{y}}
\\DeclareUnicodeCharacter{1EF5}{\\d{y}}
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

    if (injections) {
      doc = doc.replace('\\begin{document}', `${injections}\\begin{document}`);
    }
    return doc;
  }

  return `\\documentclass[tikz,border=10pt]{standalone}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath,amssymb}
\\usepackage{pgfplots}
\\pgfplotsset{compat=1.18}
\\usepackage{tkz-tab}
\\usepackage{tkz-euclide}
\\usetikzlibrary{arrows.meta,automata,backgrounds,calc,decorations.pathmorphing,intersections,matrix,patterns,positioning,shapes.geometric}
${VIETNAMESE_DECLS}
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
