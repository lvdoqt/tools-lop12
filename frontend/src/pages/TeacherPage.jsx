import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  FileSpreadsheet,
  FileText,
  LogIn,
  LogOut,
  Printer,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  UserPlus,
  X,
  ZoomIn
} from 'lucide-react';

const api = async (path, options = {}, token = '') => {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(`/api/teacher${path}`, {
    ...options,
    headers,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.msg || 'Có lỗi xảy ra.');
  return data;
};

function parseQuickAnswers(rawText) {
  if (!rawText || !rawText.trim()) return [];
  const cleaned = rawText.toUpperCase();
  const matches = cleaned.match(/\b(?:\d+[\.\s:]*)?([ABCD])\b/g);
  if (matches && matches.length > 0) {
    const list = matches.map((m) => {
      const char = m.slice(-1);
      return ['A', 'B', 'C', 'D'].includes(char) ? char : null;
    }).filter(Boolean);
    if (list.length > 0) return list;
  }
  return cleaned.replace(/[^ABCD]/g, '').split('');
}

/**
 * Phiếu trả lời trắc nghiệm theo mẫu chuẩn TN THPT 2025 - 2026 (TNMaker)
 * - Khung thông tin thí sinh, giám thị
 * - Khung Số Báo Danh (8 cột số + ma trận bóng 0..9)
 * - Khung Mã Đề Thi (4 cột số + ma trận bóng 0..9)
 * - Khung Hướng dẫn tô chuẩn
 * - 4 góc vuông đen định vị OMR OpenCV 7mm x 7mm
 */
function AnswerSheet({ exam }) {
  const bubbles = useMemo(() => exam.answers.flatMap((_, i) => {
    const group = Math.floor(i / 30);
    const row = i % 30;
    return ['A', 'B', 'C', 'D'].map((answer, option) => ({
      answer,
      number: i + 1,
      x: 12 + option * 4 + group * 22,
      y: 24.5 + row * 2.25,
    }));
  }), [exam]);

  const examCode = useMemo(() => {
    const raw = (exam.title.match(/\b\d{3,4}\b/) || [exam.id.slice(0, 4)])[0];
    return raw.padStart(4, '0').slice(-4);
  }, [exam]);

  return (
    <section className="omr-paper">
      {/* 4 dấu góc định vị OMR 7mm x 7mm cho OpenCV */}
      <i className="omr-corner tl" />
      <i className="omr-corner tr" />
      <i className="omr-corner bl" />
      <i className="omr-corner br" />

      {/* HEADER PHIẾU THI THPT 2026 */}
      <div className="omr-header-section">
        <div className="omr-header-left">
          <p>SỞ GD&ĐT: ......................................................</p>
          <p>TRƯỜNG THPT: ................................................</p>
        </div>
        <div className="omr-header-center">
          <h2>PHIẾU TRẢ LỜI TRẮC NGHIỆM</h2>
          <span className="exam-subtitle">KỲ THI TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG NĂM 2026</span>
          <div className="exam-name-banner">Bài thi / Môn: <b>{exam.title}</b></div>
        </div>
      </div>

      {/* KHUNG THÔNG TIN & KHUNG TÔ SBD / MÃ ĐỀ (TNMaker 2025-2026) */}
      <div className="omr-meta-section">
        {/* Bên trái: Thông tin thí sinh & Hướng dẫn */}
        <div className="omr-candidate-info">
          <div className="info-row">
            <span>Họ và tên thí sinh:</span> __________________________________________________
          </div>
          <div className="info-row-flex">
            <div><span>Ngày sinh:</span> ...../...../.........</div>
            <div><span>Lớp:</span> ____________</div>
            <div><span>Phòng thi:</span> ______</div>
          </div>
          <div className="info-row-flex">
            <div><span>Chữ ký CB coi thi 1:</span> ........................</div>
            <div><span>Chữ ký CB coi thi 2:</span> ........................</div>
          </div>

          <div className="omr-guide-box">
            <b>HƯỚNG DẪN TÔ BÓNG CHÌ</b>
            <div className="guide-items">
              <span>ĐÚNG: <b className="bubble-sample filled">●</b></span>
              <span>SAI: <b className="bubble-sample">○</b> <b className="bubble-sample">✕</b> <b className="bubble-sample">✔</b></span>
              <small>Dùng bút chì 2B tô kín ô tròn. Không gập hoặc làm bẩn phiếu.</small>
            </div>
          </div>
        </div>

        {/* Ở giữa: SỐ BÁO DANH (8 CỘT SỐ) */}
        <div className="omr-matrix-box sbd-box">
          <div className="matrix-title">SỐ BÁO DANH</div>
          <div className="matrix-digits-input">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((col) => (
              <span key={col} className="matrix-digit-cell" />
            ))}
          </div>
          <div className="matrix-bubbles-grid cols-8">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <div key={digit} className="matrix-row">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((col) => (
                  <span key={col} className="matrix-bubble">{digit}</span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Bên phải: MÃ ĐỀ THI (4 CỘT SỐ) */}
        <div className="omr-matrix-box code-box">
          <div className="matrix-title">MÃ ĐỀ THI</div>
          <div className="matrix-digits-input">
            {examCode.split('').map((char, col) => (
              <span key={col} className="matrix-digit-cell prefilled">{char}</span>
            ))}
          </div>
          <div className="matrix-bubbles-grid cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <div key={digit} className="matrix-row">
                {[0, 1, 2, 3].map((col) => (
                  <span key={col} className="matrix-bubble">{digit}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="omr-part-banner">
        <span>PHẦN TRẢ LỜI TRẮC NGHIỆM (TÔ KÍN MỘT Ô CHO MỖI CÂU)</span>
      </div>

      {/* CÁC CỘT CÂU HỎI TRẮC NGHIỆM */}
      {Array.from({ length: exam.answers.length }, (_, i) => {
        const group = Math.floor(i / 30);
        const row = i % 30;
        return (
          <div
            key={i}
            className="omr-question"
            style={{ left: `${2 + group * 22}%`, top: `${24.5 + row * 2.25}%` }}
          >
            Câu {i + 1}
          </div>
        );
      })}

      {bubbles.map((bubble, i) => (
        <span
          key={i}
          className="omr-bubble"
          style={{ left: `${bubble.x}%`, top: `${bubble.y}%` }}
        >
          {bubble.answer}
        </span>
      ))}
    </section>
  );
}

export default function TeacherPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem('teacher-token') || '');
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const [exams, setExams] = useState([]);
  const [title, setTitle] = useState('');
  const [count, setCount] = useState(20);
  const [answers, setAnswers] = useState(Array(20).fill('A'));
  const [quickInput, setQuickInput] = useState('');
  const [showQuickInput, setShowQuickInput] = useState(false);

  // File import state (Excel / JSON)
  const [importedVariants, setImportedVariants] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [batchCreating, setBatchCreating] = useState(false);

  const [selected, setSelected] = useState('');
  const [history, setHistory] = useState([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Scan & Grading result
  const [result, setResult] = useState(null);
  const [editedAnswers, setEditedAnswers] = useState([]);
  const [hasEdits, setHasEdits] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);

  const selectedExam = exams.find((exam) => exam.id === selected);

  const loadExams = async (accessToken) => {
    const [nextExams, nextHistory] = await Promise.all([
      api('/exams', {}, accessToken),
      api('/results', {}, accessToken),
    ]);
    setExams(nextExams);
    setHistory(nextHistory);
  };

  useEffect(() => {
    if (token) {
      loadExams(token).catch((e) => {
        setError(e.message);
        if (e.message.includes('đăng nhập')) {
          setToken('');
          sessionStorage.removeItem('teacher-token');
        }
      });
    }
  }, [token]);

  useEffect(() => {
    if (result && result.answers) {
      setEditedAnswers([...result.answers]);
      setHasEdits(false);
    }
  }, [result]);

  const changeCount = (value) => {
    const next = Math.max(1, Math.min(120, Number(value) || 1));
    setCount(next);
    setAnswers((old) => Array.from({ length: next }, (_, i) => old[i] || 'A'));
  };

  const applyQuickAnswers = () => {
    const parsed = parseQuickAnswers(quickInput);
    if (!parsed.length) {
      setError('Không tìm thấy đáp án hợp lệ trong chuỗi vừa dán.');
      return;
    }
    const safeLength = Math.min(120, parsed.length);
    const validList = parsed.slice(0, safeLength);
    setCount(safeLength);
    setAnswers(validList);
    setNotice(`Đã nạp ${safeLength} câu từ chuỗi đáp án.`);
    setShowQuickInput(false);
    setQuickInput('');
  };

  // Upload and parse Excel / JSON file
  const handleAnswerFileUpload = async (file) => {
    if (!file) return;
    setError('');
    setNotice('');
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api('/import-file', {
        method: 'POST',
        body: formData,
      }, token);

      if (res.variants && res.variants.length > 0) {
        setImportedVariants(res.variants);
        setImportFileName(res.filename);
        setShowImportModal(true);
        setNotice(`Đã phân tích thành công ${res.variants.length} mã đề từ file "${res.filename}".`);
      } else {
        throw new Error('Không tìm thấy mã đề nào trong file.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setUploadingFile(false);
    }
  };

  // Batch create all imported variants
  const handleBatchCreate = async () => {
    if (!importedVariants.length) return;
    setBatchCreating(true);
    setError('');
    try {
      const payload = {
        exams: importedVariants.map((v) => ({
          title: v.title,
          answers: v.answers,
        })),
      };
      const createdList = await api('/exams/batch', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, token);

      await loadExams(token);
      if (createdList.length > 0) {
        setSelected(createdList[0].id);
      }
      setShowImportModal(false);
      setNotice(`Đã lưu thành công ${createdList.length} mã đề vào hệ thống!`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBatchCreating(false);
    }
  };

  // Apply single imported variant into form editor
  const handleApplySingleVariant = (variant) => {
    setTitle(variant.title);
    setCount(variant.answers.length);
    setAnswers(variant.answers);
    setShowImportModal(false);
    setNotice(`Đã điền đáp án mã đề "${variant.code}" vào khung tạo đề.`);
  };

  const submitAuth = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (authMode === 'signup') {
        const response = await api('/signup', {
          method: 'POST',
          body: JSON.stringify({ email, password, full_name: fullName }),
        });
        if (response.session?.access_token) {
          sessionStorage.setItem('teacher-token', response.session.access_token);
          setToken(response.session.access_token);
        } else {
          setNotice(response.message);
        }
      } else {
        const session = await api('/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        sessionStorage.setItem('teacher-token', session.access_token);
        setToken(session.access_token);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const createExam = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const exam = await api('/exams', {
        method: 'POST',
        body: JSON.stringify({ title, answers }),
      }, token);
      setExams([exam, ...exams]);
      setSelected(exam.id);
      setTitle('');
      setResult(null);
      setNotice('Đã tạo đề thi thành công! Bạn có thể in phiếu trả lời ngay.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteExam = async (examId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa đề thi này không?')) return;
    setError('');
    try {
      await api(`/exams/${examId}`, { method: 'DELETE' }, token);
      setExams((prev) => prev.filter((e) => e.id !== examId));
      if (selected === examId) {
        setSelected('');
        setResult(null);
      }
      setNotice('Đã xóa đề thi.');
    } catch (e) {
      setError(e.message);
    }
  };

  const deleteResultItem = async (resId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa kết quả chấm này?')) return;
    setError('');
    try {
      await api(`/results/${resId}`, { method: 'DELETE' }, token);
      setHistory((prev) => prev.filter((h) => h.id !== resId));
      if (result?.id === resId) setResult(null);
      setNotice('Đã xóa kết quả chấm.');
    } catch (e) {
      setError(e.message);
    }
  };

  const scan = async (file) => {
    if (!file || !selectedExam) return;
    setError('');
    setNotice('');
    setBusy(true);
    setResult(null);
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1800 / bitmap.width, 2400 / bitmap.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const image = canvas.toDataURL('image/jpeg', 0.88);
      const scored = await api(`/exams/${selectedExam.id}/scan`, {
        method: 'POST',
        body: JSON.stringify({ image }),
      }, token);
      setResult(scored);
      await loadExams(token);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleOverrideAnswer = (index, newAnswer) => {
    const updated = [...editedAnswers];
    updated[index] = newAnswer;
    setEditedAnswers(updated);
    setHasEdits(true);
  };

  const saveEditedResult = async () => {
    if (!result?.id) return;
    setSavingEdit(true);
    setError('');
    try {
      const updated = await api(`/results/${result.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ answers: editedAnswers }),
      }, token);
      setResult((prev) => ({
        ...prev,
        score: updated.score,
        answers: updated.answers,
        uncertain_questions: updated.uncertain_questions,
      }));
      setHasEdits(false);
      setNotice('Đã cập nhật điểm số sau khi chỉnh sửa!');
      await loadExams(token);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem('teacher-token');
    setToken('');
    setExams([]);
    setSelected('');
    setResult(null);
  };

  const liveScore = useMemo(() => {
    if (!selectedExam || !editedAnswers.length) return result?.score || 0;
    return editedAnswers.filter((a, i) => a && a === selectedExam.answers[i]).length;
  }, [editedAnswers, selectedExam, result]);

  const scoreOnScale10 = useMemo(() => {
    const total = selectedExam?.answers?.length || 1;
    return ((liveScore / total) * 10).toFixed(2);
  }, [liveScore, selectedExam]);

  return (
    <main className="main-content teacher-page">
      <div className="teacher-heading">
        <div>
          <span className="eyebrow">CÔNG CỤ GIÁO VIÊN · OMR TN THPT 2026</span>
          <h1>Chấm trắc nghiệm trực tuyến (TNMaker 2026)</h1>
          <p>Hỗ trợ in phiếu chuẩn THPT 2026 (có ô SBD 8 số, Mã đề 4 số), nhập trực tiếp từ file Trộn đề Excel/JSON và quét ảnh chấm tự động.</p>
        </div>
        {token && (
          <button className="teacher-button secondary" onClick={logout}>
            <LogOut size={17} /> Đăng xuất
          </button>
        )}
      </div>

      {error && <div className="teacher-alert error">{error}</div>}
      {notice && <div className="teacher-alert">{notice}</div>}

      {!token ? (
        <form className="teacher-card teacher-auth" onSubmit={submitAuth}>
          <h2>{authMode === 'login' ? 'Đăng nhập giáo viên' : 'Đăng ký tài khoản giáo viên'}</h2>
          {authMode === 'signup' && (
            <label>
              Họ và tên
              <input
                required
                minLength="2"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Thầy / Cô Nguyễn Văn A"
              />
            </label>
          )}
          <label>
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="giaovien@truong.edu.vn"
            />
          </label>
          <label>
            Mật khẩu
            <input
              required
              type="password"
              minLength="8"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 8 ký tự"
            />
          </label>
          <button className="teacher-button" disabled={busy}>
            {authMode === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
            {busy ? 'Đang xử lý…' : authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </button>
          <button
            type="button"
            className="teacher-link"
            onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
          >
            {authMode === 'login' ? 'Giáo viên mới? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
          </button>
        </form>
      ) : (
        <div className="teacher-layout">
          {/* CỘT 1: TẠO ĐỀ & ĐÁP ÁN */}
          <section className="teacher-card">
            <div className="card-header-flex">
              <h2>Tạo đề & đáp án</h2>
              <div className="header-actions-group">
                <label className="teacher-btn-sm file-upload-label" title="Nhập trực tiếp Dap_an_TNMaker_2025.xlsx hoặc Doi_chieu_cau_goc.json">
                  <FileSpreadsheet size={15} /> {uploadingFile ? 'Đang đọc file…' : 'Nhập Excel / JSON'}
                  <input
                    type="file"
                    accept=".xlsx,.xls,.json"
                    className="file-input"
                    disabled={uploadingFile}
                    onChange={(e) => {
                      handleAnswerFileUpload(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="teacher-btn-sm"
                  onClick={() => setShowQuickInput(!showQuickInput)}
                >
                  <FileText size={15} /> {showQuickInput ? 'Đóng dán' : 'Dán chuỗi'}
                </button>
              </div>
            </div>

            {/* PANEL DÁN NHANH CHUỖI ĐÁP ÁN */}
            {showQuickInput && (
              <div className="quick-import-panel">
                <label>
                  Dán chuỗi đáp án (Ví dụ: <code>1A 2B 3C...</code> hoặc <code>ABCD ABCD...</code>)
                  <textarea
                    rows={3}
                    value={quickInput}
                    onChange={(e) => setQuickInput(e.target.value)}
                    placeholder="Dán chuỗi đáp án tại đây..."
                  />
                </label>
                <div className="quick-import-actions">
                  <button type="button" className="teacher-button" onClick={applyQuickAnswers}>
                    <Check size={16} /> Áp dụng vào đề
                  </button>
                  <button
                    type="button"
                    className="teacher-button secondary"
                    onClick={() => setShowQuickInput(false)}
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={createExam}>
              <label>
                Tên đề thi
                <input
                  required
                  maxLength="160"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Kiểm tra học kỳ Toán 12 — Mã 0101"
                />
              </label>

              <div className="form-row-2">
                <label>
                  Số câu hỏi (1 - 120)
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={count}
                    onChange={(e) => changeCount(e.target.value)}
                  />
                </label>
                <div className="answer-counter-badge">
                  <span>Tổng số câu:</span> <b>{answers.length}</b>
                </div>
              </div>

              <div className="answer-editor-header">
                <span>Thiết lập đáp án chuẩn:</span>
                <small className="teacher-muted">Nhấp chữ cái để chọn nhanh</small>
              </div>

              <div className="answer-editor-grid">
                {answers.map((answer, i) => (
                  <div key={i} className="answer-item-pill">
                    <span className="q-num">C{i + 1}</span>
                    <div className="opt-group">
                      {['A', 'B', 'C', 'D'].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className={`opt-btn ${answer === opt ? 'active' : ''}`}
                          onClick={() =>
                            setAnswers((old) => old.map((v, j) => (j === i ? opt : v)))
                          }
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button className="teacher-button full-width" disabled={busy}>
                <Save size={17} /> Lưu đề thi
              </button>
            </form>
          </section>

          {/* CỘT 2: ĐỀ ĐÃ TẠO & CHẤM BÀI */}
          <section className="teacher-card">
            <h2>Đề thi & Chấm bài</h2>
            {exams.length ? (
              <div className="exam-list">
                {exams.map((exam) => (
                  <div
                    key={exam.id}
                    className={`exam-item-container ${selected === exam.id ? 'active' : ''}`}
                  >
                    <button
                      className="exam-item-main"
                      onClick={() => {
                        setSelected(exam.id);
                        setResult(null);
                      }}
                    >
                      <b>{exam.title}</b>
                      <span>
                        {exam.answers.length} câu · {new Date(exam.created_at).toLocaleDateString('vi-VN')}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="btn-icon-danger"
                      title="Xóa đề thi"
                      onClick={() => deleteExam(exam.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="teacher-muted">Chưa có đề thi. Bạn có thể tạo đề hoặc nhập file Excel/JSON từ công cụ Trộn đề.</p>
            )}

            {selectedExam && (
              <div className="exam-action-box">
                <div className="selected-exam-bar">
                  <span>Đang chọn: <b>{selectedExam.title}</b> ({selectedExam.answers.length} câu)</span>
                </div>
                <div className="exam-actions">
                  <button className="teacher-button secondary" onClick={() => window.print()}>
                    <Printer size={17} /> In phiếu TN THPT 2026 (A4)
                  </button>
                  <label className="teacher-button primary-accent">
                    <Camera size={17} /> Chụp / Chọn ảnh bài làm
                    <input
                      className="file-input"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      disabled={busy}
                      onChange={(e) => scan(e.target.files?.[0])}
                    />
                  </label>
                </div>
                <p className="teacher-hint">
                  Chụp trọn 4 góc vuông đen, giữ điện thoại phẳng. Máy sẽ tự động nắn thẳng và chấm điểm.
                </p>
              </div>
            )}

            {busy && (
              <div className="scanning-indicator">
                <RefreshCw size={24} className="spin-icon" />
                <p>Đang phân tích xử lý ảnh OMR OpenCV & chấm điểm...</p>
              </div>
            )}

            {/* KẾT QUẢ CHẤM BÀI TRỰC QUAN */}
            {result && selectedExam && (
              <div className="score-result-enhanced">
                <div className="result-header-row">
                  <div className="score-badge-main">
                    <span className="score-number">{liveScore}/{result.total}</span>
                    <span className="score-label">câu đúng</span>
                  </div>
                  <div className="score-scale10-box">
                    <span className="scale10-val">{scoreOnScale10}</span>
                    <span className="scale10-lbl">Điểm thang 10</span>
                  </div>
                </div>

                {result.uncertain_questions?.length > 0 && (
                  <div className="uncertain-alert">
                    <AlertTriangle size={18} />
                    <span>
                      <b>Cần kiểm tra lại:</b> Câu {result.uncertain_questions.join(', ')} (học sinh tô mờ hoặc tẩy chưa sạch).
                    </span>
                  </div>
                )}

                {/* ẢNH BÀI LÀM ĐÃ CHẤM VỚI OVERLAY */}
                {result.annotated_image && (
                  <div className="annotated-preview-card">
                    <div className="annotated-header">
                      <span>Ảnh bài thi đã nhận diện (OpenCV Rectified)</span>
                      <button
                        type="button"
                        className="teacher-btn-sm"
                        onClick={() => setShowFullImage(true)}
                      >
                        <ZoomIn size={15} /> Phóng to ảnh
                      </button>
                    </div>
                    <div className="annotated-img-wrapper" onClick={() => setShowFullImage(true)}>
                      <img
                        src={result.annotated_image}
                        alt="Bài làm đã chấm"
                        className="annotated-img-thumb"
                      />
                    </div>
                    <div className="legend-row">
                      <span className="legend-item"><i className="legend-dot green" /> Đúng</span>
                      <span className="legend-item"><i className="legend-dot red" /> Sai (khoanh đáp án đúng)</span>
                      <span className="legend-item"><i className="legend-dot yellow" /> Cần kiểm tra</span>
                    </div>
                  </div>
                )}

                {/* BẢNG ĐỐI SOÁT & CHỈNH SỬA ĐÁP ÁN NHANH */}
                <div className="override-review-section">
                  <div className="review-header">
                    <b>Đối soát đáp án từng câu:</b>
                    <small className="teacher-muted">Nhấp vào câu để sửa nhanh</small>
                  </div>

                  <div className="detected-answers-interactive">
                    {editedAnswers.map((ans, i) => {
                      const expected = selectedExam.answers[i];
                      const isCorrect = ans === expected && ans !== '';
                      const isUncertain = result.uncertain_questions?.includes(i + 1);
                      return (
                        <div
                          key={i}
                          className={`interactive-answer-cell ${
                            isCorrect ? 'correct' : ans === '' ? 'empty' : 'wrong'
                          } ${isUncertain ? 'uncertain-border' : ''}`}
                        >
                          <span className="cell-num">C{i + 1}</span>
                          <select
                            value={ans || ''}
                            onChange={(e) => handleOverrideAnswer(i, e.target.value)}
                            className="cell-select"
                          >
                            <option value="">(Trống)</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="D">D</option>
                          </select>
                          {!isCorrect && <span className="cell-key">Đ: {expected}</span>}
                        </div>
                      );
                    })}
                  </div>

                  {hasEdits && (
                    <div className="save-edit-bar">
                      <span>Bạn đã thay đổi đáp án. Điểm mới: <b>{liveScore}/{result.total}</b></span>
                      <button
                        type="button"
                        className="teacher-button"
                        onClick={saveEditedResult}
                        disabled={savingEdit}
                      >
                        <Save size={16} /> {savingEdit ? 'Đang lưu…' : 'Lưu kết quả sau khi sửa'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* CỘT 3: LỊCH SỬ CHẤM BÀI */}
          <section className="teacher-card teacher-history">
            <h2>Lịch sử chấm gần đây</h2>
            {history.length ? (
              <div className="history-list">
                {history.map((item) => {
                  const examItem = exams.find((exam) => exam.id === item.exam_id);
                  const itemScale10 = ((item.score / (item.total || 1)) * 10).toFixed(2);
                  return (
                    <div className="history-item-row" key={item.id}>
                      <div className="history-info">
                        <b>{examItem?.title || 'Đề thi đã lưu'}</b>
                        <div className="history-meta">
                          <span className="history-score-tag">
                            {item.score}/{item.total} câu ({itemScale10} đ)
                          </span>
                          <span>· {new Date(item.created_at).toLocaleString('vi-VN')}</span>
                        </div>
                        {item.uncertain_questions?.length > 0 && (
                          <small className="history-uncertain-tag">
                            Kiểm tra lại câu: {item.uncertain_questions.join(', ')}
                          </small>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn-icon-danger"
                        title="Xóa bài chấm"
                        onClick={() => deleteResultItem(item.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="teacher-muted">Chưa có kết quả chấm nào được lưu.</p>
            )}
          </section>

          {/* MODAL NHẬP ĐÁP ÁN TỪ EXCEL / JSON */}
          {showImportModal && (
            <div className="image-modal-backdrop" onClick={() => setShowImportModal(false)}>
              <div className="image-modal-content import-modal" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setShowImportModal(false)}
                >
                  <X size={20} />
                </button>
                <h3>Nhập đáp án từ file ({importFileName})</h3>
                <p className="teacher-muted">
                  Tìm thấy <b>{importedVariants.length}</b> mã đề trong file. Bạn có thể lưu tất cả vào tài khoản hoặc chọn 1 mã đề để chỉnh sửa:
                </p>

                <div className="imported-variants-list">
                  {importedVariants.map((v, idx) => (
                    <div key={idx} className="variant-preview-card">
                      <div className="variant-card-info">
                        <b>Mã đề {v.code}</b>
                        <span>{v.answers.length} câu trắc nghiệm</span>
                        <div className="variant-answer-preview">
                          {v.answers.slice(0, 10).map((a, i) => (
                            <span key={i} className="preview-pill">{i + 1}.{a}</span>
                          ))}
                          {v.answers.length > 10 && <span className="preview-more">+{v.answers.length - 10} câu...</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="teacher-btn-sm"
                        onClick={() => handleApplySingleVariant(v)}
                      >
                        Chọn mã này
                      </button>
                    </div>
                  ))}
                </div>

                <div className="import-modal-footer">
                  <button
                    type="button"
                    className="teacher-button"
                    onClick={handleBatchCreate}
                    disabled={batchCreating}
                  >
                    <Check size={16} /> {batchCreating ? 'Đang tạo…' : `Tạo tất cả ${importedVariants.length} mã đề vào hệ thống`}
                  </button>
                  <button
                    type="button"
                    className="teacher-button secondary"
                    onClick={() => setShowImportModal(false)}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL PHÓNG TO ẢNH BÀI LÀM */}
          {showFullImage && result?.annotated_image && (
            <div className="image-modal-backdrop" onClick={() => setShowFullImage(false)}>
              <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setShowFullImage(false)}
                >
                  <X size={20} />
                </button>
                <h3>Ảnh bài thi đã chấm điểm (Chi tiết)</h3>
                <img
                  src={result.annotated_image}
                  alt="Ảnh chi tiết bài thi"
                  className="modal-full-img"
                />
              </div>
            </div>
          )}

          {/* PHIẾU IN TRẮC NGHIỆM KHỔ A4 (TN THPT 2026 / TNMAKER) */}
          {selectedExam && (
            <div className="print-only">
              <AnswerSheet exam={selectedExam} />
            </div>
          )}
        </div>
      )}
    </main>
  );
}
