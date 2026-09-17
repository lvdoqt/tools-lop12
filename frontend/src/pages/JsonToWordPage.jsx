import { useEffect, useRef, useState } from 'react';
import { exportWord, renderWordMath, validateWord } from '../lib/wordExport';
import './JsonToWordPage.css';

const SAMPLE = JSON.stringify({ title: 'Đề minh họa', questions: [
  { type: 'mcq', question: 'Đạo hàm của hàm số $y=x^2$ là', option_a: '$2x$', option_b: '$x$', option_c: '$x^3$', option_d: '$2$', correct_option: 'A', explanation: 'Ta có $(x^2)\\prime=2x$.' },
  { type: 'msq', question: 'Cho hàm số $y=x^2$. Xét các khẳng định sau.', option_a: 'Đồ thị đi qua $O(0;0)$.', option_b: 'Hàm số đồng biến trên $\\mathbb{R}$.', option_c: 'Giá trị nhỏ nhất bằng $0$.', option_d: 'Đồ thị là đường thẳng.', correct_option: 'A,C', explanation: 'Đồ thị là parabol.' },
  { type: 'sa', question: 'Tính $\\displaystyle\\int_0^1 2x\\,dx$.', correct_option: '1', explanation: 'Kết quả bằng $[x^2]_0^1=1$.' },
] }, null, 2);

