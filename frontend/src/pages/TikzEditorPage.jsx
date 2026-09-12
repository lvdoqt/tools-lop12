import { useState } from 'react';
import { api } from '../api';
import { useFileResult } from '../useFileResult';
import { ToastContainer, useToast } from '../components/Toast';

const TEMPLATES = [
  {
    id: 'quadratic', label: 'Hàm bậc 2',
    source: `\\begin{tikzpicture}[scale=1.2]
  \\draw[->] (-0.5,0) -- (4.5,0) node[right] {$x$};
  \\draw[->] (0,-0.5) -- (0,3.5) node[above] {$y$};
  \\draw[thick,blue,domain=0:4,samples=100]
    plot (\\x,{0.18*(\\x-2)^2+1});
  \\fill[orange] (2,1) circle (2pt) node[below right] {$A(2,1)$};
\\end{tikzpicture}`,
  },
  {
    id: 'cubic', label: 'Hàm bậc 3',
    source: `\\begin{tikzpicture}[scale=1.05]
  \\draw[->] (-3.4,0) -- (3.5,0) node[right] {$x$};
  \\draw[->] (0,-3) -- (0,3.4) node[above] {$y$};
  \\draw[thick,blue,domain=-3:3,samples=120] plot (\\x,{0.18*\\x*\\x*\\x-1.2*\\x});
  \\node[blue] at (2.25,2.1) {$y=0.18x^3-1.2x$};
\\end{tikzpicture}`,
  },
  {
    id: 'pyramid', label: 'Hình chóp',
    source: `\\begin{tikzpicture}[scale=1]
  \\coordinate (A) at (0,0); \\coordinate (B) at (3.8,0);
  \\coordinate (C) at (5,1.35); \\coordinate (D) at (1.2,1.35); \\coordinate (S) at (2.5,4);
  \\draw[thick] (A)--(B)--(C)--(D)--cycle;
  \\draw[thick] (S)--(A) (S)--(B) (S)--(C); \\draw[thick,dashed] (S)--(D);
  \\foreach \\p/\\pos in {A/below left,B/below right,C/right,D/left,S/above}
    \\fill (\\p) circle (1.5pt) node[\\pos] {$\\p$};
\\end{tikzpicture}`,
  },
  {
    id: 'flowchart', label: 'Sơ đồ',
    source: `\\begin{tikzpicture}[node distance=16mm, box/.style={rectangle,rounded corners,draw=purple!70!black,fill=purple!10,minimum width=29mm,minimum height=10mm,align=center},arrow/.style={-{Stealth[length=3mm]},thick}]
  \\node[box] (start) {Bắt đầu}; \\node[box,below=of start] (input) {Nhập dữ liệu};
  \\node[box,below=of input] (process) {Xử lý}; \\node[box,below=of process] (end) {Kết thúc};
  \\draw[arrow] (start) -- (input); \\draw[arrow] (input) -- (process); \\draw[arrow] (process) -- (end);
\\end{tikzpicture}`,
  },
];

const SAMPLE = TEMPLATES[0].source;

export default function TikzEditorPage() {
  const [source, setSource] = useState(() => localStorage.getItem('tools-all-tikz-draft') || SAMPLE);
  const [dpi, setDpi] = useState(180);
  const [result, setResult] = useFileResult();
  const [loading, setLoading] = useState(false);
  const { toasts, addToast } = useToast();

  const render = async () => {
    if (!source.trim()) return addToast('⚠️ Hãy nhập mã TikZ.', 'warning');
    setLoading(true);
    try {
      const data = await api.renderTikz(source, dpi);
      setResult(data);
      addToast('✅ Đã vẽ hình TikZ', 'success');
    } catch (error) {
      setResult(null);
      addToast(`❌ ${error.message}`, 'error', 6000);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplate = template => {
    setSource(template.source);
    setResult(null);
  };
  const saveDraft = () => {
    localStorage.setItem('tools-all-tikz-draft', source);
    addToast('💾 Đã lưu bản nháp trên trình duyệt', 'success');
  };

  return (
    <main className="main-content">
      <div className="tool-page tikz-page">
        <div className="tool-header">
          <div className="tool-header-icon tikz-header-icon">△</div>
          <h1>TikZ <span className="gradient-text">Editor</span></h1>
          <p>Dán mã TikZ để biên dịch, xem trước và tải hình. Có thể nhập riêng môi trường tikzpicture hoặc cả tài liệu LaTeX.</p>
        </div>

        <section className="tikz-templates" aria-label="Mẫu TikZ có sẵn">
          <span className="tikz-templates-label">Mẫu nhanh</span>
          {TEMPLATES.map(template => (
            <button className="tool-btn tikz-template-btn" key={template.id} onClick={() => loadTemplate(template)}>
              {template.label}
            </button>
          ))}
        </section>

        <div className="tikz-workspace">
          <section className="glass-panel tikz-code-panel">
            <div className="tikz-panel-heading">
              <div><strong>Mã LaTeX / TikZ</strong><span>{source.length.toLocaleString()} / 20.000 ký tự</span></div>
              <div className="tikz-heading-actions">
                <button className="tool-btn" onClick={() => setSource(SAMPLE)}>Mẫu</button>
                <button className="tool-btn" onClick={saveDraft}>💾 Lưu mã</button>
              </div>
            </div>
            <textarea className="tikz-textarea" value={source} onChange={e => setSource(e.target.value)} spellCheck="false" />
            <div className="tikz-compile-bar">
              <label>DPI
                <select value={dpi} onChange={e => setDpi(Number(e.target.value))}>
                  <option value="120">120</option><option value="180">180</option><option value="240">240</option><option value="300">300</option>
                </select>
              </label>
              <button className="btn btn-primary" onClick={render} disabled={loading || source.length > 20000}>
                {loading ? <><span className="spinner" /> Đang biên dịch...</> : '▶ Vẽ hình'}
              </button>
            </div>
            <div className="alert alert-info tikz-privacy"><span>ℹ️</span><span>Mã được gửi đến dịch vụ LaTeX.Online để biên dịch. Kết quả được giữ trên trình duyệt; hãy tải file trước khi rời trang. Nếu kết quả quá lớn, hãy giảm DPI hoặc rút gọn tài liệu.</span></div>
          </section>

          <section className="glass-panel tikz-preview-panel">
            <div className="tikz-panel-heading"><div><strong>Xem trước</strong><span>{result ? 'Đã biên dịch thành công' : 'Chưa có kết quả'}</span></div></div>
            <div className={`tikz-canvas ${result ? 'has-result' : ''}`}>
              {result ? <img src={result.preview_url} alt="Kết quả TikZ" /> : <div className="tikz-empty"><span>△</span><p>Nhấn “Vẽ hình” để xem kết quả</p></div>}
            </div>
            {result && <div className="tikz-downloads">
              <a className="btn btn-secondary" href={result.downloads.tex} download="tikz-diagram.tex">Tải TEX</a>
              <a className="btn btn-secondary" href={result.downloads.pdf} download="tikz-diagram.pdf">Tải PDF</a>
              <a className="btn btn-success" href={result.downloads.png} download="tikz-diagram.png">⬇ Tải PNG</a>
            </div>}
          </section>
        </div>
      </div>
      <ToastContainer toasts={toasts} />
    </main>
  );
}
