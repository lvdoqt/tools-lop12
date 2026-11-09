import { useCallback, useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { api, releaseResult } from '../api';
import { useFileResult } from '../useFileResult';
import { ToastContainer, useToast } from '../components/Toast';
import { fetchKrokiPdf, renderTikzWithKroki, svgToPngBlob } from '../lib/krokiTikz';

const TEMPLATES = [
  {
    id: 'flowchart',
    label: 'Sơ đồ khối (Flowchart)',
    source: String.raw`\documentclass[tikz,border=8pt]{standalone}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
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
\end{document}`,
  },
  {
    id: 'variation',
    label: 'Bảng biến thiên (tkz-tab)',
    source: String.raw`\begin{tikzpicture}
  \tkzTabInit[lgt=1.5, espcl=2.5, deltacl=0.6]
    {$x$ / 0.8, $y'$ / 0.8, $y$ / 2.2}
    {$-\infty$, $x_1$, $x_2$, $+\infty$}
  \tkzTabLine{, +, 0, -, 0, +, }
  \tkzTabVar{-/ $-\infty$, +/ $y_{\text{CĐ}}$, -/ $y_{\text{CT}}$, +/ $+\infty$}
\end{tikzpicture}`,
  },
  {
    id: 'euclide',
    label: 'Hình phẳng (tkz-euclide)',
    source: String.raw`\begin{tikzpicture}[scale=1]
  \tkzDefPoint(0,0){A}
  \tkzDefPoint(4,0){B}
  \tkzDefPoint(1,3){C}
  \tkzDrawPolygon[thick,fill=teal!10](A,B,C)
  \tkzDrawPoints[size=4,fill=red](A,B,C)
  \tkzLabelPoints[below left](A)
  \tkzLabelPoints[below right](B)
  \tkzLabelPoints[above](C)
\end{tikzpicture}`,
  },
  {
    id: 'pgfplots',
    label: 'Đồ thị toạ độ (pgfplots)',
    source: String.raw`\begin{tikzpicture}
  \begin{axis}[
    width=8cm, height=6cm,
    axis lines=middle,
    xlabel={$x$}, ylabel={$y$},
    xmin=-3, xmax=3, ymin=-2, ymax=6,
    grid=both, grid style={line width=.1pt, draw=gray!20},
    samples=100
  ]
    \addplot[blue,thick,domain=-2.4:2.4] {x^2 - 1};
    \addlegendentry{$y = x^2 - 1$}
  \end{axis}
\end{tikzpicture}`,
  },
  {
    id: 'pyramid',
    label: 'Hình không gian',
    source: String.raw`\begin{tikzpicture}[scale=1]
  \coordinate (A) at (0,0); \coordinate (B) at (3.8,0);
  \coordinate (C) at (5,1.35); \coordinate (D) at (1.2,1.35); \coordinate (S) at (2.5,4);
  \draw[thick] (A)--(B)--(C)--(D)--cycle;
  \draw[thick] (S)--(A) (S)--(B) (S)--(C); \draw[thick,dashed] (S)--(D);
  \foreach \p/\pos in {A/below left,B/below right,C/right,D/left,S/above}
    \fill (\p) circle (1.5pt) node[\pos] {$\p$};
\end{tikzpicture}`,
  },
];

const SAMPLE_TEX = TEMPLATES[0].source;
const ZOOM_LEVELS = [25, 50, 75, 100, 125, 150, 200, 300, 400];

export function extractTex(input) {
  const trimmed = (input || '').trim();
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
  const [input, setInput] = useState(() => {
    try {
      return localStorage.getItem('tools-all-tex-draft') || SAMPLE_TEX;
    } catch {
      return SAMPLE_TEX;
    }
  });
  const [dpi, setDpi] = useState(180);
  const [autoRender, setAutoRender] = useState(false);
  const [previewTab, setPreviewTab] = useState('image'); // 'image' | 'pdf'
  const [zoom, setZoom] = useState(100);
  const [svgText, setSvgText] = useState(null);
  const [compileStatus, setCompileStatus] = useState('idle'); // 'idle' | 'rendering' | 'success' | 'error'
  const [compileError, setCompileError] = useState(null);
  const [result, setResult] = useFileResult();
  const [loading, setLoading] = useState(false);
  const { toasts, addToast } = useToast();

  const abortControllerRef = useRef(null);
  const currentRenderIdRef = useRef(0);

  // Autosave draft in localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('tools-all-tex-draft', input);
      } catch {
        /* ignore storage error */
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [input]);

  // Core render implementation via Kroki TeX Engine + backend fallback
  const executeRender = useCallback(async (codeToRender, targetDpi, isAutomatic = false) => {
    let source;
    try {
      source = extractTex(codeToRender);
    } catch (error) {
      if (!isAutomatic) addToast(error.message, 'error', 6000);
      setCompileStatus('error');
      setCompileError(error.message);
      return;
    }

    const trimmed = (source || '').trim();
    if (!trimmed) {
      if (!isAutomatic) addToast('Hãy nhập mã TeX, TikZ hoặc JSON.', 'warning');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const renderId = ++currentRenderIdRef.current;
    setLoading(true);
    setCompileStatus('rendering');

    try {
      const outputId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `tex-${Date.now()}`;
      const objectUrls = [];
      let svg = null;
      let downloads = {};

      try {
        // Fast path: direct Kroki TeX Engine call from browser
        const krokiRes = await renderTikzWithKroki(trimmed, { signal: abortController.signal });
        svg = krokiRes.svg;

        const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        objectUrls.push(svgUrl);
        downloads.svg = svgUrl;

        const texBlob = new Blob([trimmed], { type: 'application/x-tex;charset=utf-8' });
        const texUrl = URL.createObjectURL(texBlob);
        objectUrls.push(texUrl);
        downloads.tex = texUrl;

        // Render high-DPI PNG via browser Canvas
        try {
          const pngBlob = await svgToPngBlob(svg, targetDpi);
          if (pngBlob) {
            const pngUrl = URL.createObjectURL(pngBlob);
            objectUrls.push(pngUrl);
            downloads.png = pngUrl;
          }
        } catch {
          // PNG conversion non-fatal for preview
        }

        // Fetch vector PDF from Kroki TeX Engine
        try {
          const pdfBlob = await fetchKrokiPdf(krokiRes.document, { signal: abortController.signal });
          if (pdfBlob) {
            const pdfUrl = URL.createObjectURL(pdfBlob);
            objectUrls.push(pdfUrl);
            downloads.pdf = pdfUrl;
          }
        } catch {
          // PDF fetch non-fatal
        }
      } catch (krokiErr) {
        if (abortController.signal.aborted) return;
        // Fallback to backend /api/tikz/render
        try {
          const backendData = await api.renderTikz(trimmed, targetDpi);
          if (renderId !== currentRenderIdRef.current) {
            releaseResult(backendData);
            return;
          }
          downloads = backendData.downloads || {};
          if (downloads.svg) {
            svg = await (await fetch(downloads.svg)).text();
          }
          (backendData.objectUrls || []).forEach(url => objectUrls.push(url));
        } catch {
          // Both failed, throw kroki error
          throw krokiErr;
        }
      }

      if (renderId !== currentRenderIdRef.current) {
        objectUrls.forEach(url => URL.revokeObjectURL(url));
        return;
      }

      setSvgText(svg);
      setCompileError(null);
      setCompileStatus('success');

      const fileResult = {
        output_id: outputId,
        preview_url: downloads.svg || downloads.png,
        pdf_preview_url: downloads.pdf,
        downloads,
        objectUrls,
      };

      setResult(fileResult);

      if (!isAutomatic) {
        addToast('✅ Đã biên dịch TeX/TikZ thành ảnh và PDF', 'success');
      }
    } catch (err) {
      if (abortController.signal.aborted) return;
      if (renderId === currentRenderIdRef.current) {
        setCompileStatus('error');
        setCompileError(err.message || 'Lỗi biên dịch TeX / TikZ');
        if (!isAutomatic) {
          addToast(`❌ ${err.message}`, 'error', 6000);
        }
      }
    } finally {
      if (renderId === currentRenderIdRef.current) {
        setLoading(false);
      }
    }
  }, [addToast, setResult]);

  // Optional auto-render debounce
  useEffect(() => {
    if (!autoRender) return;
    const timer = setTimeout(() => {
      executeRender(input, dpi, true);
    }, 700);
    return () => clearTimeout(timer);
  }, [input, dpi, autoRender, executeRender]);

  const handleManualCompile = () => {
    executeRender(input, dpi, false);
  };

  const loadTemplate = (template) => {
    setInput(template.source);
    setCompileError(null);
  };

  const saveDraft = () => {
    try {
      localStorage.setItem('tools-all-tex-draft', input);
      addToast('💾 Đã lưu bản nháp trên trình duyệt', 'success');
    } catch {
      addToast('Không lưu được bản nháp trên trình duyệt.', 'error');
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => {
      const next = ZOOM_LEVELS.find(lvl => lvl > prev);
      return next || Math.min(500, prev + 25);
    });
  };

  const handleZoomOut = () => {
    setZoom(prev => {
      const reversed = [...ZOOM_LEVELS].reverse();
      const next = reversed.find(lvl => lvl < prev);
      return next || Math.max(25, prev - 25);
    });
  };

  const handleResetZoom = () => setZoom(100);

  const handleWheelZoom = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) handleZoomIn();
      else handleZoomOut();
    }
  };

  const sanitizedSvg = svgText
    ? DOMPurify.sanitize(svgText, { USE_PROFILES: { svg: true, svgFilters: true } })
    : null;

  return (
    <main className="main-content">
      <div className="tool-page tikz-page">
        <div className="tool-header">
          <div className="tool-header-icon tikz-header-icon">TeX</div>
          <h1>TeX <span className="gradient-text">→ PDF & Ảnh</span></h1>
          <p>
            Biên dịch mã LaTeX, TikZ thành ảnh vector <strong>SVG (.svg)</strong>, ảnh <strong>PNG</strong> sắc nét và tài liệu <strong>PDF (.pdf)</strong> qua <strong>Kroki TeX Engine</strong>. Có thể dán trực tiếp mã TeX, TikZ hoặc JSON có trường <code>tex</code>, <code>source</code>, <code>latex</code> hay <code>tikz</code>.
          </p>
        </div>

        {/* Quick templates */}
        <section className="tikz-templates" aria-label="Mẫu TeX và TikZ có sẵn">
          <span className="tikz-templates-label">Mẫu nhanh:</span>
          {TEMPLATES.map(template => (
            <button
              key={template.id}
              type="button"
              className="tool-btn tikz-template-btn"
              onClick={() => loadTemplate(template)}
              title={template.label}
            >
              {template.label}
            </button>
          ))}
        </section>

        <div className="tikz-workspace">
          {/* Left panel: Code Editor */}
          <section className="glass-panel tikz-code-panel">
            <div className="tikz-panel-heading">
              <div>
                <strong>Mã TeX, TikZ hoặc JSON</strong>
                <span>{input.length.toLocaleString()} / 20.000 ký tự</span>
              </div>
              <div className="tikz-heading-actions">
                <label className="tikz-autorender-toggle" title="Tự động vẽ khi sửa mã">
                  <input
                    type="checkbox"
                    checked={autoRender}
                    onChange={e => setAutoRender(e.target.checked)}
                  />
                  <span>⚡ Tự động vẽ</span>
                </label>
                <button
                  type="button"
                  className="tool-btn"
                  disabled={loading}
                  onClick={() => loadTemplate(TEMPLATES[0])}
                >
                  Mẫu mặc định
                </button>
                <button type="button" className="tool-btn" onClick={saveDraft}>
                  💾 Lưu mã
                </button>
              </div>
            </div>

            <textarea
              className="tikz-textarea"
              value={input}
              disabled={loading}
              onChange={event => {
                setInput(event.target.value);
              }}
              spellCheck="false"
              placeholder="Dán mã LaTeX/TikZ hoặc JSON { 'tex': '...' } tại đây..."
            />

            <div className="tikz-compile-bar">
              <label>DPI PNG:
                <select value={dpi} onChange={e => setDpi(Number(e.target.value))}>
                  <option value="120">120 DPI</option>
                  <option value="180">180 DPI (chuẩn)</option>
                  <option value="240">240 DPI</option>
                  <option value="300">300 DPI (sắc nét)</option>
                </select>
              </label>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleManualCompile}
                disabled={loading || input.length > 20000}
              >
                {loading ? <><span className="spinner" /> Đang vẽ Kroki...</> : '▶ Biên dịch ngay'}
              </button>
            </div>

            {compileError && (
              <div className="tikz-error-banner" role="alert">
                <strong>⚠️ Lỗi biên dịch:</strong> {compileError}
              </div>
            )}

            <div className="alert alert-info tikz-privacy">
              <span>⚡</span>
              <span>
                Sử dụng công nghệ vẽ <strong>Kroki TeX Engine</strong> như TikZ Editor — tự động hỗ trợ tiếng Việt, <code>tkz-tab</code>, <code>tkz-euclide</code>, <code>pgfplots</code> và xuất đầy đủ <strong>SVG, PNG, PDF</strong>.
              </span>
            </div>
          </section>

          {/* Right panel: Preview & Downloads */}
          <section className="glass-panel tikz-preview-panel">
            <div className="tikz-panel-heading">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <strong>Xem trước</strong>
                {result && (
                  <div className="tex-preview-mode-switch" style={{ display: 'inline-flex', gap: '4px' }}>
                    <button
                      type="button"
                      className="tool-btn"
                      style={previewTab === 'image' ? { background: '#7c3aed', color: '#fff', borderColor: '#7c3aed', fontWeight: 700 } : {}}
                      onClick={() => setPreviewTab('image')}
                    >
                      🖼 Ảnh (SVG)
                    </button>
                    <button
                      type="button"
                      className="tool-btn"
                      style={previewTab === 'pdf' ? { background: '#7c3aed', color: '#fff', borderColor: '#7c3aed', fontWeight: 700 } : {}}
                      onClick={() => setPreviewTab('pdf')}
                    >
                      📄 Tài liệu PDF
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {compileStatus === 'rendering' ? (
                  <span className="tikz-engine-badge is-loading">⚡ Đang vẽ qua Kroki...</span>
                ) : compileStatus === 'error' ? (
                  <span className="tikz-engine-badge is-error">⚠️ Có lỗi cú pháp</span>
                ) : result ? (
                  <span className="tikz-engine-badge">✓ Kroki TeX (Ảnh & PDF)</span>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Chưa có kết quả</span>
                )}

                {result && previewTab === 'image' && (
                  <div className="tikz-zoom-toolbar" aria-label="Công cụ phóng to ảnh">
                    <button
                      type="button"
                      className="tool-btn tikz-zoom-btn"
                      onClick={handleZoomOut}
                      title="Thu nhỏ (−)"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="tool-btn tikz-zoom-btn tikz-zoom-reset"
                      onClick={handleResetZoom}
                      title="Nhấn để đặt lại 100%"
                    >
                      {zoom}%
                    </button>
                    <button
                      type="button"
                      className="tool-btn tikz-zoom-btn"
                      onClick={handleZoomIn}
                      title="Phóng to giữ nét (+)"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="tool-btn tikz-zoom-btn"
                      onClick={handleResetZoom}
                      title="Khôi phục kích thước 100%"
                    >
                      ⛶
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Preview content based on active tab */}
            {previewTab === 'image' ? (
              <div
                className={`tikz-canvas ${result ? 'has-result' : ''}`}
                onWheel={handleWheelZoom}
                title={result ? 'Giữ phím Ctrl và cuộn chuột để phóng to/thu nhỏ' : ''}
              >
                {result ? (
                  <div
                    className="tikz-zoom-container"
                    style={{
                      transform: `scale(${zoom / 100})`,
                      transformOrigin: 'center center',
                    }}
                  >
                    {sanitizedSvg ? (
                      <div
                        className="tikz-svg-render"
                        dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
                      />
                    ) : (
                      <img
                        src={result.downloads.svg || result.preview_url}
                        alt="Kết quả ảnh TikZ"
                      />
                    )}
                  </div>
                ) : (
                  <div className="tikz-empty">
                    <span>△</span>
                    <p>Nhấn “Biên dịch ngay” để vẽ ảnh và tạo PDF</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="tex-pdf-preview" aria-busy={loading}>
                {result?.downloads?.pdf || result?.pdf_preview_url ? (
                  <iframe
                    title="Xem trước PDF TeX"
                    src={result.downloads.pdf || result.pdf_preview_url}
                  />
                ) : (
                  <div className="tikz-empty">
                    <span>📄</span>
                    <p>{loading ? 'Đang tạo PDF, vui lòng chờ...' : 'Chưa có bản xem trước PDF (bạn có thể tải trực tiếp file PDF bên dưới)'}</p>
                  </div>
                )}
              </div>
            )}

            {/* Download Buttons */}
            {result && (
              <div className="tikz-downloads">
                {result.downloads.svg && (
                  <a
                    className="btn btn-primary tikz-download-svg"
                    href={result.downloads.svg}
                    download="diagram.svg"
                    target="_blank"
                    rel="noreferrer"
                    title="Tải ảnh vector SVG nét tuyệt đối khi phóng to"
                  >
                    ★ Tải SVG (.svg)
                  </a>
                )}
                {result.downloads.png && (
                  <a
                    className="btn btn-secondary"
                    href={result.downloads.png}
                    download="diagram.png"
                    title="Tải ảnh PNG"
                  >
                    ⬇ Tải PNG
                  </a>
                )}
                {result.downloads.pdf && (
                  <a
                    className="btn btn-success"
                    href={result.downloads.pdf}
                    download="document.pdf"
                    title="Tải tài liệu PDF"
                  >
                    ⬇ Lưu PDF
                  </a>
                )}
                {result.downloads.tex && (
                  <a
                    className="btn btn-secondary"
                    href={result.downloads.tex}
                    download="document.tex"
                    title="Tải mã nguồn TeX"
                  >
                    Tải TEX
                  </a>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
      <ToastContainer toasts={toasts} />
    </main>
  );
}
