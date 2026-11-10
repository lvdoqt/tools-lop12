import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
  const [subject, setSubject] = useState('toan');
  const [groupConfigs, setGroupConfigs] = useState({});
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
    setAnalysis(null); setResult(null); setError(''); setFile(null); setGroupConfigs({});
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith('.docx') || selected.size > 4 * 1024 * 1024 || !selected.size) {
      setError('Chọn file .docx không rỗng, tối đa 4 MB. Với .doc, hãy mở Word và lưu thành .docx.');
      event.target.value = ''; return;
    }
    setFile(selected);
  }

  async function analyze() {
    controller.current = new AbortController();
    setBusy('analyze'); setError(''); setAnalysis(null); setResult(null); setGroupConfigs({});
    try {
      const data = await (await request(file, 'analyze', { subject }, controller.current.signal)).json();
      setAnalysis(data);
      const initialConfigs = {};
      (data.sections || []).forEach(sec => {
        initialConfigs[sec.part] = {
          fixed_position: !!sec.fixed_position,
          mode: sec.mode ?? 3,
        };
      });
      setGroupConfigs(initialConfigs);
    }
    catch (err) { if (err.name !== 'AbortError') setError(err.message); }
    finally { setBusy(''); }
  }

  function updateGroupConfig(part, key, value) {
    setGroupConfigs(prev => ({
      ...prev,
      [part]: { ...prev[part], [key]: value }
    }));
    setResult(null);
  }

  async function generate() {
    controller.current = new AbortController();
    const signal = controller.current.signal;
    setBusy('export'); setProgress(0); setError(''); setResult(null);
    try {
      const files = {};
      const seed = crypto.randomUUID();
      for (let index = 0; index < Number(count); index++) {
        const response = await request(file, 'export', {
          count,
          start_code: startCode,
          include_solutions: solutions,
          seed,
          variant_index: index,
          department,
          school,
          subject,
          group_settings: JSON.stringify(groupConfigs),
        }, signal);
        const entries = unzipSync(new Uint8Array(await response.arrayBuffer()));
        for (const [name, data] of Object.entries(entries)) {
          if (!files[name]) files[name] = data;
        }
        setProgress(index + 1);
      }
            try {
        if (files['Doi_chieu_cau_goc.json']) {
          const mapping = JSON.parse(new TextDecoder().decode(files['Doi_chieu_cau_goc.json']));
          const keys = {};
          for (const [code, parts] of Object.entries(mapping)) {
            if (parts.I || parts.II || parts.III) {
              keys[code] = {
                part1: Object.fromEntries((parts.I || []).map(q => [q.cau_moi, q.dap_an])),
                part2: Object.fromEntries((parts.II || []).map(q => [q.cau_moi, q.dap_an])),
                part3: Object.fromEntries((parts.III || []).map(q => [q.cau_moi, q.dap_an])),
              };
            } else {
              const allQ = Object.values(parts).flat();
              keys[code] = {
                part1: Object.fromEntries(allQ.map(q => [q.cau_moi, q.dap_an])),
                part2: {},
                part3: {},
              };
            }
          }
          localStorage.setItem('exam_answer_keys_2025', JSON.stringify(keys));
        }
      } catch (e) {
        console.warn('Could not cache keys for grader:', e);
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
      <div className="shuffle-subject-tabs">
        <button
          className={`btn ${subject === 'toan' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setSubject('toan'); setAnalysis(null); setResult(null); setFile(null); }}
          disabled={!!busy}
        >📐 Môn Toán</button>
        <button
          className={`btn ${subject === 'tieng_anh' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setSubject('tieng_anh'); setAnalysis(null); setResult(null); setFile(null); }}
          disabled={!!busy}
        >🔤 Môn Tiếng Anh</button>
      </div>
      {subject === 'toan' ? <>
        <p>Đề có thể gồm một hoặc nhiều trong ba phần PHẦN I, PHẦN II, PHẦN III. Mỗi câu bắt đầu bằng “Câu 1.” hoặc “Câu 1:”, có thể in đậm. Phần I gạch chân nhãn đáp án đúng A/B/C/D.</p>
        <p>Phần II nhận nhãn ý đúng a/b/c/d được gạch chân, hoặc kết luận “a) ĐÚNG”, “b) SAI”… trong Lời giải (không phân biệt chữ hoa/thường). Nếu không gạch chân, hãy ghi đủ kết luận cho cả bốn ý.</p>
        <p>Phần III lấy số sau “Đáp án:”, “Đáp số:” hoặc “Trả lời:” dưới “Lời giải”. Chấp nhận dấu phẩy/chấm thập phân và bỏ dấu chấm kết câu: “Đáp số: 446.” → 446.</p>
      </> : <>
        <div className="shuffle-guide-card">
          <strong>📌 Hướng dẫn tạo &amp; cấu hình đề Tiếng Anh để trộn:</strong>
          <ul>
            <li>Đặt mã <code>&lt;g&gt;</code> trước các phần trong đề hoặc <strong>tùy chỉnh trực tiếp trên web</strong> sau khi bấm &quot;Phân tích đề&quot;:</li>
            <li><code>&lt;g0&gt;</code>: Không trộn cả câu hỏi lẫn đáp án của Question.</li>
            <li><code>&lt;g1&gt;</code>: Chỉ hoán vị vị trí các Question, các đáp án trong Question không đảo.</li>
            <li><code>&lt;g2&gt;</code>: Chỉ hoán vị vị trí các đáp án trong Question, giữ nguyên vị trí Question (chuẩn cho bài điền khuyết / nghe).</li>
            <li><code>&lt;g3&gt;</code>: Hoán vị cả câu hỏi lẫn đáp án trong phần đó.</li>
            <li>Thêm dấu <code>#</code> (ví dụ: <code>&lt;#g0&gt;</code>, <code>&lt;#g1&gt;</code>, <code>&lt;#g2&gt;</code>, <code>&lt;#g3&gt;</code>) để <strong>giữ nguyên vị trí của phần đó trong đề</strong>.</li>
            <li>Nếu không có dấu <code>#</code>, vị trí các phần sẽ được hoán vị với nhau khi tạo mã đề mới.</li>
          </ul>
        </div>
      </>}
      <label className="pdf-upload-zone"><input aria-label="Chọn đề Word" type="file" accept=".docx" disabled={!!busy} onChange={selectFile} />
        <strong>{file ? file.name : 'Chọn đề Word (.docx)'}</strong><span>Tối đa 4 MB • Giữ nguyên Equation / MathType và hình nhúng</span>
      </label>
      <button className="btn btn-primary" disabled={!file || !!busy} onClick={analyze}>{busy === 'analyze' ? 'Đang đọc đề…' : 'Phân tích đề'}</button>
    </section>

    {error && <div className="alert alert-error shuffle-error" role="alert">{error}</div>}
    {analysis && <>
      <section className="glass-panel shuffle-panel">
        <h2>Kết quả phân tích: {analysis.total} câu</h2>
        <div className="shuffle-counts">{analysis.sections.map(section => {
          const cfg = groupConfigs[section.part] || { fixed_position: section.fixed_position, mode: section.mode ?? 3 };
          return (
            <span key={section.part}>
              {section.part.startsWith('Nhóm') || section.part.startsWith('Phần') ? section.part : `Phần ${section.part}`}: <strong>{section.count} câu</strong>
              <code style={{ marginLeft: '6px', fontSize: '0.88em', background: cfg.fixed_position ? '#dcfce7' : '#e0f2fe', color: cfg.fixed_position ? '#15803d' : '#0369a1', padding: '2px 6px', borderRadius: '4px' }}>
                {`<${cfg.fixed_position ? '#' : ''}g${cfg.mode}>`}
              </code>
            </span>
          );
        })}</div>
        {!!analysis.errors.length && <div className="alert alert-error" role="alert"><div><strong>Cần sửa đề gốc trước khi trộn:</strong><ul>{analysis.errors.map((message, i) => <li key={i}>{message}</li>)}</ul></div></div>}
        {!!analysis.warnings.length && <div className="alert alert-info"><div>{analysis.warnings.map((message, i) => <p key={i}>{message}</p>)}</div></div>}
        <p className="tex-hint">Xem nhanh phần chữ và đáp án đã nhận diện. Công thức MathType và hình có thể không hiện trong phần xem nhanh, nhưng được giữ trong file Word xuất ra.</p>
        {analysis.sections.map(section => {
          const cfg = groupConfigs[section.part] || { fixed_position: section.fixed_position, mode: section.mode ?? 3 };
          return (
            <div className="shuffle-section" key={section.part}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <h3>{section.part.startsWith('Nhóm') || section.part.startsWith('Phần') ? section.part : `Phần ${section.part}`}</h3>
                <span className={`tag-badge ${cfg.fixed_position ? 'tag-fixed' : 'tag-floating'}`}>
                  {`<${cfg.fixed_position ? '#' : ''}g${cfg.mode}>`}
                </span>
              </div>
              <div className="group-config-box">
                <label className="group-config-checkbox">
                  <input
                    type="checkbox"
                    checked={!!cfg.fixed_position}
                    disabled={!!busy}
                    onChange={e => updateGroupConfig(section.part, 'fixed_position', e.target.checked)}
                  />
                  <span>Giữ nguyên vị trí phần này trong đề (<code>#</code>)</span>
                </label>
                <label className="group-config-mode">
                  <span>Quy tắc trộn:</span>
                  <select
                    value={cfg.mode}
                    disabled={!!busy}
                    onChange={e => updateGroupConfig(section.part, 'mode', Number(e.target.value))}
                  >
                    <option value={0}>&lt;g0&gt; : Không trộn cả câu hỏi lẫn đáp án</option>
                    <option value={1}>&lt;g1&gt; : Chỉ hoán vị câu hỏi (giữ nguyên đáp án)</option>
                    <option value={2}>&lt;g2&gt; : Chỉ hoán vị đáp án A–D (giữ nguyên thứ tự câu)</option>
                    <option value={3}>&lt;g3&gt; : Hoán vị cả câu hỏi lẫn đáp án A–D</option>
                  </select>
                </label>
              </div>
              {section.questions.map((question, index) => <details key={index} className="shuffle-question">
                <summary><span>Câu {question.number}</span><strong className={question.errors.length ? 'shuffle-invalid' : 'shuffle-answer'}>{question.answer || 'Chưa xác định đáp án'}</strong></summary>
                <p className="shuffle-text">{question.text}</p>
                {!!question.options.length && <div className="shuffle-options">{question.options.map((option, i) => <span key={i} className={option.correct ? 'shuffle-answer' : ''}>{option.label}: {section.part === 'II' ? (option.correct ? 'Đúng' : 'Sai') : (option.correct ? 'Đáp án đúng ✓' : 'Không chọn')}</span>)}</div>}
                {question.solution && <details><summary>Lời giải gốc</summary><p className="shuffle-text">{question.solution}</p></details>}
                {question.errors.map((message, i) => <p key={i} className="shuffle-invalid">{message}</p>)}
              </details>)}
            </div>
          );
        })}
      </section>
      <section className="glass-panel shuffle-panel">
        <h2>2. Tạo mã đề</h2>
        <div className="shuffle-settings">
          <label>Sở GDĐT<input type="text" maxLength={120} value={department} disabled={!!busy} onChange={e => { setDepartment(e.target.value); setResult(null); }} /></label>
          <label>Trường THPT<input type="text" maxLength={120} value={school} disabled={!!busy} onChange={e => { setSchool(e.target.value); setResult(null); }} /></label>
        </div>
        <div className="shuffle-heading-preview" aria-label="Xem trước đầu đề">
          <div><span>{department}</span><strong>{school}</strong></div>
          <div><strong>ĐỀ THI THỬ TN THPT 2027</strong><strong>{subject === 'tieng_anh' ? 'MÔN: TIẾNG ANH' : 'MÔN: TOÁN'}</strong><em>{subject === 'tieng_anh' ? 'Thời gian làm bài: 60 phút' : 'Thời gian làm bài: 90 phút'}</em></div>
          <b>Mã đề: {startCode}</b>
        </div>
        <div className="shuffle-settings">
          <label>Số đề cần tạo<input type="number" min="1" max="50" value={count} disabled={!!busy} onChange={e => { setCount(e.target.value); setResult(null); }} /></label>
          <label>Mã đề bắt đầu<input type="text" inputMode="numeric" maxLength={4} value={startCode} disabled={!!busy} onChange={e => { setStartCode(e.target.value); setResult(null); }} /></label>
        </div>
        <label className="shuffle-checkbox"><input type="checkbox" checked={solutions} disabled={!!busy} onChange={e => { setSolutions(e.target.checked); setResult(null); }} /> Kèm bản giáo viên có đáp án đánh dấu và lời giải</label>
        {subject === 'tieng_anh' ? (
          <p>Trộn theo cấu hình từng phần (&lt;g0&gt;–&lt;g3&gt; và dấu # cố định vị trí), hoán vị các phần không có #. Tự động đánh lại số câu liên tục từ 1.</p>
        ) : (
          <p>Trộn câu trong cùng phần và trộn phương án A–D ở Phần I, cập nhật đáp án tương ứng. Phần II giữ thứ tự ý a–d. Mỗi phần được đánh lại số câu từ 1.</p>
        )}
        <p>ZIP gồm đề học sinh, bản giáo viên nếu chọn, Excel đáp án TNmaker 2025 và bảng đối chiếu câu gốc. Bản học sinh bỏ dấu đáp án và lời giải.</p>
        <p className="tex-hint">Từ 1–50 mã đề; mã gồm 3–4 chữ số. Các mã đề được tạo lần lượt và gộp thành một ZIP. Giữ trang mở cho đến khi hoàn tất.</p>
        {!validSettings && <p className="shuffle-invalid">Điền tên Sở/Trường; kiểm tra số đề (1–50) và mã đề (3–4 chữ số, mã cuối không quá 9999).</p>}
        <button className="btn btn-primary btn-lg" disabled={!!busy || !!analysis.errors.length || !validSettings} onClick={generate}>{busy === 'export' ? <><span className="spinner" /> Đã tạo {progress}/{count} mã đề…</> : 'Trộn đề và tạo ZIP'}</button>
        {busy === 'export' && <button className="btn btn-secondary" onClick={() => controller.current?.abort()}>Hủy tạo đề</button>}
        {result && <div className="alert alert-success" role="status">
          <div>
            <p style={{ margin: 0 }}>Đã tạo {result.count} mã đề. <a href={result.download_url} download="Tron-de-Word.zip" style={{ fontWeight: 700 }}>Tải ZIP đề Word và Excel đáp án</a></p>
            <div style={{ marginTop: '0.75rem' }}>
              <Link to="/cham-thi" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', fontWeight: 700 }}>
                ✓ Mở Chấm trắc nghiệm với {result.count} mã đề vừa tạo
              </Link>
            </div>
          </div>
        </div>}
        <p className="tex-hint">Excel dùng <a href="https://tnmaker.net/nap-dap-an-phieu-tltn-2025/" target="_blank" rel="noreferrer">mẫu nhập trực tiếp TNmaker 2025</a>, một sheet “Dữ liệu”. Khi nhập, chọn phiếu 2025 và đặt đúng số câu từng phần.</p>
      </section>
    </>}
  </div></main>;
}
