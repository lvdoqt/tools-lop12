import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Camera,
  Upload,
  Download,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  Trash2,
  Eye,
  Settings,
  HelpCircle,
  FileText,
  RotateCcw,
  Zap,
  ArrowRight,
  ChevronDown
} from 'lucide-react';
import { api } from '../api';
import './GradePage.css';

const STORAGE_SUBMISSIONS_KEY = 'exam_submissions_2025';
const STORAGE_KEYS_KEY = 'exam_answer_keys_2025';
const STORAGE_CONFIG_KEY = 'exam_config_2025';

export default function GradePage() {
  const [activeTab, setActiveTab] = useState('scan');
  const [examTitle, setExamTitle] = useState('Toán 12 — Trắc nghiệm 2025');

  // Configuration: Default is MoET Math (12 MCQ, 4 TF, 6 Short Answer)
  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
      return saved ? JSON.parse(saved) : { maxP1: 12, maxP2: 4, maxP3: 6 };
    } catch {
      return { maxP1: 12, maxP2: 4, maxP3: 6 };
    }
  });

  // Answer Keys: { "101": { part1: {...}, part2: {...}, part3: {...} } }
  const [answerKeys, setAnswerKeys] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS_KEY);
      if (saved) return JSON.parse(saved);

      // Check if word-shuffle left any answer keys in localStorage
      const wsSaved = localStorage.getItem('word_shuffle_exam_answers');
      if (wsSaved) return JSON.parse(wsSaved);
      return {};
    } catch {
      return {};
    }
  });

  // Submissions list
  const [submissions, setSubmissions] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SUBMISSIONS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Camera & Scanning State
  const videoRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [currentResult, setCurrentResult] = useState(null);
  const [selectedSubForView, setSelectedSubForView] = useState(null);

  // Available exam codes
  const examCodes = useMemo(() => Object.keys(answerKeys), [answerKeys]);
  const [previewExamCode, setPreviewExamCode] = useState(examCodes[0] || '101');

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS_KEY, JSON.stringify(answerKeys));
  }, [answerKeys]);

  useEffect(() => {
    localStorage.setItem(STORAGE_SUBMISSIONS_KEY, JSON.stringify(submissions));
  }, [submissions]);

  // Handle camera lifecycle
  useEffect(() => {
    if (activeTab === 'scan' && !currentResult) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [activeTab, facingMode, currentResult]);

  const startCamera = async () => {
    try {
      setErrorMessage(null);
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setCameraActive(true);
        }
      }
    } catch (err) {
      console.warn('Cannot open live camera stream:', err);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const toggleCameraFacing = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture current frame from video and send to OMR engine
  const handleCaptureFrame = async () => {
    if (!videoRef.current || isProcessing) return;
    try {
      setIsProcessing(true);
      setErrorMessage(null);

      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const base64Data = canvas.toDataURL('image/jpeg', 0.92);
      const res = await api.scanSheet(
        base64Data,
        answerKeys,
        config.maxP1,
        config.maxP2,
        config.maxP3
      );

      setCurrentResult(res);
      stopCamera();
    } catch (err) {
      setErrorMessage(err.message || 'Lỗi xử lý phiếu chấm. Hãy đảm bảo 4 góc đen nằm trọn trong khung hình.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Upload photo file from disk / camera app
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      setErrorMessage(null);

      const res = await api.scanSheet(
        file,
        answerKeys,
        config.maxP1,
        config.maxP2,
        config.maxP3
      );

      setCurrentResult(res);
      stopCamera();
    } catch (err) {
      setErrorMessage(err.message || 'Lỗi xử lý ảnh tải lên. Vui lòng thử lại với ảnh rõ nét hơn.');
    } finally {
      setIsProcessing(false);
      event.target.value = '';
    }
  };

  // Save current result and prepare for next paper
  const handleSaveAndNext = () => {
    if (!currentResult) return;

    const newSub = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      sbd: currentResult.sbd || 'Chưa rõ',
      exam_code: currentResult.exam_code || 'Chưa rõ',
      grading: currentResult.grading,
      uncertain_questions: currentResult.uncertain_questions || [],
      annotated_image: currentResult.annotated_image,
    };

    setSubmissions(prev => [newSub, ...prev]);
    setCurrentResult(null);
  };

  const handleDiscardCurrent = () => {
    setCurrentResult(null);
  };

  // Import TNMaker Excel
  const handleImportExcel = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const res = await api.importAnswersExcel(file);
      if (res.answer_keys) {
        setAnswerKeys(res.answer_keys);
        const codes = Object.keys(res.answer_keys);
        if (codes.length > 0) setPreviewExamCode(codes[0]);
        alert(`Đã nạp thành công đáp án cho ${codes.length} mã đề: ${codes.join(', ')}`);
      }
    } catch (err) {
      alert(`Lỗi nạp Excel: ${err.message}`);
    } finally {
      setIsProcessing(false);
      event.target.value = '';
    }
  };

  // Export Gradebook to Excel
  const handleExportGradebook = async () => {
    if (submissions.length === 0) {
      alert('Chưa có bài chấm nào trong danh sách.');
      return;
    }
    try {
      setIsProcessing(true);
      const url = await api.exportGradeExcel(examTitle, submissions);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Bang_diem_${examTitle.replace(/\s+/g, '_')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert(`Lỗi xuất Excel: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete a submission
  const handleDeleteSubmission = (id) => {
    if (confirm('Bạn có chắc muốn xóa bài chấm này khỏi danh sách?')) {
      setSubmissions(prev => prev.filter(s => s.id !== id));
    }
  };

  // Clear all submissions
  const handleClearAllSubmissions = () => {
    if (confirm('Bạn có chắc muốn xóa toàn bộ bảng điểm của lớp này để bắt đầu lại?')) {
      setSubmissions([]);
    }
  };

  // Statistics
  const stats = useMemo(() => {
    if (submissions.length === 0) return { total: 0, avg: 0, max: 0, min: 0 };
    const scores = submissions.map(s => s.grading?.total_score || 0);
    const sum = scores.reduce((a, b) => a + b, 0);
    return {
      total: submissions.length,
      avg: (sum / submissions.length).toFixed(2),
      max: Math.max(...scores).toFixed(2),
      min: Math.min(...scores).toFixed(2),
    };
  }, [submissions]);

  return (
    <main className="main-content">
      <div className="grade-page">
        {/* Header */}
        <header className="grade-header">
          <div className="grade-title-group">
            <h1>
              Chấm trắc nghiệm <span className="grade-badge-2025">2025</span>
            </h1>
            <p className="grade-subtitle">
              Chấm phiếu trả lời trắc nghiệm chuẩn Bộ GD&ĐT từ năm 2025 qua camera điện thoại
            </p>
          </div>

          <div className="grade-top-actions">
            <a
              href={api.getTemplatePdfUrl()}
              download="phieu-cham-2025.pdf"
              className="btn-secondary"
              title="Tải phiếu in mẫu chuẩn PDF"
            >
              <Download size={16} />
              In phiếu chuẩn PDF
            </a>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="grade-tabs">
          <button
            className={`grade-tab-btn ${activeTab === 'scan' ? 'active' : ''}`}
            onClick={() => setActiveTab('scan')}
          >
            <Camera size={18} />
            Quét chấm bài
          </button>
          <button
            className={`grade-tab-btn ${activeTab === 'gradebook' ? 'active' : ''}`}
            onClick={() => setActiveTab('gradebook')}
          >
            <FileSpreadsheet size={18} />
            Bảng điểm ({submissions.length})
          </button>
          <button
            className={`grade-tab-btn ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            <Settings size={18} />
            Đáp án & Cài đặt
          </button>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: SCANNER VIEW */}
        {/* ======================================================== */}
        {activeTab === 'scan' && (
          <div className="scanner-container">
            {/* Viewport or Current Result */}
            {!currentResult ? (
              <div className="viewport-card">
                <div className="viewport-screen">
                  {cameraActive ? (
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="viewport-video"
                    />
                  ) : (
                    <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>
                      <Camera size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                      <p>Camera chưa kích hoạt hoặc không có quyền truy cập.</p>
                      <button className="btn-primary" onClick={startCamera}>
                        Bật camera
                      </button>
                    </div>
                  )}

                  {/* 4 Corner Reticle Alignment Guide */}
                  {cameraActive && (
                    <div className="viewport-reticle">
                      <div className="reticle-corner reticle-tl" />
                      <div className="reticle-corner reticle-tr" />
                      <div className="reticle-corner reticle-bl" />
                      <div className="reticle-corner reticle-br" />
                      <div className="reticle-guide-text">
                        Căn 4 góc đen của phiếu vào khung và bấm Chụp
                      </div>
                    </div>
                  )}
                </div>

                {/* Camera Controls */}
                <div className="viewport-controls">
                  <button
                    className="btn-icon-secondary"
                    onClick={toggleCameraFacing}
                    title="Đổi camera trước / sau"
                  >
                    <RotateCcw size={20} />
                  </button>

                  <button
                    className="btn-capture-big"
                    onClick={handleCaptureFrame}
                    disabled={isProcessing || !cameraActive}
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw size={20} className="spin" />
                        Đang chấm bài…
                      </>
                    ) : (
                      <>
                        <Camera size={20} />
                        Chụp & Chấm
                      </>
                    )}
                  </button>

                  <label className="btn-icon-secondary" title="Tải ảnh từ máy / Chụp bằng camera gốc">
                    <Upload size={20} />
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                      disabled={isProcessing}
                    />
                  </label>
                </div>
              </div>
            ) : (
              /* Scanned Result Card */
              <div className="result-card">
                <div className="result-score-banner">
                  <div className="score-main">
                    <span className="score-label">Điểm số bài thi</span>
                    <span className="score-value">
                      {currentResult.grading?.total_score} <small style={{ fontSize: '1rem', color: '#64748b' }}>/ 10.0</small>
                    </span>
                  </div>
                  <CheckCircle size={36} color="#16a34a" />
                </div>

                {/* SBD & Mã Đề */}
                <div className="id-chips">
                  <div className="id-chip">
                    <div className="id-chip-label">Số báo danh (SBD)</div>
                    <div className="id-chip-value">{currentResult.sbd || 'Chưa rõ'}</div>
                  </div>
                  <div className="id-chip">
                    <div className="id-chip-label">Mã đề thi</div>
                    <div className="id-chip-value">{currentResult.exam_code || 'Chưa rõ'}</div>
                  </div>
                </div>

                {/* Score Breakdown */}
                <div className="score-breakdown">
                  <div className="breakdown-item">
                    <span>Phần I (MCQ)</span>
                    <strong>{currentResult.grading?.part1_score} đ</strong>
                  </div>
                  <div className="breakdown-item">
                    <span>Phần II (Đ/S)</span>
                    <strong>{currentResult.grading?.part2_score} đ</strong>
                  </div>
                  <div className="breakdown-item">
                    <span>Phần III (Điền số)</span>
                    <strong>{currentResult.grading?.part3_score} đ</strong>
                  </div>
                </div>

                {/* Uncertain Questions Notice */}
                {currentResult.uncertain_questions && currentResult.uncertain_questions.length > 0 && (
                  <div className="uncertain-alert">
                    <AlertTriangle size={18} />
                    <div>
                      <strong>Cần xem lại: </strong>
                      {currentResult.uncertain_questions.join(', ')} (học sinh tô mờ hoặc tô 2 ô).
                    </div>
                  </div>
                )}

                {/* Annotated Sheet Image */}
                {currentResult.annotated_image && (
                  <div className="overlay-preview-container">
                    <img
                      src={currentResult.annotated_image}
                      alt="Phiếu đã chấm"
                      className="overlay-preview-img"
                    />
                  </div>
                )}

                {/* Action Buttons */}
                <div className="result-actions">
                  <button className="btn-save-next" onClick={handleSaveAndNext}>
                    <CheckCircle size={18} />
                    Lưu & Chấm tiếp bài sau
                  </button>
                  <button className="btn-secondary" onClick={handleDiscardCurrent}>
                    Hủy bài này / Chụp lại
                  </button>
                </div>
              </div>
            )}

            {/* Side Info Box */}
            <div className="info-sidebar">
              <div className="config-box">
                <h3><Zap size={18} color="#0284c7" /> Hướng dẫn quét bài nhanh</h3>
                <ol style={{ fontSize: '0.875rem', paddingLeft: '1.25rem', lineHeight: '1.6', color: '#475569' }}>
                  <li>Đặt phiếu trên mặt bàn phẳng, đủ ánh sáng, tránh sấp bóng.</li>
                  <li>Hướng camera thẳng đứng, nhìn thấy trọn vẹn <strong>4 ô vuông đen ở 4 góc</strong>.</li>
                  <li>Bấm <strong>"Chụp & Chấm"</strong> $\rightarrow$ Kết quả và ảnh khoanh đỏ/xanh hiển thị sau 0.8 giây.</li>
                  <li>Bấm <strong>"Lưu & Chấm tiếp bài sau"</strong> để chấm liên tục cho cả lớp mà không phải bấm nút quay lại.</li>
                </ol>
              </div>

              {errorMessage && (
                <div className="uncertain-alert" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' }}>
                  <AlertTriangle size={18} />
                  <div>{errorMessage}</div>
                </div>
              )}

              {/* Status info */}
              <div className="config-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Mã đề đang có đáp án:</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>
                    {examCodes.length > 0 ? examCodes.join(', ') : 'Chưa nạp (mặc định)'}
                  </span>
                </div>
                {examCodes.length === 0 && (
                  <p style={{ fontSize: '0.8rem', color: '#f59e0b', margin: '0.5rem 0 0' }}>
                    Chưa có file đáp án! Vui lòng sang tab <strong>Đáp án & Cài đặt</strong> để nạp file Excel từ Trộn đề.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: GRADEBOOK */}
        {/* ======================================================== */}
        {activeTab === 'gradebook' && (
          <div className="gradebook-card">
            {/* Stats Bar */}
            <div className="gradebook-stats">
              <div className="stat-box">
                <div className="stat-val">{stats.total}</div>
                <div className="stat-lbl">Tổng bài đã chấm</div>
              </div>
              <div className="stat-box">
                <div className="stat-val">{stats.avg}</div>
                <div className="stat-lbl">Điểm trung bình</div>
              </div>
              <div className="stat-box">
                <div className="stat-val">{stats.max}</div>
                <div className="stat-lbl">Điểm cao nhất</div>
              </div>
              <div className="stat-box">
                <div className="stat-val">{stats.min}</div>
                <div className="stat-lbl">Điểm thấp nhất</div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="gradebook-actions-bar">
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  value={examTitle}
                  onChange={e => setExamTitle(e.target.value)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.5rem',
                    fontWeight: 600,
                  }}
                  placeholder="Tên bài kiểm tra"
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn-primary"
                  onClick={handleExportGradebook}
                  disabled={submissions.length === 0 || isProcessing}
                >
                  <Download size={16} />
                  Xuất Excel bảng điểm
                </button>
                {submissions.length > 0 && (
                  <button className="btn-danger" onClick={handleClearAllSubmissions}>
                    <Trash2 size={16} />
                    Xóa tất cả
                  </button>
                )}
              </div>
            </div>

            {/* Submissions Table */}
            {submissions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                <FileSpreadsheet size={48} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
                <p>Chưa có bài chấm nào. Hãy chuyển sang tab <strong>Quét chấm bài</strong> để bắt đầu chấm.</p>
              </div>
            ) : (
              <div className="grade-table-wrap">
                <table className="grade-table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Giờ chấm</th>
                      <th>Số báo danh</th>
                      <th>Mã đề</th>
                      <th>Phần I</th>
                      <th>Phần II</th>
                      <th>Phần III</th>
                      <th>Tổng điểm</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((sub, idx) => (
                      <tr key={sub.id} className={sub.uncertain_questions?.length > 0 ? 'has-warning' : ''}>
                        <td>{idx + 1}</td>
                        <td>{sub.timestamp}</td>
                        <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{sub.sbd}</td>
                        <td style={{ fontFamily: 'monospace' }}>{sub.exam_code}</td>
                        <td>{sub.grading?.part1_score?.toFixed(2)}</td>
                        <td>{sub.grading?.part2_score?.toFixed(2)}</td>
                        <td>{sub.grading?.part3_score?.toFixed(2)}</td>
                        <td style={{ fontWeight: 800, color: '#166534', fontSize: '1.05rem' }}>
                          {sub.grading?.total_score?.toFixed(2)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                            {sub.annotated_image && (
                              <button
                                className="btn-icon-secondary"
                                style={{ background: '#e2e8f0', color: '#0f172a', width: '32px', height: '32px' }}
                                onClick={() => setSelectedSubForView(sub)}
                                title="Xem lại ảnh bài thi đã chấm"
                              >
                                <Eye size={16} />
                              </button>
                            )}
                            <button
                              className="btn-icon-secondary"
                              style={{ background: '#fee2e2', color: '#dc2626', width: '32px', height: '32px' }}
                              onClick={() => handleDeleteSubmission(sub.id)}
                              title="Xóa bài này"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Modal View Scanned Image */}
            {selectedSubForView && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  backgroundColor: 'rgba(0,0,0,0.75)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 9999,
                  padding: '1rem',
                }}
                onClick={() => setSelectedSubForView(null)}
              >
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '1rem',
                    maxWidth: '800px',
                    width: '100%',
                    maxHeight: '90vh',
                    overflow: 'auto',
                    padding: '1rem',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0 }}>
                      SBD: {selectedSubForView.sbd} | Điểm: {selectedSubForView.grading?.total_score}
                    </h3>
                    <button className="btn-secondary" onClick={() => setSelectedSubForView(null)}>
                      Đóng
                    </button>
                  </div>
                  <img
                    src={selectedSubForView.annotated_image}
                    alt="Phiếu chấm"
                    style={{ width: '100%', height: 'auto', borderRadius: '0.5rem' }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: CONFIG & ANSWER KEYS */}
        {/* ======================================================== */}
        {activeTab === 'config' && (
          <div className="config-card">
            {/* Import TNMaker Excel */}
            <div className="config-box">
              <h3><FileSpreadsheet size={18} color="#16a34a" /> Nạp đáp án từ Excel TNMaker 2025</h3>
              <p className="config-desc">
                Chọn file <code>Dap_an_TNMaker_2025.xlsx</code> được tạo tự động từ công cụ <strong>Trộn đề Word</strong>.
              </p>
              <label className="btn-primary" style={{ cursor: 'pointer' }}>
                <Upload size={16} />
                Chọn file Excel TNMaker
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleImportExcel}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {/* Structure Setting */}
            <div className="config-box">
              <h3><Settings size={18} color="#0284c7" /> Cấu trúc đề thi</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                    Phần I (Trắc nghiệm 4 lựa chọn)
                  </label>
                  <select
                    value={config.maxP1}
                    onChange={e => setConfig({ ...config, maxP1: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                  >
                    <option value={12}>12 câu (Toán chuẩn 2025 - 3.0đ)</option>
                    <option value={40}>40 câu (Tối đa toàn phiếu - 10.0đ)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                    Phần II (Trắc nghiệm Đúng/Sai)
                  </label>
                  <select
                    value={config.maxP2}
                    onChange={e => setConfig({ ...config, maxP2: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                  >
                    <option value={4}>4 câu (Toán chuẩn 2025 - 4.0đ)</option>
                    <option value={8}>8 câu (Tối đa toàn phiếu - 8.0đ)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                    Phần III (Trả lời ngắn)
                  </label>
                  <select
                    value={config.maxP3}
                    onChange={e => setConfig({ ...config, maxP3: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                  >
                    <option value={6}>6 câu (Toán chuẩn 2025 - 3.0đ)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Answer Key Viewer */}
            <div className="config-box">
              <h3><FileText size={18} color="#7c3aed" /> Đáp án đã nạp theo mã đề</h3>
              {examCodes.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                  Chưa có mã đề nào được nạp. Hãy nạp file Excel ở trên hoặc từ công cụ Trộn đề.
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Xem mã đề:</span>
                    <select
                      value={previewExamCode}
                      onChange={e => setPreviewExamCode(e.target.value)}
                      style={{ padding: '0.4rem 0.75rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontWeight: 700 }}
                    >
                      {examCodes.map(code => (
                        <option key={code} value={code}>
                          Mã đề {code}
                        </option>
                      ))}
                    </select>
                  </div>

                  {answerKeys[previewExamCode] && (
                    <div style={{ fontSize: '0.875rem' }}>
                      <p><strong>Phần I ({Object.keys(answerKeys[previewExamCode].part1 || {}).length} câu):</strong></p>
                      <div className="key-pill-grid">
                        {Object.entries(answerKeys[previewExamCode].part1 || {}).map(([q, ans]) => (
                          <span key={q} className="key-pill">
                            {q}:{ans}
                          </span>
                        ))}
                      </div>

                      <p style={{ marginTop: '0.75rem' }}><strong>Phần II ({Object.keys(answerKeys[previewExamCode].part2 || {}).length} câu):</strong></p>
                      <div className="key-pill-grid">
                        {Object.entries(answerKeys[previewExamCode].part2 || {}).map(([q, ans]) => (
                          <span key={q} className="key-pill">
                            C{q}:{typeof ans === 'object' ? Object.values(ans).join('') : ans}
                          </span>
                        ))}
                      </div>

                      <p style={{ marginTop: '0.75rem' }}><strong>Phần III ({Object.keys(answerKeys[previewExamCode].part3 || {}).length} câu):</strong></p>
                      <div className="key-pill-grid">
                        {Object.entries(answerKeys[previewExamCode].part3 || {}).map(([q, ans]) => (
                          <span key={q} className="key-pill">
                            C{q}:{ans}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