export default function JsonToWordPage() {
  const [source, setSource] = useState('');
  const [filename, setFilename] = useState('');
  const [settings, setSettings] = useState({ organization: 'TRƯỜNG THPT', exam_title: 'KỲ THI TỐT NGHIỆP THPT', code: '101', minutes: 90, include_answers: true });
  const [checked, setChecked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [download, setDownload] = useState('');
  const input = useRef(null);
  const controller = useRef(null);
  const downloadRef = useRef('');
  useEffect(() => () => { controller.current?.abort(); URL.revokeObjectURL(downloadRef.current); }, []);

  const invalidate = () => {
    setChecked(null); setError(''); setProgress(''); setDownload('');
    URL.revokeObjectURL(downloadRef.current); downloadRef.current = '';
  };
  const update = (key, value) => { invalidate(); setSettings(previous => ({ ...previous, [key]: value })); };
  const loadFile = async file => {
    if (!file || busy) return;
    invalidate();
    if (!file.name.toLowerCase().endsWith('.json') || !file.size || file.size > 2 * 1024 * 1024) {
      setError('Chọn file .json UTF-8 không rỗng, tối đa 2 MB.'); return;
    }
    try {
      setSource(new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()));
      setFilename(file.name);
    } catch { setError('Không đọc được file UTF-8. Hãy lưu lại JSON với mã hóa UTF-8.'); }
  };
  const check = async () => {
    invalidate(); setBusy(true); setProgress('Đang kiểm tra câu hỏi, bảng và công thức…');
    controller.current = new AbortController();
    try {
      const result = await validateWord(source, settings, controller.current.signal);
      setChecked(result); setProgress(`Đã kiểm tra ${result.total} câu. Sẵn sàng xuất Word.`);
    } catch (err) {
      setProgress(''); if (err.name !== 'AbortError') setError(err.message);
    } finally { setBusy(false); }
  };
  const generate = async () => {
    setError(''); setBusy(true); setProgress('Đang chuẩn bị công thức…');
    controller.current = new AbortController();
    try {
      const previews = await renderWordMath(checked.formulas, controller.current.signal, setProgress);
      setProgress('Đang nhúng hình và tạo hai bản Word. Vui lòng chờ…');
      const zip = await exportWord(source, settings, previews, controller.current.signal);
      URL.revokeObjectURL(downloadRef.current);
      const url = URL.createObjectURL(zip); downloadRef.current = url; setDownload(url);
      const link = document.createElement('a'); link.href = url; link.download = 'De-Toan-Word.zip'; link.click();
      setProgress('Đã tạo ZIP gồm bản Equation và bản MathType.');
    } catch (err) {
      setProgress(''); if (err.name !== 'AbortError') setError(err.message);
    } finally { setBusy(false); }
  };

  return <main className="main-content"><div className="tool-page word-page">
    <div className="tool-header"><div className="tool-header-icon json-header-icon">W</div>
      <h1>Json <span className="gradient-text">to Word</span></h1>
      <p>Từ Quiz Bank đến đề thi Toán: công thức chỉnh sửa được, hình ảnh nhúng sẵn trong Word.</p>
    </div>
    <div className="word-layout">
      <section className="glass-panel word-input" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); loadFile(event.dataTransfer.files[0]); }}>
        <div className="json-toolbar"><div className="json-actions">
          <button className="btn btn-secondary" disabled={busy} onClick={() => input.current.click()}>Chọn file JSON</button>
          <button className="btn btn-secondary" disabled={busy} onClick={() => { invalidate(); setSource(SAMPLE); setFilename('Ví dụ 3 dạng câu'); }}>Dùng ví dụ</button>
        </div><span className="word-muted">{filename || 'Kéo thả file · UTF-8 · tối đa 2 MB'}</span></div>
        <input ref={input} type="file" accept=".json,application/json" hidden onChange={event => { loadFile(event.target.files[0]); event.target.value = ''; }} />
        <label className="word-label" htmlFor="word-json">Nội dung JSON</label>
        <textarea id="word-json" className="word-source" spellCheck={false} value={source} disabled={busy} placeholder={'Dán JSON từ Quiz Bank tại đây…\n{ "title": "Toán 12", "questions": [...] }'} onChange={event => { invalidate(); setSource(event.target.value); setFilename(''); }} />
        <p className="word-muted">Hỗ trợ câu chọn đáp án (mcq), đúng/sai (msq), trả lời ngắn (sa), bảng HTML và hình HTTPS hoặc data:image.</p>
      </section>
      <section className="glass-panel word-settings">
        <h2>Thông tin đề thi</h2>
        <label>Đơn vị ra đề<input value={settings.organization} maxLength={120} disabled={busy} onChange={event => update('organization', event.target.value)} /></label>
        <label>Tiêu đề kỳ thi<input value={settings.exam_title} maxLength={160} disabled={busy} onChange={event => update('exam_title', event.target.value)} /></label>
        <div className="word-settings-row">
          <label>Mã đề<input value={settings.code} maxLength={20} disabled={busy} onChange={event => update('code', event.target.value)} /></label>
          <label>Thời gian (phút)<input type="number" min="1" max="300" value={settings.minutes} disabled={busy} onChange={event => update('minutes', event.target.value === '' ? '' : Number(event.target.value))} /></label>
        </div>
        <div className="word-format"><strong>Mỗi bản Word gồm hai phần</strong><p>Phần 1: đề thi theo bố cục đề của Bộ, đủ ba nhóm câu hỏi, không kèm đáp án.</p><p>Phần 2: lặp lại đầy đủ câu hỏi và phương án; đáp án, lời giải ngay sau từng câu.</p><p>ZIP gồm bản Equation gốc của Word và bản MathType nhúng, mở sửa bằng MathType desktop.</p><p>A4 · Times New Roman · mã đề và số trang.</p></div>
        <button className="btn btn-primary" disabled={busy || !source.trim()} onClick={check}>1. Kiểm tra JSON</button>
        <button className="btn btn-primary" disabled={busy || !checked} onClick={generate}>2. Xuất ZIP Word</button>
        {busy && <button className="btn btn-secondary" onClick={() => { controller.current?.abort(); setProgress('Đã hủy.'); }}>Hủy</button>}
        {download && <a className="btn btn-secondary" href={download} download="De-Toan-Word.zip">Tải lại ZIP</a>}
      </section>
    </div>
    {progress && <p className="word-status" role="status">{progress}</p>}
    {error && <div className="word-error" role="alert">{error}</div>}
    {checked && <section className="glass-panel word-summary">
      <h2>{checked.total} câu hỏi</h2>
      <div className="word-counts"><span>Phần I: <strong>{checked.counts.mcq}</strong> câu chọn đáp án</span><span>Phần II: <strong>{checked.counts.msq}</strong> câu đúng/sai</span><span>Phần III: <strong>{checked.counts.sa}</strong> câu trả lời ngắn</span></div>
      <p>{checked.formula_count} công thức khác nhau · {checked.image_count} hình cần nhúng{settings.include_answers ? ' · Có đáp án và lời giải' : ''}</p>
      {checked.standard && <p className="word-success">Đủ cấu trúc 12 – 4 – 6 câu theo mẫu đề tham khảo THPT.</p>}
      {checked.warnings.map(warning => <p className="word-warning" key={warning}>{warning}</p>)}
      <p className="word-muted">Các câu được xếp theo ba phần, giữ thứ tự trong từng phần. Ảnh được kiểm tra và tải khi xuất ZIP.</p>
    </section>}
    <p className="word-reference">Bố cục tham khảo <a href="https://vqa.moet.gov.vn/vi/news/tin-tuc-su-kien/de-thi-tham-khao-ky-thi-tot-nghiep-thpt-tu-nam-2025-159.html" target="_blank" rel="noreferrer">đề thi của Bộ GDĐT từ năm 2025</a>. Đề xuất mang nhãn “Đề tham khảo”. Kiểm tra ngắt trang trong Word trước khi in.</p>
  </div></main>;
}
