import { useCallback, useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { api, releaseResult } from '../api';
import { useFileResult } from '../useFileResult';
import { ToastContainer, useToast } from '../components/Toast';
import TikzLibrary from '../components/TikzLibrary';
import { fetchKrokiPdf, renderTikzWithKroki, svgToPngBlob } from '../lib/krokiTikz';

const TEMPLATES = [
  {
    id: 'variation',
    label: 'Bảng biến thiên (tkz-tab)',
    source: `\\begin{tikzpicture}
  \\tkzTabInit[lgt=1.5, espcl=2.5, deltacl=0.6]
    {$x$ / 0.8, $y'$ / 0.8, $y$ / 2.2}
    {$-\\infty$, $x_1$, $x_2$, $+\\infty$}
  \\tkzTabLine{, +, 0, -, 0, +, }
  \\tkzTabVar{-/ $-\\infty$, +/ $y_{\\text{CĐ}}$, -/ $y_{\\text{CT}}$, +/ $+\\infty$}
\\end{tikzpicture}`,
  },
  {
    id: 'euclide',
    label: 'Hình phẳng (tkz-euclide)',
    source: `\\begin{tikzpicture}[scale=1]
  \\tkzDefPoint(0,0){A}
  \\tkzDefPoint(4,0){B}
  \\tkzDefPoint(1,3){C}
  \\tkzDrawPolygon[thick,fill=teal!10](A,B,C)
  \\tkzDrawPoints[size=4,fill=red](A,B,C)
  \\tkzLabelPoints[below left](A)
  \\tkzLabelPoints[below right](B)
  \\tkzLabelPoints[above](C)
\\end{tikzpicture}`,
  },
  {
    id: 'pgfplots',
    label: 'Đồ thị toạ độ (pgfplots)',
    source: `\\begin{tikzpicture}
  \\begin{axis}[
    width=8cm, height=6cm,
    axis lines=middle,
    xlabel={$x$}, ylabel={$y$},
    xmin=-3, xmax=3, ymin=-2, ymax=6,
    grid=both, grid style={line width=.1pt, draw=gray!20},
    samples=100
  ]
    \\addplot[blue,thick,domain=-2.4:2.4] {x^2 - 1};
    \\addlegendentry{$y = x^2 - 1$}
  \\end{axis}
\\end{tikzpicture}`,
  },
  {
    id: 'quadratic',
    label: 'Hàm bậc 2',
    source: `\\begin{tikzpicture}[scale=1.2]
  \\draw[->] (-0.5,0) -- (4.5,0) node[right] {$x$};
  \\draw[->] (0,-0.5) -- (0,3.5) node[above] {$y$};
  \\draw[thick,blue,domain=0:4,samples=100]
    plot (\\x,{0.18*(\\x-2)^2+1});
  \\fill[orange] (2,1) circle (2pt) node[below right] {$A(2,1)$};
\\end{tikzpicture}`,
  },
  {
    id: 'cubic',
    label: 'Hàm bậc 3',
    source: `\\begin{tikzpicture}[scale=1.05]
  \\draw[->] (-3.4,0) -- (3.5,0) node[right] {$x$};
  \\draw[->] (0,-3) -- (0,3.4) node[above] {$y$};
  \\draw[thick,blue,domain=-3:3,samples=120] plot (\\x,{0.18*\\x*\\x*\\x-1.2*\\x});
  \\node[blue] at (2.25,2.1) {$y=0.18x^3-1.2x$};
\\end{tikzpicture}`,
  },
  {
    id: 'pyramid',
    label: 'Hình chóp',
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
    id: 'flowchart',
    label: 'Sơ đồ khối',
    source: `\\begin{tikzpicture}[node distance=16mm, box/.style={rectangle,rounded corners,draw=purple!70!black,fill=purple!10,minimum width=29mm,minimum height=10mm,align=center},arrow/.style={-{Stealth[length=3mm]},thick}]
  \\node[box] (start) {Bắt đầu}; \\node[box,below=of start] (input) {Nhập dữ liệu};
  \\node[box,below=of input] (process) {Xử lý}; \\node[box,below=of process] (end) {Kết thúc};
  \\draw[arrow] (start) -- (input); \\draw[arrow] (input) -- (process); \\draw[arrow] (process) -- (end);
\\end{tikzpicture}`,
  },
];

const SAMPLE = TEMPLATES[0].source;
const ZOOM_LEVELS = [25, 50, 75, 100, 125, 150, 200, 300, 400];

export default function TikzEditorPage() {
  const [source, setSource] = useState(() => {
    try { return localStorage.getItem('tools-all-tikz-draft') || SAMPLE; } catch { return SAMPLE; }
  });
  const [compiled, setCompiled] = useState(null);
  const [dpi, setDpi] = useState(180);
  const [autoRender, setAutoRender] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [svgText, setSvgText] = useState(null);
  const [compileStatus, setCompileStatus] = useState('idle'); // 'idle' | 'rendering' | 'success' | 'error'
  const [compileError, setCompileError] = useState(null);
  const [result, setResult] = useFileResult();
  const [loading, setLoading] = useState(false);
  const { toasts, addToast } = useToast();

  const abortControllerRef = useRef(null);
  const currentRenderIdRef = useRef(0);

  // Autosave draft
  useEffect(() => {
    const timer = setTimeout(() => {
      try { localStorage.setItem('tools-all-tikz-draft', source); } catch { /* Manual save reports storage errors */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [source]);

  // Core render implementation via Kroki TeX Engine
  const executeRender = useCallback(async (codeToRender, targetDpi, isAutomatic = false) => {
    const trimmed = (codeToRender || '').trim();
    if (!trimmed) {
      if (!isAutomatic) addToast('⚠️ Hãy nhập mã TikZ.', 'warning');
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
      const outputId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `tikz-${Date.now()}`;
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

        // Try getting high-DPI PNG and vector PDF in background
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
          // If both fail, rethrow original Kroki error
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
        downloads,
        objectUrls,
      };

      setResult(fileResult);
      setCompiled({ source: trimmed, dpi: targetDpi, svg, id: outputId });

      if (!isAutomatic) {
        addToast('✅ Đã render hình TikZ (Kroki SVG)', 'success');
      }
    } catch (err) {
      if (abortController.signal.aborted) return;
      if (renderId === currentRenderIdRef.current) {
        setCompileStatus('error');
        setCompileError(err.message || 'Lỗi biên dịch TikZ');
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

  // Debounced auto-render when source or DPI changes
  useEffect(() => {
    if (!autoRender) return;
    const timer = setTimeout(() => {
      executeRender(source, dpi, true);
    }, 700);

    return () => clearTimeout(timer);
  }, [source, dpi, autoRender, executeRender]);

  // Manual render trigger
  const handleManualRender = () => {
    executeRender(source, dpi, false);
  };

  const loadTemplate = template => {
    setSource(template.source);
    setCompileError(null);
  };

  const saveDraft = () => {
    try {
      localStorage.setItem('tools-all-tikz-draft', source);
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

  const handleWheelZoom = e => {
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
          <div className="tool-header-icon tikz-header-icon">△</div>
          <h1>TikZ <span className="gradient-text">Editor</span></h1>
          <p>
            Biên dịch hình TikZ tự động qua <strong>Kroki TeX Engine</strong> thành vector <strong>SVG (.svg)</strong> giữ nét khi phóng to, hỗ trợ <code>tkz-tab</code>, <code>tkz-euclide</code>, <code>pgfplots</code>.
          </p>
        </div>

        <section className="tikz-templates" aria-label="Mẫu TikZ có sẵn">
          <span className="tikz-templates-label">Mẫu nhanh:</span>
          {TEMPLATES.map(template => (
            <button
              className="tool-btn tikz-template-btn"
              key={template.id}
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
                <strong>Mã LaTeX / TikZ</strong>
                <span>{source.length.toLocaleString()} / 20.000 ký tự</span>
              </div>
              <div className="tikz-heading-actions">
                <label className="tikz-autorender-toggle" title="Tự động biên dịch sau khi sửa mã">
                  <input
                    type="checkbox"
                    checked={autoRender}
                    onChange={e => setAutoRender(e.target.checked)}
                  />
                  <span>⚡ Tự động vẽ</span>
                </label>
                <button className="tool-btn" onClick={() => loadTemplate(TEMPLATES[0])}>Mẫu</button>
                <button className="tool-btn" onClick={saveDraft}>💾 Lưu mã</button>
              </div>
            </div>

            <textarea
              className="tikz-textarea"
              value={source}
              onChange={e => setSource(e.target.value)}
              spellCheck="false"
              placeholder="Dán mã \begin{tikzpicture} ... \end{tikzpicture} tại đây..."
            />

            <div className="tikz-compile-bar">
              <label>DPI PNG
                <select value={dpi} onChange={e => setDpi(Number(e.target.value))}>
                  <option value="120">120 DPI</option>
                  <option value="180">180 DPI (chuẩn)</option>
                  <option value="240">240 DPI</option>
                  <option value="300">300 DPI (sắc nét)</option>
                </select>
              </label>

              <button
                className="btn btn-primary"
                onClick={handleManualRender}
                disabled={loading || source.length > 20000}
              >
                {loading ? <><span className="spinner" /> Đang vẽ Kroki...</> : '▶ Vẽ ngay'}
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
                Render tự động qua <strong>Kroki TeX Engine</strong> thành vector <strong>SVG (.svg)</strong> — phóng to không vỡ nét. Tương thích <code>tkz-tab</code>, <code>tkz-euclide</code>, <code>pgfplots</code> và nhãn tiếng Việt.
              </span>
            </div>
          </section>

          {/* Right panel: SVG Preview & Zoom Controls */}
          <section className="glass-panel tikz-preview-panel">
            <div className="tikz-panel-heading">
              <div>
                <strong>Xem trước SVG</strong>
                <span>
                  {compileStatus === 'rendering' ? (
                    <span className="tikz-engine-badge is-loading">⚡ Đang vẽ qua Kroki...</span>
                  ) : compileStatus === 'error' ? (
                    <span className="tikz-engine-badge is-error">⚠️ Có lỗi cú pháp</span>
                  ) : result ? (
                    <span className="tikz-engine-badge">✓ Kroki TeX SVG (giữ nét vector)</span>
                  ) : (
                    'Chưa có kết quả'
                  )}
                </span>
              </div>

              {result && (
                <div className="tikz-zoom-toolbar" aria-label="Công cụ phóng to">
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
                      alt="Kết quả TikZ SVG"
                    />
                  )}
                </div>
              ) : (
                <div className="tikz-empty">
                  <span>△</span>
                  <p>Nhập mã TikZ để tự động vẽ hình qua Kroki TeX Engine</p>
                </div>
              )}
            </div>

            {result && (
              <div className="tikz-downloads">
                {result.downloads.svg && (
                  <a
                    className="btn btn-primary tikz-download-svg"
                    href={result.downloads.svg}
                    download="tikz-diagram.svg"
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
                    download="tikz-diagram.png"
                  >
                    ⬇ Tải PNG
                  </a>
                )}
                {result.downloads.pdf && (
                  <a
                    className="btn btn-secondary"
                    href={result.downloads.pdf}
                    download="tikz-diagram.pdf"
                  >
                    Tải PDF
                  </a>
                )}
                <a
                  className="btn btn-secondary"
                  href={result.downloads.tex}
                  download="tikz-diagram.tex"
                >
                  Tải TEX
                </a>
              </div>
            )}
          </section>
        </div>

        <TikzLibrary
          compiled={compiled}
          addToast={addToast}
          onOpen={drawing => {
            setSource(drawing.source);
            setDpi(drawing.dpi || 180);
            setCompiled(null);
            setSvgText(null);
            setZoom(100);
            const tex = URL.createObjectURL(new Blob([drawing.source], { type: 'application/x-tex;charset=utf-8' }));
            setResult({
              preview_url: drawing.svg_url,
              downloads: { svg: drawing.svg_url, png: drawing.png_url, tex },
              objectUrls: [tex],
            });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      </div>
      <ToastContainer toasts={toasts} />
    </main>
  );
}
