import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../api';
import { useFileResult } from '../useFileResult';
import { unzipSync, zip } from 'fflate';
import './WordShufflePage.css';

async function request(file, operation, settings = {}, signal) {
  const body = new FormData();
  body.append('file', file);
  Object.entries(settings).forEach(([key, value]) => body.append(key, String(value)));
  const response = await fetch(`${API_BASE}/word-shuffle/${operation}`, { method: 'POST', body, signal });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(typeof data.detail === 'string' ? data.detail : 'Không xử lý được file Word. Hãy kiểm tra dữ liệu và thử lại.');
  }
  return response;
}

export default function WordShufflePage() {
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [count, setCount] = useState('4');
  const [startCode, setStartCode] = useState('0101');
  const [solutions, setSolutions] = useState(true);
  const [department, setDepartment] = useState('SỞ GDĐT ................................');
  const [school, setSchool] = useState('TRƯỜNG THPT ........................');
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useFileResult();
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  const validSettings = /^\d+$/.test(count) && Number(count) >= 1 && Number(count) <= 50
    && /^\d{3,4}$/.test(startCode) && Number(startCode) + Number(count) - 1 <= 9999
    && department.trim().length > 0 && school.trim().length > 0;

  function selectFile(event) {
    const selected = event.target.files?.[0];
    setAnalysis(null); setResult(null); setError(''); setFile(null);
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith('.docx') || selected.size > 4 * 1024 * 1024 || !selected.size) {
      setError('Chọn file .docx không rỗng, tối đa 4 MB. Với .doc, hãy mở Word và lưu thành .docx.');
      event.target.value = ''; return;
    }
    setFile(selected);
  }

  async function analyze() {
    controller.current = new AbortController();
    setBusy('analyze'); setError(''); setAnalysis(null); setResult(null);
    try { setAnalysis(await (await request(file, 'analyze', {}, controller.current.signal)).json()); }
    catch (err) { if (err.name !== 'AbortError') setError(err.message); }
    finally { setBusy(''); }
  }

  async function generate() {
    controller.current = new AbortController();
    const signal = controller.current.signal;
    setBusy('export'); setProgress(0); setError(''); setResult(null);
    try {
      const files = {};
      const seed = crypto.randomUUID();
      for (let index = 0; index < Number(count); index++) {
        const response = await request(file, 'export', { count, start_code: startCode, include_solutions: solutions, seed, variant_index: index, department, school }, signal);
        const entries = unzipSync(new Uint8Array(await response.arrayBuffer()));
        for (const [name, data] of Object.entries(entries)) {
          if (!files[name]) files[name] = data;
        }
        setProgress(index + 1);
      }
      const archive = await new Promise((resolve, reject) => zip(files, { level: 0 }, (err, data) => err ? reject(err) : resolve(data)));
      signal.throwIfAborted();
      const url = URL.createObjectURL(new Blob([archive], { type: 'application/zip' }));
      setResult({ download_url: url, objectUrls: [url], count });
    } catch (err) { if (err.name !== 'AbortError') setError(err.message); }
    finally { setBusy(''); }
  }

  return <main className="main-content"><div className="tool-page word-shuffle-page">
    <div className="tool-header"><div className="tool-header-icon">W</div>
      <h1>Trộn đề <span className="gradient-text">Word</span></h1>
      <p>Một đề gốc, nhiều mã đề. Giữ công thức, hình ảnh và trộn câu riêng trong từng phần.</p>
    </div>
    <section className="glass-panel shuffle-panel">
      <h2>1. Đọc đề gốc</h2>
      <p>Đề gồm PHẦN I, II, III; mỗi câu bắt đầu bằng “Câu 1.” hoặc “Câu 1:”, có thể in đậm. Phần I gạch chân nhãn đáp án đúng A/B/C/D.</p>
      <p>Phần II nhận nhãn ý đúng a/b/c/d được gạch chân, hoặc kết luận “a) ĐÚNG”, “b) SAI”… trong Lời giải (không phân biệt chữ hoa/thường). Nếu không gạch chân, hãy ghi đủ kết luận cho cả bốn ý.</p>
      <p>Phần III lấy số sau “Đáp án:”, “Đáp số:” hoặc “Trả lời:” dưới “Lời giải”. Chấp nhận dấu phẩy/chấm thập phân và bỏ dấu chấm kết câu: “Đáp số: 446.” → 446.</p>
      <label className="pdf-upload-zone"><input aria-label="Chọn đề Word" type="file" accept=".docx" disabled={!!busy} onChange={selectFile} />
        <strong>{file ? file.name : 'Chọn đề Word (.docx)'}</strong><span>Tối đa 4 MB • Giữ nguyên Equation / MathType và hình nhúng</span>
      </label>
      <button className="btn btn-primary" disabled={!file || !!busy} onClick={analyze}>{busy === 'analyze' ? 'Đang đọc đề…' : 'Phân tích đề'}</button>
    </section>

    {error && <div className="alert alert-error shuffle-error" role="alert">{error}</div>}
    {analysis && <>
      <section className="glass-panel shuffle-panel">
        <h2>Kết quả phân tích: {analysis.total} câu</h2>
        <div className="shuffle-counts">{analysis.sections.map(section => <span key={section.part}>Phần {section.part}: <strong>{section.count} câu</strong></span>)}</div>
        {!!analysis.errors.length && <div className="alert alert-error" role="alert"><div><strong>Cần sửa đề gốc trước khi trộn:</strong><ul>{analysis.errors.map((message, i) => <li key={i}>{message}</li>)}</ul></div></div>}
        {!!analysis.warnings.length && <div className="alert alert-info"><div>{analysis.warnings.map((message, i) => <p key={i}>{message}</p>)}</div></div>}
        <p className="tex-hint">Xem nhanh phần chữ và đáp án đã nhận diện. Công thức MathType và hình có thể không hiện trong phần xem nhanh, nhưng được giữ trong file Word xuất ra.</p>
        {analysis.sections.map(section => <div className="shuffle-section" key={section.part}>
          <h3>Phần {section.part}</h3>
          {section.questions.map((question, index) => <details key={index} className="shuffle-question">
            <summary><span>Câu {question.number}</span><strong className={question.errors.length ? 'shuffle-invalid' : 'shuffle-answer'}>{question.answer || 'Chưa xác định đáp án'}</strong></summary>
            <p className="shuffle-text">{question.text}</p>
            {!!question.options.length && <div className="shuffle-options">{question.options.map((option, i) => <span key={i} className={option.correct ? 'shuffle-answer' : ''}>{option.label}: {section.part === 'II' ? (option.correct ? 'Đúng' : 'Sai') : (option.correct ? 'Đáp án đúng ✓' : 'Không chọn')}</span>)}</div>}
            {question.solution && <details><summary>Lời giải gốc</summary><p className="shuffle-text">{question.solution}</p></details>}
            {question.errors.map((message, i) => <p key={i} className="shuffle-invalid">{message}</p>)}
          </details>)}
        </div>)}
      </section>
      <section className="glass-panel shuffle-panel">
        <h2>2. Tạo mã đề</h2>
        <div className="shuffle-settings">
          <label>Sở GDĐT<input type="text" maxLength={120} value={department} disabled={!!busy} onChange={e => { setDepartment(e.target.value); setResult(null); }} /></label>
          <label>Trường THPT<input type="text" maxLength={120} value={school} disabled={!!busy} onChange={e => { setSchool(e.target.value); setResult(null); }} /></label>
        </div>
        <div className="shuffle-heading-preview" aria-label="Xem trước đầu đề">
          <div><span>{department}</span><strong>{school}</strong></div>
          <div><strong>ĐỀ THI THỬ TN THPT 2027</strong><strong>MÔN: TOÁN</strong><em>Thời gian làm bài: 90 phút</em></div>
          <b>Mã đề: {startCode}</b>
        </div>
        <div className="shuffle-settings">
          <label>Số đề cần tạo<input type="number" min="1" max="50" value={count} disabled={!!busy} onChange={e => { setCount(e.target.value); setResult(null); }} /></label>
          <label>Mã đề bắt đầu<input type="text" inputMode="numeric" maxLength={4} value={startCode} disabled={!!busy} onChange={e => { setStartCode(e.target.value); setResult(null); }} /></label>
        </div>
        <label className="shuffle-checkbox"><input type="checkbox" checked={solutions} disabled={!!busy} onChange={e => { setSolutions(e.target.checked); setResult(null); }} /> Kèm bản giáo viên có đáp án đánh dấu và lời giải</label>
        <p>Trộn câu trong cùng phần và trộn phương án A–D ở Phần I, cập nhật đáp án tương ứng. Phần II giữ thứ tự ý a–d. Mỗi phần được đánh lại số câu từ 1.</p>
        <p>ZIP gồm đề học sinh, bản giáo viên nếu chọn, Excel đáp án TNmaker 2025 và bảng đối chiếu câu gốc. Bản học sinh bỏ dấu đáp án và lời giải.</p>
        <p className="tex-hint">Từ 1–50 mã đề; mã gồm 3–4 chữ số. Các mã đề được tạo lần lượt và gộp thành một ZIP. Giữ trang mở cho đến khi hoàn tất.</p>
        {!validSettings && <p className="shuffle-invalid">Điền tên Sở/Trường; kiểm tra số đề (1–50) và mã đề (3–4 chữ số, mã cuối không quá 9999).</p>}
        <button className="btn btn-primary btn-lg" disabled={!!busy || !!analysis.errors.length || !validSettings} onClick={generate}>{busy === 'export' ? <><span className="spinner" /> Đã tạo {progress}/{count} mã đề…</> : 'Trộn đề và tạo ZIP'}</button>
        {busy === 'export' && <button className="btn btn-secondary" onClick={() => controller.current?.abort()}>Hủy tạo đề</button>}
        {result && <div className="alert alert-success" role="status"><span>Đã tạo {result.count} mã đề. <a href={result.download_url} download="Tron-de-Word.zip">Tải ZIP đề Word và Excel đáp án</a></span></div>}
        <p className="tex-hint">Excel dùng <a href="https://tnmaker.net/nap-dap-an-phieu-tltn-2025/" target="_blank" rel="noreferrer">mẫu nhập trực tiếp TNmaker 2025</a>, một sheet “Dữ liệu”. Khi nhập, chọn phiếu 2025 và đặt đúng số câu từng phần.</p>
      </section>
    </>}
  </div></main>;
}
