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
  FileText,
  RotateCcw,
  Zap,
  Plus,
  Cloud,
  CloudUpload,
  CloudDownload,
  Edit2,
  Check,
  ChevronDown
} from 'lucide-react';
import { api } from '../api';
import './GradePage.css';

const STORAGE_EXAMS_KEY = 'grade_exams_list_v2';
const STORAGE_CURRENT_EXAM_ID_KEY = 'grade_current_exam_id_v2';

const DEFAULT_EXAM = {
  id: 'default-exam',
  title: 'Toán 12 — Kiểm tra trắc nghiệm 2025',
  sheet_type: '2025_math',
  config: { maxP1: 12, maxP2: 4, maxP3: 6 },
  answer_keys: {},
  submissions: [],
  updated_at: new Date().toISOString(),
};

export default function GradePage() {
  const [activeTab, setActiveTab] = useState('scan');

  // Exams List Management
  const [exams, setExams] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_EXAMS_KEY);
      if (saved) {
        const list = JSON.parse(saved);
        if (Array.isArray(list) && list.length > 0) return list;
      }
    } catch {
      // fallback
    }
    return [DEFAULT_EXAM];
  });

  const [currentExamId, setCurrentExamId] = useState(() => {
    try {
      const savedId = localStorage.getItem(STORAGE_CURRENT_EXAM_ID_KEY);
      if (savedId && exams.some(e => e.id === savedId)) return savedId;
    } catch {
      // fallback
    }
    return exams[0]?.id || DEFAULT_EXAM.id;
  });

  // Current active exam object
  const currentExam = useMemo(() => {
    return exams.find(e => e.id === currentExamId) || exams[0] || DEFAULT_EXAM;
  }, [exams, currentExamId]);

  // Quick edit title state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleVal, setEditTitleVal] = useState(currentExam.title);

  // Cloud sync status message
  const [cloudStatus, setCloudStatus] = useState(null);

  // Save exams list to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_EXAMS_KEY, JSON.stringify(exams));
      localStorage.setItem(STORAGE_CURRENT_EXAM_ID_KEY, currentExamId);
    } catch (e) {
      console.warn('Could not save exams to localStorage:', e);
    }
  }, [exams, currentExamId]);

  // Update current exam helper
  const updateCurrentExam = (updater) => {
    setExams(prev => prev.map(e => {
      if (e.id === currentExam.id) {
        const updated = typeof updater === 'function' ? updater(e) : { ...e, ...updater };
        return { ...updated, updated_at: new Date().toISOString() };
      }
      return e;
    }));
  };

  // Create New Exam
  const handleCreateNewExam = () => {
    const title = prompt('Nhập tên kỳ thi / bài kiểm tra mới:', `Bài kiểm tra ${exams.length + 1}`);
    if (!title || !title.trim()) return;

    const newExam = {
      id: 'exam_' + Date.now(),
      title: title.trim(),
      sheet_type: '2025_math',
      config: { maxP1: 12, maxP2: 4, maxP3: 6 },
      answer_keys: {},
      submissions: [],
      updated_at: new Date().toISOString(),
    };

    setExams(prev => [newExam, ...prev]);
    setCurrentExamId(newExam.id);
    setActiveTab('config');
  };

  // Delete Current Exam
  const handleDeleteCurrentExam = () => {
    if (exams.length <= 1) {
      alert('Phải giữ lại ít nhất 1 kỳ thi trong hệ thống.');
      return;
    }
    if (confirm(`Bạn có chắc muốn xóa kỳ thi "${currentExam.title}" và toàn bộ dữ liệu bài chấm của nó?`)) {
      const remaining = exams.filter(e => e.id !== currentExam.id);
      setExams(remaining);
      setCurrentExamId(remaining[0].id);
    }
  };

  // Save / Sync to Supabase Cloud
  const handleSaveToCloud = async () => {
    try {
      setCloudStatus('Đang lưu lên Supabase Cloud…');
      const res = await api.saveExamCloud({
        id: currentExam.id.startsWith('exam_') ? undefined : currentExam.id,
        title: currentExam.title,
        sheet_type: currentExam.sheet_type,
        config: currentExam.config,
        answer_keys: currentExam.answer_keys,
        submissions: currentExam.submissions,
      });
      if (res.exam && res.exam.id) {
        updateCurrentExam({ id: res.exam.id });
      }
      setCloudStatus('✓ Đã đồng bộ lên Supabase Cloud thành công!');
      setTimeout(() => setCloudStatus(null), 4000);
    } catch (err) {
      setCloudStatus(`⚠️ ${err.message}`);
    }
  };

  // Load / Sync from Supabase Cloud
  const handleLoadFromCloud = async () => {
    try {
      setCloudStatus('Đang tải danh sách từ Supabase…');
      const cloudExams = await api.listExamsCloud();
      if (!cloudExams || cloudExams.length === 0) {
        alert('Chưa có kỳ thi nào được lưu trên Supabase Cloud.');
        setCloudStatus(null);
        return;
      }

      // Merge cloud exams with local exams by ID
      setExams(prev => {
        const merged = [...prev];
        cloudExams.forEach(ce => {
          const idx = merged.findIndex(m => m.id === ce.id || m.title === ce.title);
          const normalized = {
            id: ce.id,
            title: ce.title,
            sheet_type: ce.sheet_type || '2025_math',
            config: ce.config || { maxP1: 12, maxP2: 4, maxP3: 6 },
            answer_keys: ce.answer_keys || {},
            submissions: ce.submissions || [],
            updated_at: ce.updated_at || new Date().toISOString(),
          };
          if (idx !== -1) merged[idx] = normalized;
          else merged.push(normalized);
        });
        return merged;
      });

      setCloudStatus(`✓ Đã đồng bộ ${cloudExams.length} kỳ thi từ Supabase Cloud!`);
      setTimeout(() => setCloudStatus(null), 4000);
    } catch (err) {
      setCloudStatus(`⚠️ ${err.message}`);
    }
  };

  // Check if Word Shuffle created answers
  const handleImportFromWordShuffle = () => {
    try {
      const saved = localStorage.getItem('exam_answer_keys_2025');
      if (saved) {
        const keys = JSON.parse(saved);
        const codes = Object.keys(keys);
        if (codes.length > 0) {
          updateCurrentExam({ answer_keys: keys });
          alert(`Đã nạp thành công đáp án của ${codes.length} mã đề từ Trộn đề Word: ${codes.join(', ')}`);
          return;
        }
      }
      alert('Chưa tìm thấy đáp án nào từ phiên Trộn đề Word gần đây.');
    } catch (e) {
      alert(`Lỗi nạp: ${e.message}`);
    }
  };

  // Camera & Scanning State
  const videoRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [currentResult, setCurrentResult] = useState(null);
  const [selectedSubForView, setSelectedSubForView] = useState(null);

  const answerKeys = currentExam.answer_keys || {};
  const examCodes = useMemo(() => Object.keys(answerKeys), [answerKeys]);
  const [previewExamCode, setPreviewExamCode] = useState(examCodes[0] || '101');

  // Sync title edit state when exam changes
  useEffect(() => {
    setEditTitleVal(currentExam.title);
    setIsEditingTitle(false);
    if (examCodes.length > 0 && !examCodes.includes(previewExamCode)) {
      setPreviewExamCode(examCodes[0]);
    }
  }, [currentExam.id, currentExam.title, examCodes]);

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
        currentExam.config.maxP1,
        currentExam.config.maxP2,
        currentExam.config.maxP3
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
        currentExam.config.maxP1,
        currentExam.config.maxP2,
        currentExam.config.maxP3
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

  // Save current result to current exam
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

    updateCurrentExam(e => ({
      ...e,
      submissions: [newSub, ...(e.submissions || [])],
    }));
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
        updateCurrentExam({ answer_keys: res.answer_keys });
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
    const subs = currentExam.submissions || [];
    if (subs.length === 0) {
      alert('Chưa có bài chấm nào trong danh sách.');
      return;
    }
    try {
      setIsProcessing(true);
      const url = await api.exportGradeExcel(currentExam.title, subs);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Bang_diem_${currentExam.title.replace(/\s+/g, '_')}.xlsx`;
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
      updateCurrentExam(e => ({
        ...e,
        submissions: (e.submissions || []).filter(s => s.id !== id),
      }));
    }
  };

  // Clear all submissions for current exam
  const handleClearAllSubmissions = () => {
    if (confirm(`Bạn có chắc muốn xóa toàn bộ bài chấm của kỳ thi "${currentExam.title}"?`)) {
      updateCurrentExam({ submissions: [] });
    }
  };

  // Handle Sheet Type Preset selection
  const handleSheetTypeChange = (type) => {
    if (type === '2025_math') {
      updateCurrentExam({
        sheet_type: type,
        config: { maxP1: 12, maxP2: 4, maxP3: 6 },
      });
    } else if (type === '2025_full') {
      updateCurrentExam({
        sheet_type: type,
        config: { maxP1: 40, maxP2: 8, maxP3: 6 },
      });
    } else {
      updateCurrentExam({ sheet_type: type });
    }
  };

  // URL for Sample Excel template based on current config
  const sampleExcelUrl = useMemo(() => {
    const codes = examCodes.length > 0 ? examCodes.join(',') : '101,102,103,104';
    return api.getSampleExcelUrl(
      currentExam.config.maxP1,
      currentExam.config.maxP2,
      currentExam.config.maxP3,
      codes
    );
  }, [currentExam.config, examCodes]);

  // Statistics
  const submissions = currentExam.submissions || [];
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

        {/* ======================================================== */}
        {/* EXAM / KT SELECTOR BAR (QUẢN LÝ NHIỀU KỲ THI) */}
        {/* ======================================================== */}
        <div className="exam-selector-bar">
          <div className="exam-select-group">
            <span className="exam-select-label">Kỳ thi / KT:</span>
            {isEditingTitle ? (
              <div style={{ display: 'flex', gap: '0.35rem', flex: 1 }}>
                <input
                  type="text"
                  value={editTitleVal}
                  onChange={e => setEditTitleVal(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.4rem 0.6rem',
                    border: '1px solid #0284c7',
                    borderRadius: '0.4rem',
                    fontWeight: 700,
                  }}
                  autoFocus
                />
                <button
                  className="btn-primary"
                  style={{ padding: '0.4rem 0.7rem' }}
                  onClick={() => {
                    if (editTitleVal.trim()) {
                      updateCurrentExam({ title: editTitleVal.trim() });
                    }
                    setIsEditingTitle(false);
                  }}
                  title="Lưu tên"
                >
                  <Check size={16} />
                </button>
              </div>
            ) : (
              <select
                className="exam-dropdown"
                value={currentExamId}
                onChange={e => setCurrentExamId(e.target.value)}
              >
                {exams.map(ex => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title} ({ex.submissions?.length || 0} bài)
                  </option>
                ))}
              </select>
            )}

            {!isEditingTitle && (
              <button
                className="btn-secondary"
                style={{ padding: '0.45rem', minWidth: '32px' }}
                onClick={() => {
                  setEditTitleVal(currentExam.title);
                  setIsEditingTitle(true);
                }}
                title="Đổi tên kỳ thi"
              >
                <Edit2 size={15} />
              </button>
            )}
          </div>

          {/* Exam Actions */}
          <div className="exam-selector-actions">
            <button
              className="btn-primary"
              onClick={handleCreateNewExam}
              title="Tạo kỳ thi mới"
            >
              <Plus size={16} />
              Kỳ thi mới
            </button>

            <button
              className="btn-secondary"
              onClick={handleSaveToCloud}
              title="Lưu kỳ thi hiện tại lên Supabase Cloud"
            >
              <CloudUpload size={16} />
              Lưu Cloud
            </button>

            <button
              className="btn-secondary"
              onClick={handleLoadFromCloud}
              title="Đồng bộ danh sách kỳ thi từ Supabase Cloud"
            >
              <CloudDownload size={16} />
              Đồng bộ Cloud
            </button>

            {exams.length > 1 && (
              <button
                className="btn-danger"
                onClick={handleDeleteCurrentExam}
                title="Xóa kỳ thi này"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Cloud Status Toast / Banner */}
        {cloudStatus && (
          <div
            className="uncertain-alert"
            style={{
              marginBottom: '1rem',
              backgroundColor: cloudStatus.startsWith('✓') ? '#f0fdf4' : '#fffbeb',
              borderColor: cloudStatus.startsWith('✓') ? '#bbf7d0' : '#fef3c7',
              color: cloudStatus.startsWith('✓') ? '#166534' : '#92400e',
            }}
          >
            <Cloud size={16} />
            <div>{cloudStatus}</div>
          </div>
        )}

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
                    {examCodes.length > 0 ? examCodes.join(', ') : 'Chưa nạp'}
                  </span>
                </div>
                {examCodes.length === 0 && (
                  <p style={{ fontSize: '0.8rem', color: '#f59e0b', margin: '0.5rem 0 0' }}>
                    Chưa có file đáp án! Vui lòng sang tab <strong>Đáp án & Cài đặt</strong> để tải file mẫu Excel hoặc nạp đáp án.
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
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1.05rem' }}>
                Kỳ thi: {currentExam.title}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
                    Xóa tất cả bài chấm
                  </button>
                )}
              </div>
            </div>

            {/* Submissions Table */}
            {submissions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                <FileSpreadsheet size={48} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
                <p>Chưa có bài chấm nào cho kỳ thi này. Hãy chuyển sang tab <strong>Quét chấm bài</strong> để bắt đầu chấm.</p>
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
        {/* TAB 3: CONFIG & ANSWER KEYS (ĐÁP ÁN - CÀI ĐẶT) */}
        {/* ======================================================== */}
        {activeTab === 'config' && (
          <div className="config-card">
            {/* 1. Tên kỳ thi & Loại phiếu */}
            <div className="config-box">
              <h3><Settings size={18} color="#0284c7" /> 1. Cài đặt loại phiếu & số câu từng phần</h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>
                    Tên kỳ thi / Bài kiểm tra:
                  </label>
                  <input
                    type="text"
                    value={currentExam.title}
                    onChange={e => updateCurrentExam({ title: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontWeight: 600 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>
                    Mẫu phiếu trả lời:
                  </label>
                  <select
                    value={currentExam.sheet_type || '2025_math'}
                    onChange={e => handleSheetTypeChange(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontWeight: 600 }}
                  >
                    <option value="2025_math">Phiếu chuẩn Bộ GD&ĐT 2025 — Toán (12 - 4 - 6 câu)</option>
                    <option value="2025_full">Phiếu chuẩn Bộ GD&ĐT 2025 — Đầy đủ (40 - 8 - 6 câu)</option>
                    <option value="2025_custom">Phiếu 2025 — Tùy chỉnh số câu theo ý muốn</option>
                  </select>
                </div>
              </div>

              {/* Number of questions per part (Selectable) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                    Phần I: Số câu trắc nghiệm (A,B,C,D)
                  </label>
                  <select
                    value={currentExam.config.maxP1}
                    onChange={e => updateCurrentExam(ex => ({
                      ...ex,
                      config: { ...ex.config, maxP1: Number(e.target.value) },
                    }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                  >
                    {[10, 12, 15, 20, 25, 30, 35, 40].map(n => (
                      <option key={n} value={n}>{n} câu {n === 12 ? '(Chuẩn môn Toán)' : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                    Phần II: Số câu Đúng/Sai (a,b,c,d)
                  </label>
                  <select
                    value={currentExam.config.maxP2}
                    onChange={e => updateCurrentExam(ex => ({
                      ...ex,
                      config: { ...ex.config, maxP2: Number(e.target.value) },
                    }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                  >
                    <option value={0}>0 câu (Không có Phần II)</option>
                    <option value={2}>2 câu</option>
                    <option value={4}>4 câu (Chuẩn môn Toán)</option>
                    <option value={6}>6 câu</option>
                    <option value={8}>8 câu (Tối đa cả phiếu)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                    Phần III: Số câu trả lời ngắn (điền số)
                  </label>
                  <select
                    value={currentExam.config.maxP3}
                    onChange={e => updateCurrentExam(ex => ({
                      ...ex,
                      config: { ...ex.config, maxP3: Number(e.target.value) },
                    }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                  >
                    <option value={0}>0 câu (Không có Phần III)</option>
                    <option value={2}>2 câu</option>
                    <option value={4}>4 câu</option>
                    <option value={6}>6 câu (Chuẩn môn Toán / Tối đa)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>
                ✓ Tổng bài thi hiện tại: {currentExam.config.maxP1} câu Phần I + {currentExam.config.maxP2} câu Phần II + {currentExam.config.maxP3} câu Phần III.
              </div>
            </div>

            {/* 2. File mẫu Excel & Upload đáp án */}
            <div className="config-box">
              <h3><FileSpreadsheet size={18} color="#16a34a" /> 2. Quản lý File đáp án Excel TNMaker</h3>
              <p className="config-desc">
                Tải file mẫu Excel đã được định dạng sẵn đúng số câu ở trên, điền hoặc sửa đáp án theo các mã đề, sau đó nạp file lên hệ thống.
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <a
                  href={sampleExcelUrl}
                  download="Mau_dap_an_TNMaker_2025.xlsx"
                  className="btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Download size={16} />
                  Tải file mẫu Excel đáp án (.xlsx)
                </a>

                <label className="btn-primary" style={{ cursor: 'pointer' }}>
                  <Upload size={16} />
                  Nạp file Excel đáp án
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleImportExcel}
                    style={{ display: 'none' }}
                  />
                </label>

                <button className="btn-secondary" onClick={handleImportFromWordShuffle}>
                  <Zap size={16} color="#eab308" />
                  Lấy từ Trộn đề Word
                </button>
              </div>
            </div>

            {/* 3. Xem đáp án các mã đề */}
            <div className="config-box">
              <h3><FileText size={18} color="#7c3aed" /> 3. Đáp án các mã đề của kỳ thi này</h3>
              {examCodes.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                  Chưa có mã đề nào được nạp cho kỳ thi này. Hãy tải file mẫu Excel ở trên, sửa đáp án rồi nạp lên.
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Chọn mã đề:</span>
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
