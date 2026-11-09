import { useCallback, useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { api, releaseResult } from '../api';
import { useFileResult } from '../useFileResult';
import { ToastContainer, useToast } from '../components/Toast';
import {
  fetchKrokiPdf,
  isExamDocument,
  renderTikzWithKroki,
  svgToPngBlob,
} from '../lib/krokiTikz';
import './TexToPdfPage.css';

const TEMPLATES = [
  {
    id: 'exam2026',
    label: '🎓 Đề thi TN THPT 2026 (Toán)',
    source: String.raw`% ĐỀ THI THAM KHẢO TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG NĂM 2026
% Môn: TOÁN - Cấu trúc chuẩn 3 Phần theo Bộ Giáo dục & Đào tạo

\begin{ex}
    Thống kê điểm kiểm tra giữa kỳ môn Toán của $30$ học sinh lớp 11C được ghi lại ở bảng ghép nhóm sau:
    \begin{center}
        \begin{tabular}{|c|c|c|c|c|c|}
            \hline
            Điểm & $[0;2)$ & $[2;4)$ & $[4;6)$ & $[6;8)$ & $[8;10)$ \\
            \hline
            Số học sinh & $1$& $3$ & $8$ & $11$ & $7$ \\
            \hline
        \end{tabular}
    \end{center}
    Trung vị của mẫu số liệu trên thuộc nhóm nào dưới đây?
    \choice
    {$[2;4)$}
    {$[4;6)$}
    {\True $[6;8)$}
    {$[8;10)$}
    \loigiai{
        Tổng số học sinh là $n=30$. Trung vị $M_e$ là giá trị có thứ tự là $\dfrac{30+1}{2}=15{,}5$.
        Dựa vào bảng tần số tích lũy, ta thấy trung vị thuộc nhóm thứ bốn là nhóm $[6;8)$.
    }
\end{ex}

\begin{ex}
    Trong không gian $Oxyz$, cho mặt phẳng $(P)$ đi qua điểm $M(2;2;1)$ và có một vectơ pháp tuyến $\vec{n}=(5;2;-3)$. Phương trình mặt phẳng $(P)$ là
    \choice
    {$5x+2y-3z-17=0$}
    {$2x+2y+z-11=0$}
    {\True $5x+2y-3z-11=0$}
    {$2x+2y+z-17=0$}
    \loigiai{
        Mặt phẳng $(P)$ có phương trình là $5(x-2)+2(y-2)-3(z-1)=0 \Leftrightarrow 5x+2y-3z-11=0$.
    }
\end{ex}

\begin{ex}
    Cho hàm số $y=f(x)$ liên tục trên $\mathbb{R}$ và có bảng xét dấu của $f'(x)$ như sau:
    \begin{center}
        \begin{tikzpicture}
            \tkzTabInit[nocadre=false,lgt=1.2,espcl=2.5,deltacl=0.6]
            {$x$ /0.6, $f'(x)$ /0.6}
            {$-\infty$, $-2$, $0$, $2$, $+\infty$}
            \tkzTabLine{,+,0,-,0,+,0,+,}
        \end{tikzpicture}
    \end{center}
    Hàm số $y=f(x)$ có bao nhiêu điểm cực trị?
    \choice
    {$4$}
    {\True $2$}
    {$3$}
    {$1$}
    \loigiai{
        $f'(x)$ đổi dấu $2$ lần khi đi qua $x=-2$ và $x=0$, nên hàm số có $2$ điểm cực trị.
    }
\end{ex}

\phanII
\begin{ex}
    \immini{Một mô hình trò chơi vòng quay ở công viên có bán kính $R=20$ m, tâm quay $O$ ở độ cao $23$ m so với mặt đất. Hai ca bin $B, C$ vuông góc nhau $\widehat{BOC}=90^\circ$. Góc $\alpha$ là góc lượng giác hợp bởi tia $OA$ và $OB$.}
    {   \begin{tikzpicture}[scale=0.65, font=\footnotesize, line join=round, line cap=round, >=stealth]
            \draw[->] (-2.8,0) -- (3.5,0) node[below] {$x$};
            \draw[->] (0,-2.8) -- (0,3.2) node[left] {$y$};
            \draw[thick] (0,0) circle (2.2);
            \coordinate (A) at (2.2,0);
            \coordinate (B) at (30:2.2);
            \draw[fill=black] (A) circle (1.5pt) node[below right]{$A$};
            \draw[fill=black] (B) circle (1.5pt) node[above right]{$B$};
            \draw (0,0) -- (B);
            \draw (0.5,0) arc (0:30:0.5);
            \node at (15:0.75) {$\alpha$};
        \end{tikzpicture}}
    \choiceTF
    {\True Chiều cao của điểm $B$ so với mặt đất là $h_B = 23 + 20\sin \alpha$ (mét)}
    {\True Khi $\alpha = 45^\circ$ thì chiều cao của $B$ so với mặt đất xấp xỉ $37{,}14$ m}
    {Khi $B$ ở vị trí thấp nhất thì $\alpha = 0^\circ$}
    {\True Điểm $B$ đạt độ cao lớn nhất bằng $43$ m}
    \loigiai{
        Chiều cao tối đa là $23 + 20 = 43$ m. Với $\alpha = 45^\circ$, $h_B = 23 + 20\sin 45^\circ \approx 37{,}14$ m.
    }
\end{ex}

\phanIII
\begin{ex}
    Trong một vòng tuyển chọn, $40$ thí sinh thể hiện phong cách Dân gian và Nhạc nhẹ. Có $28$ thí sinh đạt Dân gian, $25$ thí sinh đạt Nhạc nhẹ và $5$ thí sinh không đạt cả hai. Ban giám khảo chọn ngẫu nhiên $3$ thí sinh từ danh sách đạt Dân gian. Tính xác suất để trong $3$ người được chọn có đúng $2$ người đạt thêm phong cách Nhạc nhẹ (Kết quả làm tròn đến hàng phần trăm).
    \shortans{$0{,}47$}
    \loigiai{
        Số thí sinh đạt cả hai phong cách là $28 + 25 - (40 - 5) = 18$.
        Xác suất cần tính là $P = \dfrac{\mathrm{C}_{18}^2 \cdot \mathrm{C}_{10}^1}{\mathrm{C}_{28}^3} = \dfrac{153 \cdot 10}{3\,276} \approx 0{,}47$.
    }
\end{ex}`,
  },
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

function extractTex(input) {
  const trimmed = (input || '').trim();
  if (!trimmed.startsWith('{')) return trimmed;
  let value;
  try {
    value = JSON.parse(trimmed);
  } catch {
    throw new Error('JSON không hợp lệ. Hãy dùng trường tex, source, latex hoặc tikz.');
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

  // Mode: 'exam' (A4 Exam Paper) or 'tikz' (Standalone graphics)
  const [docType, setDocType] = useState(() => (isExamDocument(input) ? 'exam' : 'tikz'));

  // Exam Configurations
  const [examMode, setExamMode] = useState('student'); // 'student' | 'solution' | 'student_with_answers'
  const [examCode, setExamCode] = useState('101');
  const [examOrg, setExamOrg] = useState('BỘ GIÁO DỤC VÀ ĐÀO TẠO');
  const [examTitle, setExamTitle] = useState('KỲ THI TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG NĂM 2026');
  const [examSubject, setExamSubject] = useState('Bài thi: TOÁN');
  const [examTime, setExamTime] = useState('90 phút');

  const [dpi, setDpi] = useState(180);
  const [previewTab, setPreviewTab] = useState('pdf'); // 'pdf' | 'image'
  const [zoom, setZoom] = useState(100);
  const [svgText, setSvgText] = useState(null);
  const [compileStatus, setCompileStatus] = useState('idle'); // 'idle' | 'rendering' | 'success' | 'error'
  const [compileError, setCompileError] = useState(null);
  const [result, setResult] = useFileResult();
  const [loading, setLoading] = useState(false);
  const [pageCount, setPageCount] = useState(null);
  const { toasts, addToast } = useToast();

  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const currentRenderIdRef = useRef(0);
  const iframeRef = useRef(null);

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

  // Auto-detect exam code changes
  useEffect(() => {
    if (isExamDocument(input)) {
      setDocType('exam');
      if (previewTab === 'image' && !result) {
        setPreviewTab('pdf');
      }
    }
  }, [input, previewTab, result]);

  // Core render implementation
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
      if (!isAutomatic) addToast('Hãy nhập hoặc mở file mã TeX.', 'warning');
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

    const isExam = docType === 'exam' || isExamDocument(trimmed);

    try {
      const outputId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `tex-${Date.now()}`;
      const objectUrls = [];
      let svg = null;
      let downloads = {};
      let returnedPageCount = null;

      const examOptions = {
        mode: isExam ? 'exam' : 'tikz',
        examMode,
        examCode,
        examOrg,
        examTitle,
        examSubject,
        examTime: `${examTime}, không kể thời gian phát đề`,
        signal: abortController.signal,
      };

      try {
        // Fast path: direct Kroki TeX Engine call from browser
        const krokiRes = await renderTikzWithKroki(trimmed, examOptions);
        svg = krokiRes.svg;

        if (svg) {
          const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
          const svgUrl = URL.createObjectURL(svgBlob);
          objectUrls.push(svgUrl);
          downloads.svg = svgUrl;

          try {
            const pngBlob = await svgToPngBlob(svg, targetDpi);
            if (pngBlob) {
              const pngUrl = URL.createObjectURL(pngBlob);
              objectUrls.push(pngUrl);
              downloads.png = pngUrl;
            }
          } catch {
            /* non-fatal */
          }
        }

        const texBlob = new Blob([krokiRes.document || trimmed], { type: 'application/x-tex;charset=utf-8' });
        const texUrl = URL.createObjectURL(texBlob);
        objectUrls.push(texUrl);
        downloads.tex = texUrl;

        // Vector PDF
        let pdfBlob = krokiRes.pdfBlob;
        if (!pdfBlob && krokiRes.document) {
          pdfBlob = await fetchKrokiPdf(krokiRes.document, { signal: abortController.signal });
        }

        if (pdfBlob) {
          const pdfUrl = URL.createObjectURL(pdfBlob);
          objectUrls.push(pdfUrl);
          downloads.pdf = pdfUrl;
        }
      } catch (krokiErr) {
        if (abortController.signal.aborted) return;
        // Fallback to backend /api/tikz/render
        try {
          const backendData = await api.renderTikz(trimmed, targetDpi, {
            is_exam: isExam,
            exam_mode: examMode,
            exam_code: examCode,
            exam_org: examOrg,
            exam_title: examTitle,
            exam_subject: examSubject,
          });

          if (renderId !== currentRenderIdRef.current) {
            releaseResult(backendData);
            return;
          }
          downloads = backendData.downloads || {};
          returnedPageCount = backendData.page_count;
          if (downloads.svg) {
            svg = await (await fetch(downloads.svg)).text();
          }
          (backendData.objectUrls || []).forEach(url => objectUrls.push(url));
        } catch {
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
      setPageCount(returnedPageCount);

      if (isExam || !svg) {
        setPreviewTab('pdf');
      }

      const fileResult = {
        output_id: outputId,
        preview_url: downloads.svg || downloads.png,
        pdf_preview_url: downloads.pdf,
        downloads,
        objectUrls,
        isExam,
      };

      setResult(fileResult);

      if (!isAutomatic) {
        addToast(
          isExam
            ? '✅ Đã biên dịch Đề thi thành tài liệu PDF A4 thành công!'
            : '✅ Đã biên dịch TeX/TikZ thành ảnh và PDF',
          'success',
          4500,
        );
      }
    } catch (err) {
      if (abortController.signal.aborted) return;
      if (renderId === currentRenderIdRef.current) {
        setCompileStatus('error');
        setCompileError(err.message || 'Lỗi biên dịch TeX / TikZ');
        if (!isAutomatic) {
          addToast(`❌ ${err.message}`, 'error', 7000);
        }
      }
    } finally {
      if (renderId === currentRenderIdRef.current) {
        setLoading(false);
      }
    }
  }, [addToast, docType, examCode, examMode, examOrg, examSubject, examTime, examTitle, setResult]);

  const handleManualCompile = () => {
    executeRender(input, dpi, false);
  };

  const loadTemplate = (template) => {
    setInput(template.source);
    setCompileError(null);
    if (template.id === 'exam2026') {
      setDocType('exam');
      setPreviewTab('pdf');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result;
      if (typeof content === 'string') {
        setInput(content);
        setCompileError(null);
        if (isExamDocument(content)) {
          setDocType('exam');
          setPreviewTab('pdf');
        }
        addToast(`📂 Đã tải nội dung file ${file.name} (${content.length.toLocaleString()} ký tự)`, 'success');
      }
    };
    reader.onerror = () => {
      addToast('Không thể đọc file đã chọn.', 'error');
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  const handlePrintPdf = () => {
    if (iframeRef.current) {
      try {
        iframeRef.current.contentWindow?.focus();
        iframeRef.current.contentWindow?.print();
        return;
      } catch {
        /* fallback to open */
      }
    }
    if (result?.downloads?.pdf) {
      const win = window.open(result.downloads.pdf, '_blank');
      win?.focus();
    }
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
      <div className="tool-page tikz-page tex-page-container">
        <div className="tool-header">
          <div className="tool-header-icon tikz-header-icon">TeX</div>
          <h1>TeX <span className="gradient-text">→ PDF Chuẩn A4 & Ảnh</span></h1>
          <p>
            Biên dịch mã LaTeX và đề thi trắc nghiệm Toán sang tài liệu <strong>PDF chuẩn A4 (in ấn theo cấu trúc đề thi Tốt nghiệp THPT 2026)</strong> và ảnh vector sắc nét qua <strong>Kroki TeX Engine</strong>.
          </p>
        </div>

        {/* Mode Selector */}
        <section className="tex-type-selector" aria-label="Chọn định dạng tài liệu">
          <span className="tex-type-label">Định dạng xuất:</span>
          <button
            type="button"
            className={`tex-type-btn ${docType === 'exam' ? 'is-active' : ''}`}
            onClick={() => {
              setDocType('exam');
              setPreviewTab('pdf');
            }}
          >
            🎓 Đề thi TN THPT 2026 (Khổ A4)
          </button>
          <button
            type="button"
            className={`tex-type-btn ${docType === 'tikz' ? 'is-active' : ''}`}
            onClick={() => setDocType('tikz')}
          >
            📐 Đồ họa TikZ / Đơn trang (Standalone)
          </button>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#64748b' }}>
            {docType === 'exam' ? 'Khổ giấy: A4 (210×297 mm)' : 'Kích thước: Tự co giãn theo hình'}
          </span>
        </section>

        {/* Exam Configuration Panel */}
        {docType === 'exam' && (
          <section className="exam-config-panel" aria-label="Cấu hình xuất bản đề thi">
            <div className="exam-config-header">
              <div className="exam-config-title">
                <span>⚙️ Cấu hình xuất bản Đề thi A4 (2026)</span>
                <span className="exam-badge-a4">✓ Chuẩn Bộ GD&ĐT</span>
              </div>
              <div className="exam-mode-chips" role="radiogroup" aria-label="Chế độ xuất bản">
                <button
                  type="button"
                  className={`exam-mode-chip ${examMode === 'student' ? 'is-active' : ''}`}
                  onClick={() => setExamMode('student')}
                  title="Ẩn lời giải và đáp án đúng, sẵn sàng in phát cho học sinh làm bài"
                >
                  📄 Đề thi học sinh (Ẩn lời giải)
                </button>
                <button
                  type="button"
                  className={`exam-mode-chip ${examMode === 'solution' ? 'is-active' : ''}`}
                  onClick={() => setExamMode('solution')}
                  title="Hiển thị phương án đúng và chi tiết lời giải \loigiai, kèm bảng đáp án"
                >
                  📖 Đề thi kèm lời giải chi tiết
                </button>
                <button
                  type="button"
                  className={`exam-mode-chip ${examMode === 'student_with_answers' ? 'is-active' : ''}`}
                  onClick={() => setExamMode('student_with_answers')}
                  title="Đề thi học sinh kèm Bảng đáp án tham khảo ở cuối đề"
                >
                  🔑 Đề thi + Bảng đáp án
                </button>
              </div>
            </div>

            <div className="exam-fields-grid">
              <div className="exam-field-group">
                <label>Mã đề thi</label>
                <input
                  type="text"
                  className="exam-field-input"
                  value={examCode}
                  onChange={e => setExamCode(e.target.value)}
                  placeholder="101"
                />
              </div>
              <div className="exam-field-group">
                <label>Đơn vị / Sở / Trường</label>
                <input
                  type="text"
                  className="exam-field-input"
                  value={examOrg}
                  onChange={e => setExamOrg(e.target.value)}
                  placeholder="BỘ GIÁO DỤC VÀ ĐÀO TẠO"
                />
              </div>
              <div className="exam-field-group">
                <label>Kỳ thi</label>
                <input
                  type="text"
                  className="exam-field-input"
                  value={examTitle}
                  onChange={e => setExamTitle(e.target.value)}
                  placeholder="KỲ THI TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG NĂM 2026"
                />
              </div>
              <div className="exam-field-group">
                <label>Môn thi / Bài thi</label>
                <input
                  type="text"
                  className="exam-field-input"
                  value={examSubject}
                  onChange={e => setExamSubject(e.target.value)}
                  placeholder="Bài thi: TOÁN"
                />
              </div>
              <div className="exam-field-group">
                <label>Thời gian làm bài</label>
                <input
                  type="text"
                  className="exam-field-input"
                  value={examTime}
                  onChange={e => setExamTime(e.target.value)}
                  placeholder="90 phút"
                />
              </div>
            </div>
          </section>
        )}

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
                <strong>Mã nguồn LaTeX / Đề thi TeX</strong>
                <span>{input.length.toLocaleString()} ký tự</span>
              </div>
              <div className="tikz-heading-actions">
                <input
                  type="file"
                  accept=".tex,.txt"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  className="tool-btn tex-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Mở trực tiếp file đề .tex từ máy tính (ví dụ file T.Do.tex)"
                >
                  📂 Mở file .tex
                </button>
                <button type="button" className="tool-btn" onClick={saveDraft} title="Lưu bản nháp">
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
              placeholder="Dán mã LaTeX/TikZ hoặc đề thi \begin{ex} ... \end{ex} tại đây..."
            />

            <div className="tikz-compile-bar">
              {docType === 'tikz' ? (
                <label>DPI PNG:
                  <select value={dpi} onChange={e => setDpi(Number(e.target.value))}>
                    <option value="120">120 DPI</option>
                    <option value="180">180 DPI (chuẩn)</option>
                    <option value="240">240 DPI</option>
                    <option value="300">300 DPI (sắc nét)</option>
                  </select>
                </label>
              ) : (
                <span className="exam-badge-a4">
                  Khổ giấy in: A4 (210×297 mm) — Căn lề chuẩn Bộ GD&ĐT
                </span>
              )}

              <button
                type="button"
                className="btn btn-primary tex-primary-compile"
                onClick={handleManualCompile}
                disabled={loading || !input.trim()}
              >
                {loading ? (
                  <><span className="spinner" /> Đang tạo PDF A4...</>
                ) : (
                  docType === 'exam' ? '▶ Xuất bản PDF Đề thi A4' : '▶ Biên dịch ngay'
                )}
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
                {docType === 'exam'
                  ? 'Đang bật chế độ Đề thi A4: Tự động căn trang A4, hỗ trợ đầy đủ 3 phần chuẩn Bộ GD&ĐT 2026, tiếng Việt UTF-8, bảng biến thiên tkz-tab, hình học tkz-euclide và pgfplots.'
                  : 'Sử dụng công nghệ vẽ Kroki TeX Engine — tự động hỗ trợ tiếng Việt, tkz-tab, tkz-euclide, pgfplots và xuất đầy đủ SVG, PNG, PDF.'}
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
                      style={previewTab === 'pdf' ? { background: '#7c3aed', color: '#fff', borderColor: '#7c3aed', fontWeight: 700 } : {}}
                      onClick={() => setPreviewTab('pdf')}
                    >
                      📄 Tài liệu PDF
                    </button>
                    {(sanitizedSvg || result.downloads.svg) && (
                      <button
                        type="button"
                        className="tool-btn"
                        style={previewTab === 'image' ? { background: '#7c3aed', color: '#fff', borderColor: '#7c3aed', fontWeight: 700 } : {}}
                        onClick={() => setPreviewTab('image')}
                      >
                        🖼 Ảnh (SVG)
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {compileStatus === 'rendering' ? (
                  <span className="tikz-engine-badge is-loading">⚡ Đang tạo PDF A4...</span>
                ) : compileStatus === 'error' ? (
                  <span className="tikz-engine-badge is-error">⚠️ Có lỗi cú pháp</span>
                ) : result ? (
                  <span className="tikz-engine-badge">
                    ✓ PDF A4 {pageCount ? `(${pageCount} trang)` : 'sẵn sàng'}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Chưa có kết quả</span>
                )}

                {result && previewTab === 'image' && (
                  <div className="tikz-zoom-toolbar" aria-label="Công cụ phóng to ảnh">
                    <button type="button" className="tool-btn tikz-zoom-btn" onClick={handleZoomOut} title="Thu nhỏ (−)">−</button>
                    <button type="button" className="tool-btn tikz-zoom-btn tikz-zoom-reset" onClick={handleResetZoom} title="Nhấn để đặt lại 100%">{zoom}%</button>
                    <button type="button" className="tool-btn tikz-zoom-btn" onClick={handleZoomIn} title="Phóng to giữ nét (+)">+</button>
                  </div>
                )}
              </div>
            </div>

            {/* Preview content */}
            {previewTab === 'pdf' ? (
              <div className="tex-pdf-preview" aria-busy={loading}>
                {result?.downloads?.pdf || result?.pdf_preview_url ? (
                  <iframe
                    ref={iframeRef}
                    className="tex-pdf-fullframe"
                    title="Xem trước PDF Đề thi"
                    src={result.downloads.pdf || result.pdf_preview_url}
                  />
                ) : (
                  <div className="tikz-empty" style={{ minHeight: '430px' }}>
                    <span>📄</span>
                    <p>{loading ? 'Đang tạo tài liệu PDF A4, vui lòng chờ trong giây lát...' : 'Nhấn “Xuất bản PDF Đề thi A4” để xem trước và tải file PDF'}</p>
                  </div>
                )}
              </div>
            ) : (
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
            )}

            {/* Download Buttons */}
            {result && (
              <div className="tex-actions-bar">
                {result.downloads.pdf && (
                  <a
                    className="btn btn-success"
                    href={result.downloads.pdf}
                    download={`de-thi-${examCode || 'toan'}-a4.pdf`}
                    title="Tải tài liệu PDF chuẩn A4 để in ấn"
                  >
                    ⬇ Tải PDF A4 (.pdf)
                  </a>
                )}
                {result.downloads.pdf && (
                  <button
                    type="button"
                    className="btn btn-print"
                    onClick={handlePrintPdf}
                    title="In trực tiếp tài liệu PDF ra giấy A4"
                  >
                    🖨 In ngay (A4)
                  </button>
                )}
                {result.downloads.tex && (
                  <a
                    className="btn btn-secondary"
                    href={result.downloads.tex}
                    download={`de-thi-${examCode || 'toan'}.tex`}
                    title="Tải mã nguồn TeX hoàn chỉnh"
                  >
                    Tải TeX A4
                  </a>
                )}
                {result.downloads.svg && (
                  <a
                    className="btn btn-primary tikz-download-svg"
                    href={result.downloads.svg}
                    download="diagram.svg"
                    target="_blank"
                    rel="noreferrer"
                    title="Tải ảnh vector SVG"
                  >
                    ★ Tải SVG
                  </a>
                )}
                {result.downloads.png && (
                  <a
                    className="btn btn-secondary"
                    href={result.downloads.png}
                    download="diagram.png"
                    title="Tải ảnh PNG"
                  >
                    Tải PNG
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
