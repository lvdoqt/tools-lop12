import { useState } from 'react';
import { api } from '../api';
import { useFileResult } from '../useFileResult';
import { ToastContainer, useToast } from '../components/Toast';

const SAMPLE_TEX = String.raw`\documentclass[tikz,border=8pt]{standalone}
\usepackage[T5]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage[vietnamese]{babel}
\usetikzlibrary{arrows.meta,positioning,shapes.geometric}
\begin{document}
\begin{tikzpicture}[
  box/.style={rectangle,rounded corners,draw=purple!70!black,fill=purple!10,minimum width=30mm,minimum height=10mm,align=center},
  arrow/.style={-{Stealth[length=3mm]},thick}, node distance=14mm
]
  \node[box] (start) {Bắt đầu};
  \node[box,below=of start] (task) {Xử lý dữ liệu};
  \node[box,below=of task] (end) {Kết thúc};
  \draw[arrow] (start) -- (task);
  \draw[arrow] (task) -- (end);
\end{tikzpicture}
\end{document}`;

function extractTex(input) {
  const trimmed = input.trim();
  if (!trimmed.startsWith('{')) return trimmed;
  let value;
  try {
    value = JSON.parse(trimmed);
  } catch {
    throw new Error('JSON không hợp lệ. Hãy dùng một trong các trường: tex, source, latex hoặc tikz.');
  }
  if (typeof value === 'string') return value;
  for (const key of ['tex', 'source', 'latex', 'tikz']) {
    if (typeof value?.[key] === 'string' && value[key].trim()) {
      const code = value[key].trim();
      return key === 'tikz' && !code.includes('\\begin{tikzpicture}')
        ? `\\begin{tikzpicture}\n${code}\n\\end{tikzpicture}`
        : code;
    }
  }
  throw new Error('JSON cần có trường tex, source, latex hoặc tikz chứa mã LaTeX.');
}

export default function TexToPdfPage() {
  const [input, setInput] = useState(() => localStorage.getItem('tools-all-tex-draft') || SAMPLE_TEX);
  const [result, setResult] = useFileResult();
  const [loading, setLoading] = useState(false);
  const { toasts, addToast } = useToast();

  const compile = async () => {
    let source;
    try {
      source = extractTex(input);
    } catch (error) {
      addToast(error.message, 'error', 6000);
      return;
    }
    if (!source) return addToast('Hãy nhập mã TeX hoặc JSON.', 'warning');
    setLoading(true);
    setResult(null);
    try {
      const data = await api.renderTikz(source, 180);
      setResult(data);
      addToast('Đã biên dịch. Hãy xem lại bản PDF rồi nhấn “Lưu PDF”.', 'success');
    } catch (error) {
      setResult(null);
      addToast(error.message, 'error', 7000);
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = () => {
    localStorage.setItem('tools-all-tex-draft', input);
    addToast('Đã lưu bản nháp trên trình duyệt.', 'success');
  };

  return (
    <main className="main-content">
      <div className="tool-page tikz-page">
        <div className="tool-header">
          <div className="tool-header-icon tikz-header-icon">TeX</div>
          <h1>TeX <span className="gradient-text">→ PDF</span></h1>
          <p>Biên dịch tài liệu LaTeX, bao gồm TikZ. Có thể dán trực tiếp mã TeX hoặc JSON có trường <code>tex</code>, <code>source</code>, <code>latex</code> hay <code>tikz</code>.</p>
        </div>

        <div className="tikz-workspace">
          <section className="glass-panel tikz-code-panel">
            <div className="tikz-panel-heading">
              <div><strong>Mã TeX hoặc JSON</strong><span>{input.length.toLocaleString()} / 20.000 ký tự</span></div>
              <div className="tikz-heading-actions">
                <button className="tool-btn" disabled={loading} onClick={() => { setInput(SAMPLE_TEX); setResult(null); }}>Mẫu TikZ</button>
                <button className="tool-btn" onClick={saveDraft}>Lưu mã</button>
              </div>
            </div>
            <textarea className="tikz-textarea" value={input} disabled={loading} onChange={event => { setInput(event.target.value); setResult(null); }} spellCheck="false" />
            <div className="tikz-compile-bar">
              <span className="tex-hint">Biên dịch để xem trước, nhấn “Lưu PDF” khi đã kiểm tra xong.</span>
              <button className="btn btn-primary" onClick={compile} disabled={loading || input.length > 20000}>
                {loading ? <><span className="spinner" /> Đang biên dịch...</> : 'Biên dịch PDF'}
              </button>
            </div>
          </section>

          <section className="glass-panel tikz-preview-panel">
            <div className="tikz-panel-heading"><div><strong>Xem trước PDF</strong><span>{loading ? 'Đang biên dịch tài liệu...' : result ? 'Kiểm tra nội dung trước khi lưu PDF' : 'Chưa có kết quả'}</span></div></div>
            <div className="tex-pdf-preview" aria-busy={loading}>
              {result ? <iframe title="Xem trước PDF TeX" src={result.pdf_preview_url} /> : <div className="tikz-empty"><span>PDF</span><p>{loading ? 'Đang biên dịch, vui lòng chờ...' : 'Nhấn “Biên dịch PDF” để xem tài liệu'}</p></div>}
            </div>
            {result && <div className="tikz-downloads">
              <a className="btn btn-secondary" href={result.downloads.tex} download="document.tex">Tải TEX</a>
              <a className="btn btn-success" href={result.downloads.pdf} download="document.pdf">Lưu PDF</a>
            </div>}
          </section>
        </div>
      </div>
      <ToastContainer toasts={toasts} />
    </main>
  );
}
