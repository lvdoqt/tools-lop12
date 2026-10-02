import { useEffect, useMemo, useState } from 'react';
import { Camera, LogIn, LogOut, Plus, Printer, Save, UserPlus } from 'lucide-react';

const api = async (path, options = {}, token = '') => {
  const response = await fetch(`/api/teacher${path}`, { ...options, headers: {
    'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}),
  } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.msg || 'Có lỗi xảy ra.');
  return data;
};

function AnswerSheet({ exam }) {
  const bubbles = useMemo(() => exam.answers.flatMap((_, i) => {
    const group = Math.floor(i / 30), row = i % 30;
    return ['A', 'B', 'C', 'D'].map((answer, option) => ({
      answer, number: i + 1, x: 12 + option * 4 + group * 22, y: 24.5 + row * 2.25,
    }));
  }), [exam]);
  return <section className="omr-paper">
    <header><b>{exam.title}</b><h2>PHIẾU TRẢ LỜI TRẮC NGHIỆM</h2><p>Tô kín một ô cho mỗi câu. Không gấp hoặc làm nhòe phiếu.</p></header>
    <div className="omr-code">MÃ ĐỀ: {exam.id.slice(0, 8).toUpperCase()}</div>
    <div className="omr-name">Họ và tên: __________________________________　Lớp: __________</div>
    <div className="omr-instructions">Chụp trọn phiếu theo chiều dọc, đủ sáng và đặt phẳng.</div>
    {Array.from({ length: exam.answers.length }, (_, i) => {
      const group = Math.floor(i / 30), row = i % 30;
      return <div key={i} className="omr-question" style={{ left: `${2 + group * 22}%`, top: `${24.5 + row * 2.25}%` }}>Câu {i + 1}</div>;
    })}
    {bubbles.map((bubble, i) => <span key={i} className="omr-bubble" style={{ left: `${bubble.x}%`, top: `${bubble.y}%` }}>{bubble.answer}</span>)}
    <i className="omr-corner tl"/><i className="omr-corner tr"/><i className="omr-corner bl"/><i className="omr-corner br"/>
  </section>;
}

export default function TeacherPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem('teacher-token') || '');
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [fullName, setFullName] = useState('');
  const [exams, setExams] = useState([]); const [title, setTitle] = useState(''); const [count, setCount] = useState(20);
  const [history, setHistory] = useState([]);
  const [answers, setAnswers] = useState(Array(20).fill('A')); const [selected, setSelected] = useState('');
  const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [result, setResult] = useState(null);
  const selectedExam = exams.find((exam) => exam.id === selected);
  const loadExams = async (accessToken) => { const [nextExams, nextHistory] = await Promise.all([api('/exams', {}, accessToken), api('/results', {}, accessToken)]); setExams(nextExams); setHistory(nextHistory); };
  useEffect(() => { if (token) loadExams(token).catch((e) => { setError(e.message); if (e.message.includes('đăng nhập')) { setToken(''); sessionStorage.removeItem('teacher-token'); } }); }, [token]);
  const changeCount = (value) => { const next = Math.max(1, Math.min(120, Number(value) || 1)); setCount(next); setAnswers((old) => Array.from({ length: next }, (_, i) => old[i] || 'A')); };
  const submitAuth = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (authMode === 'signup') {
        const response = await api('/signup', { method: 'POST', body: JSON.stringify({ email, password, full_name: fullName }) });
        if (response.session?.access_token) { sessionStorage.setItem('teacher-token', response.session.access_token); setToken(response.session.access_token); }
        else setNotice(response.message);
      } else {
        const session = await api('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
        sessionStorage.setItem('teacher-token', session.access_token); setToken(session.access_token);
      }
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const createExam = async (event) => {
    event.preventDefault(); setError(''); setBusy(true);
    try { const exam = await api('/exams', { method: 'POST', body: JSON.stringify({ title, answers }) }, token); setExams([exam, ...exams]); setSelected(exam.id); setTitle(''); setResult(null); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const scan = async (file) => {
    if (!file || !selectedExam) return; setError(''); setNotice(''); setBusy(true); setResult(null);
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1800 / bitmap.width, 2400 / bitmap.height);
      const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      const image = canvas.toDataURL('image/jpeg', 0.86);
      const scored = await api(`/exams/${selectedExam.id}/scan`, { method: 'POST', body: JSON.stringify({ image }) }, token);
      setResult(scored); await loadExams(token);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const logout = () => { sessionStorage.removeItem('teacher-token'); setToken(''); setExams([]); setSelected(''); };

  return <main className="main-content teacher-page">
    <div className="teacher-heading"><div><span className="eyebrow">CÔNG CỤ GIÁO VIÊN</span><h1>Chấm phiếu trắc nghiệm</h1><p>Tạo đáp án, in phiếu và chấm ảnh trực tiếp bằng điện thoại.</p></div>{token && <button className="teacher-button secondary" onClick={logout}><LogOut size={17}/> Đăng xuất</button>}</div>
    {error && <div className="teacher-alert error">{error}</div>}{notice && <div className="teacher-alert">{notice}</div>}
    {!token ? <form className="teacher-card teacher-auth" onSubmit={submitAuth}>
      <h2>{authMode === 'login' ? 'Đăng nhập giáo viên' : 'Đăng ký tài khoản giáo viên'}</h2>
      {authMode === 'signup' && <label>Họ và tên<input required minLength="2" value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>}
      <label>Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Mật khẩu<input required type="password" minLength="8" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <button className="teacher-button" disabled={busy}>{authMode === 'login' ? <LogIn size={18}/> : <UserPlus size={18}/>} {busy ? 'Đang xử lý…' : authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</button>
      <button type="button" className="teacher-link" onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}>{authMode === 'login' ? 'Giáo viên mới? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}</button>
    </form> : <div className="teacher-layout">
      <section className="teacher-card">
        <h2>Tạo đề mới</h2><form onSubmit={createExam}>
          <label>Tên đề<input required maxLength="160" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Kiểm tra chương 1" /></label>
          <label>Số câu<input type="number" min="1" max="120" value={count} onChange={(e) => changeCount(e.target.value)} /></label>
          <div className="answer-editor">{answers.map((answer, i) => <label key={i}>Câu {i + 1}<select value={answer} onChange={(e) => setAnswers((old) => old.map((v, j) => j === i ? e.target.value : v))}>{['A','B','C','D'].map((v) => <option key={v}>{v}</option>)}</select></label>)}</div>
          <button className="teacher-button" disabled={busy}><Save size={17}/> Lưu đề</button>
        </form>
      </section>
      <section className="teacher-card">
        <h2>Đề đã tạo</h2>{exams.length ? <div className="exam-list">{exams.map((exam) => <button key={exam.id} className={`exam-item ${selected === exam.id ? 'active' : ''}`} onClick={() => { setSelected(exam.id); setResult(null); }}><b>{exam.title}</b><span>{exam.answers.length} câu · {new Date(exam.created_at).toLocaleDateString('vi-VN')}</span></button>)}</div> : <p className="teacher-muted">Chưa có đề thi.</p>}
        {selectedExam && <><div className="exam-actions"><button className="teacher-button secondary" onClick={() => window.print()}><Printer size={17}/> In phiếu trả lời</button><label className="teacher-button"><Camera size={17}/> Chụp / chọn ảnh<input className="file-input" type="file" accept="image/*" capture="environment" disabled={busy} onChange={(e) => scan(e.target.files?.[0])}/></label></div><p className="teacher-hint">Chụp trọn trang, thẳng góc, đủ sáng. Phiếu được nhận diện tự động.</p></>}
        {busy && <p className="teacher-muted">Đang xử lý…</p>}
        {result && <div className="score-result"><strong>{result.score}/{result.total}</strong><span> câu đúng</span>{result.uncertain_questions.length > 0 && <p>Cần kiểm tra câu: {result.uncertain_questions.join(', ')}</p>}<div className="detected-answers">{result.answers.map((a, i) => <span key={i} className={a === selectedExam.answers[i] ? 'correct' : 'wrong'}>{i + 1}. {a || '?'}</span>)}</div></div>}
      </section>
      <section className="teacher-card teacher-history"><h2>Lịch sử chấm gần đây</h2>{history.length ? <div className="history-list">{history.map((item) => <div className="history-item" key={item.id}><b>{exams.find((exam) => exam.id === item.exam_id)?.title || 'Đề thi'}</b><span>{item.score}/{item.total} câu đúng · {new Date(item.created_at).toLocaleString('vi-VN')}</span>{item.uncertain_questions?.length > 0 && <small>Cần xem lại câu: {item.uncertain_questions.join(', ')}</small>}</div>)}</div> : <p className="teacher-muted">Chưa có kết quả chấm.</p>}</section>
      {selectedExam && <div className="print-only"><AnswerSheet exam={selectedExam}/></div>}
    </div>}
  </main>;
}
