import { useEffect, useMemo, useRef, useState } from 'react';
import { ToastContainer, useToast } from '../components/Toast';
import { compatSvg, createTikzRenderer, finalizeQuiz, getUploadConfig, parseLatex, standaloneSvg, uploadSignedSvg, uploadSvg } from '../lib/quizConversion';

const SAMPLE = String.raw`\begin{ex}
Cho hàm số $y=x^2$. Đạo hàm của hàm số là
\choice
{$x$}{\True $2x$}{$x^2$}{$2$}
\loigiai{Ta có $(x^2)'=2x$.}
\end{ex}

\begin{ex}
Xét các khẳng định về hàm số $y=x^2$.
\choiceTF
{\True Đồ thị đi qua gốc tọa độ.}
{Hàm số đồng biến trên $\mathbb{R}$.}
{\True Hàm số nhận giá trị nhỏ nhất bằng $0$.}
{Đồ thị là đường thẳng.}
\loigiai{Đồ thị là một parabol.}
\end{ex}

\begin{ex}
Tính $\displaystyle\int_0^1 2x\,dx$.
\shortans[oly]{$1$}
\loigiai{Giá trị tích phân bằng $[x^2]_0^1=1$.}
\end{ex}`;

export default function LatexToJsonPage() {
  const [source, setSource] = useState('');
  const [filename, setFilename] = useState('');
  const [title, setTitle] = useState('Toán 12');
  const [difficulty, setDifficulty] = useState('easy');
  const [cloudName, setCloudName] = useState(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '');
  const [preset, setPreset] = useState(import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '');
  const [uploadConfig, setUploadConfig] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [assets, setAssets] = useState({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const fileInput = useRef(null);
  const controller = useRef(null);
  const cached = useRef({});
  const { toasts, addToast } = useToast();

  const clearAssets = () => {
    Object.values(cached.current).forEach(asset => URL.revokeObjectURL(asset.preview));
    cached.current = {};
    setAssets({});
  };
  useEffect(() => () => {
    controller.current?.abort();
    Object.values(cached.current).forEach(asset => URL.revokeObjectURL(asset.preview));
  }, []);
  useEffect(() => {
    const request = new AbortController();
    getUploadConfig(request.signal).then(setUploadConfig).catch(() => {});
    return () => request.abort();
  }, []);

  const invalidate = () => { setParsed(null); clearAssets(); setError(''); setProgress(''); };
  const urls = useMemo(() => Object.fromEntries(Object.entries(assets).filter(([, asset]) => asset.url).map(([id, asset]) => [id, asset.url])), [assets]);
  const ready = parsed && parsed.diagrams.every(diagram => urls[diagram.id]);
  const output = useMemo(() => ready ? JSON.stringify(finalizeQuiz(parsed.quiz, parsed.diagrams, urls), null, 2) : '', [parsed, urls, ready]);
  const counts = parsed?.quiz.questions.reduce((sum, question) => ({ ...sum, [question.type]: sum[question.type] + 1 }), { mcq: 0, msq: 0, sa: 0 });

  const loadFile = async file => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.tex') || !file.size || file.size > 1024 * 1024) {
      setError('Hãy chọn file .tex UTF-8 không rỗng, tối đa 1 MB.');
      return;
    }
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      invalidate(); setSource(text); setFilename(file.name);
    } catch { setError('Không đọc được file UTF-8. Hãy lưu lại file TeX với mã hóa UTF-8.'); }
  };

  const parse = async () => {
    invalidate(); setBusy(true);
    controller.current = new AbortController();
    setProgress('Đang đọc câu hỏi và đáp án…');
    try {
      const result = await parseLatex(source, title, difficulty, controller.current.signal);
      setParsed(result);
      setProgress(`Đã đọc ${result.quiz.questions.length} câu và ${result.diagrams.length} hình.`);
    } catch (err) { if (err.name !== 'AbortError') setError(err.message); else setProgress('Đã hủy.'); }
    finally { setBusy(false); }
  };

  const processImages = async () => {
    if (!uploadConfig?.signed_upload && (!cloudName.trim() || !preset.trim())) { setError('Hãy nhập Cloud name và Unsigned upload preset bên dưới.'); return; }
    setBusy(true); setError('');
    controller.current = new AbortController();
    const signal = controller.current.signal;
    const renderer = createTikzRenderer();
    let failed = 0;
    const update = (id, value) => {
      cached.current[id] = { ...cached.current[id], ...value };
      setAssets({ ...cached.current });
    };
    try {
      for (const [index, diagram] of parsed.diagrams.entries()) {
        if (signal.aborted) break;
        if (cached.current[diagram.id]?.url) continue;
        setProgress(`Hình ${index + 1}/${parsed.diagrams.length} · câu ${diagram.question_number}`);
        update(diagram.id, { status: 'Đang tạo SVG…', error: '' });
        try {
          let svg = cached.current[diagram.id]?.svg;
          let engine = cached.current[diagram.id]?.engine;
          if (!svg) {
            // tkz-tab and Vietnamese text require packages absent from TikZJax.
            const needsCompat = /\\tkzTab/.test(diagram.source) || [...diagram.source].some(char => char.codePointAt(0) > 127);
            if (needsCompat) {
              svg = await compatSvg(diagram.source, signal); engine = 'LaTeX bổ sung';
            } else {
              try {
                svg = await standaloneSvg(await renderer.render(diagram.source, signal), signal); engine = 'TikZJax';
              } catch (err) {
                if (signal.aborted) throw err;
                update(diagram.id, { status: 'Đang thử biên dịch bổ sung…' });
                svg = await compatSvg(diagram.source, signal); engine = 'LaTeX bổ sung';
              }
            }
            update(diagram.id, { svg, engine, preview: URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })) });
          }
          update(diagram.id, { status: 'Đang tải lên Cloudinary…' });
          const url = uploadConfig?.signed_upload ? await uploadSignedSvg(svg, signal) : await uploadSvg(svg, cloudName.trim(), preset.trim(), signal);
          update(diagram.id, { url, status: 'Đã có link' });
        } catch (err) {
          if (signal.aborted) { update(diagram.id, { status: 'Đã hủy' }); break; }
          failed++;
          update(diagram.id, { status: 'Cần thử lại', error: err.message });
        }
      }
      setProgress(signal.aborted ? 'Đã hủy. Bạn có thể tiếp tục các hình còn lại.' : failed ? `${failed} hình chưa xong. Kiểm tra lỗi và bấm thử lại.` : 'Đã xử lý hình. JSON sẵn sàng để import.');
    } finally { renderer.dispose(); setBusy(false); }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([output], { type: 'application/json;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'quiz-bank.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(output); addToast('Đã sao chép JSON', 'success'); }
    catch { addToast('Không sao chép được. Hãy dùng nút tải JSON.', 'error'); }
  };

  return <main className="main-content"><div className="tool-page latex-json-page">
    <div className="tool-header"><div className="tool-header-icon json-header-icon">{'{ }'}</div>
      <h1>Latex <span className="gradient-text">to Json</span></h1>
      <p>Chuyển đề thi Toán từ file .tex thành JSON để import vào Quiz Bank.</p>
    </div>
    <div className="glass-panel">
      <div className="json-toolbar"><div className="json-actions">
        <button className="btn btn-secondary" disabled={busy} onClick={() => fileInput.current.click()}>Chọn file .tex</button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => { invalidate(); setSource(SAMPLE); setFilename('Ví dụ 3 dạng câu'); }}>Dùng ví dụ</button>
        <span className="latex-file-name">{filename || 'UTF-8 · tối đa 1 MB'}</span>
        <input ref={fileInput} type="file" accept=".tex" hidden onChange={event => { loadFile(event.target.files[0]); event.target.value = ''; }} />
      </div></div>
      <div className="latex-settings">
        <label>Tên bộ câu hỏi<input value={title} maxLength={200} disabled={busy} onChange={event => { invalidate(); setTitle(event.target.value); }} /></label>
        <label>Độ khó mặc định<select value={difficulty} disabled={busy} onChange={event => { invalidate(); setDifficulty(event.target.value); }}><option value="easy">Dễ</option><option value="medium">Trung bình</option><option value="hard">Khó</option></select></label>
      </div>
      <label className="json-editor-label" htmlFor="latex-source">Mã đề thi LaTeX</label>
      <textarea id="latex-source" className="json-textarea latex-source" value={source} disabled={busy} maxLength={1_000_000} onChange={event => { invalidate(); setSource(event.target.value); setFilename(''); }} spellCheck={false} placeholder={'Dán mã \\begin{ex} … \\end{ex} hoặc chọn file T.Do.tex'} />
      <div className="latex-actions"><button className="btn btn-primary" disabled={busy || !source.trim()} onClick={parse}>1. Đọc đề và kiểm tra</button>
        {busy && <button className="btn btn-secondary" onClick={() => controller.current?.abort()}>Hủy</button>}
        <span role="status" aria-live="polite">{progress}</span>
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
    </div>

    {parsed && <>
      <div className="glass-panel latex-results">
        <h2>{parsed.quiz.questions.length} câu hỏi</h2>
        <p>{counts.mcq} trắc nghiệm · {counts.msq} đúng/sai · {counts.sa} trả lời ngắn · {parsed.diagrams.length} hình</p>
        <p className="latex-note">Đáp án lấy đúng theo dấu \True và \shortans trong file. Hãy kiểm tra nội dung trước khi import.</p>
        {parsed.warnings.length > 0 && <ul>{parsed.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
        <details><summary>Xem câu hỏi và đáp án</summary><div className="latex-question-list">
          {parsed.quiz.questions.map((question, index) => <article key={index}><strong>Câu {index + 1} · {question.type.toUpperCase()} · Đáp án: {question.correct_option || 'Tất cả sai'}</strong><p>{question.question}</p>
            {['a', 'b', 'c', 'd'].filter(letter => question[`option_${letter}`]).map(letter => <p key={letter}>{letter.toUpperCase()}. {question[`option_${letter}`]}</p>)}
          </article>)}
        </div></details>
      </div>
      {parsed.diagrams.length > 0 && <div className="glass-panel latex-results">
        <h2>Hình minh họa → Cloudinary</h2>
        <p>SVG được gắn bằng HTML &lt;img&gt; vào đúng vị trí trong câu hỏi, phương án hoặc lời giải.</p>
        {uploadConfig?.signed_upload ? <p className="latex-note">Cloudinary đã kết nối: {uploadConfig.cloud_name}{uploadConfig.folder ? ` / ${uploadConfig.folder}` : ''}.</p> : <div className="latex-settings">
          <label>Cloud name<input value={cloudName} disabled={busy} onChange={event => setCloudName(event.target.value)} placeholder="your-cloud-name" autoComplete="off" /></label>
          <label>Unsigned upload preset<input value={preset} disabled={busy} onChange={event => setPreset(event.target.value)} placeholder="quiz-bank" autoComplete="off" /></label>
        </div>}
        <p className="latex-note">Hình dùng tkz-tab hoặc chữ tiếng Việt được biên dịch bổ sung qua LaTeX.Online.</p>
        <div className="latex-actions"><button className="btn btn-primary" disabled={busy || ready} onClick={processImages}>2. {Object.keys(assets).length ? 'Tiếp tục / thử lại hình còn thiếu' : 'Tạo SVG và tải hình lên'}</button>
          <span>{Object.keys(urls).length}/{parsed.diagrams.length} hình đã có link</span>
        </div>
        <div className="latex-image-grid">{parsed.diagrams.map((diagram, index) => {
          const asset = assets[diagram.id];
          return <article className="latex-image-card" key={diagram.id}><strong>Hình {index + 1} · câu {diagram.question_number}</strong>
            {asset?.preview && <img src={asset.preview} alt={`Xem trước hình ${index + 1}`} />}
            <span>{asset?.status || 'Chờ xử lý'}{asset?.engine ? ` · ${asset.engine}` : ''}</span>
            {asset?.error && <p className="latex-image-error">{asset.error}</p>}
            {asset?.url && <a href={asset.url} target="_blank" rel="noreferrer">Mở SVG trên Cloudinary ↗</a>}
            <details><summary>Mã TikZ</summary><pre>{diagram.source}</pre></details>
          </article>;
        })}</div>
      </div>}
      <div className="glass-panel latex-results">
        <div className="json-toolbar"><h2>JSON để import</h2><div className="json-actions"><button className="btn btn-secondary" disabled={!ready || busy} onClick={copy}>Sao chép</button><button className="btn btn-success" disabled={!ready || busy} onClick={download}>Tải quiz-bank.json</button></div></div>
        {!ready && <p>Hoàn thành tất cả hình để xuất JSON có đầy đủ link.</p>}
        <textarea className="json-textarea" aria-label="JSON kết quả" readOnly value={output} placeholder="JSON hoàn chỉnh sẽ xuất hiện ở đây." spellCheck={false} />
      </div>
    </>}
  </div><ToastContainer toasts={toasts} /></main>;
}
