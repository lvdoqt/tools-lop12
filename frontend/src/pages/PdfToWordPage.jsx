import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { api } from '../api';
import { useToast, ToastContainer } from '../components/Toast';

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function PdfToWordPage() {
  const { toasts, addToast } = useToast();
  const textareaRef = useRef(null);

  // State
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [fileId, setFileId] = useState(null);
  const [pdfInfo, setPdfInfo] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // Conversion Settings (Default: hybrid with Smart Diagram Cropper)
  const [mode, setMode] = useState('hybrid'); // 'hybrid', 'math_hd', 'editable_text'
  const [dpi, setDpi] = useState(250);
  const [pageRangeType, setPageRangeType] = useState('all'); // 'all' or 'custom'
  const [customRange, setCustomRange] = useState('');
  const [previewPage, setPreviewPage] = useState(0);

  // Conversion State
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, status: '' });
  const [result, setResult] = useState(null);

  // Live Editor State
  const [editedText, setEditedText] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activeResultTab, setActiveResultTab] = useState('editor'); // 'editor' | 'visual'
  const [resultVisualPage, setResultVisualPage] = useState(0);

  // Dropzone Handler
  const onDrop = useCallback(async (acceptedFiles) => {
    const f = acceptedFiles[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      addToast('⚠️ Chỉ hỗ trợ file PDF (.pdf)!', 'warning');
      return;
    }
    if (f.size > 100 * 1024 * 1024) {
      addToast('⚠️ Dung lượng file tối đa 100MB.', 'warning');
      return;
    }

    setFile(f);
    setUploading(true);
    setProgress({ percent: 25, status: 'Đang tải lên và phân tích tài liệu...' });

    try {
      const data = await api.uploadPdf(f);
      setFileId(data.file_id);
      setPdfInfo(data.info);
      
      // Auto-select best mode
      if (data.info?.recommended_mode) {
        setMode(data.info.recommended_mode);
      }
      
      setStep(2);
      setPreviewPage(0);
      setProgress({ percent: 0, status: '' });
      addToast(`✅ Đã tải file: ${data.info.num_pages} trang`, 'success');
    } catch (err) {
      addToast(`❌ Lỗi: ${err.message}`, 'error');
      resetAll();
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: step !== 1 || uploading,
  });

  // Convert Handler
  const handleConvert = async () => {
    if (!fileId) return;
    setConverting(true);
    setProgress({ percent: 20, status: 'Đang khởi động công cụ chuyển đổi...' });

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev.percent >= 90) return prev;
        return {
          percent: prev.percent + 15,
          status: prev.percent < 40 ? 'Đang nhận diện & cắt đồ thị, bảng biến thiên...' :
                  prev.percent < 70 ? 'Đang trích xuất câu hỏi & căn chỉnh Word...' :
                  'Đang chèn hình ảnh minh họa và đóng gói file .docx...',
        };
      });
    }, 300);

    try {
      const rangeVal = pageRangeType === 'all' ? 'all' : customRange;
      const data = await api.convertPdf(fileId, mode, dpi, rangeVal);
      
      clearInterval(timer);
      setProgress({ percent: 100, status: 'Hoàn tất!' });
      setResult(data);

      const text = data.extracted_text || '';
      setEditedText(text);
      setOriginalText(text);
      setIsDirty(false);
      setResultVisualPage(0);
      setStep(3);
      addToast(`🎉 Chuyển đổi thành công trong ${data.elapsed_seconds}s!`, 'success');
    } catch (err) {
      clearInterval(timer);
      setProgress({ percent: 0, status: '' });
      addToast(`❌ ${err.message}`, 'error');
    } finally {
      setConverting(false);
    }
  };

  // Text Change Handler
  const handleTextChange = (e) => {
    const val = e.target.value;
    setEditedText(val);
    setIsDirty(val !== originalText);
  };

  // Save changes to Docx on Server
  const handleSaveWord = async () => {
    if (!result?.output_id) return;
    setSaving(true);
    try {
      const res = await api.saveWordContent(result.output_id, editedText);
      setResult(prev => ({
        ...prev,
        output_size: res.output_size || prev.output_size,
        word_count: res.word_count,
        char_count: res.char_count,
      }));
      setOriginalText(editedText);
      setIsDirty(false);
      addToast('💾 Đã lưu thay đổi & bảo toàn hình ảnh vào file Word!', 'success');
    } catch (err) {
      addToast(`❌ Lỗi khi lưu file Word: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Safe Word Download Handler
  const handleDownloadWord = async () => {
    if (!result) return;
    setDownloading(true);

    // If user has unsaved edits, auto-save before downloading
    if (isDirty) {
      try {
        const res = await api.saveWordContent(result.output_id, editedText);
        setResult(prev => ({
          ...prev,
          output_size: res.output_size || prev.output_size,
        }));
        setOriginalText(editedText);
        setIsDirty(false);
      } catch (e) {
        // Proceed with download even if save fails
      }
    }

    const baseName = file ? file.name.replace(/\.pdf$/i, '') : 'document';
    const filename = `${baseName}_converted.docx`;

    try {
      addToast('⬇️ Đang tải file Word về máy...', 'info');
      await api.downloadWordBlob(result.output_id, filename);
      addToast('✅ Tải file Word thành công!', 'success');
    } catch (err) {
      addToast(`❌ Lỗi tải file: ${err.message}`, 'error');
    } finally {
      setDownloading(false);
    }
  };

  // Download as Plain Text (.txt)
  const handleDownloadText = () => {
    const baseName = file ? file.name.replace(/\.pdf$/i, '') : 'document';
    const filename = `${baseName}_content.txt`;
    api.downloadTextBlob(editedText, filename);
    addToast('📄 Đã tải file Text (.txt) về máy!', 'success');
  };

  // Copy all text to clipboard
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(editedText);
      addToast('📋 Đã sao chép toàn bộ văn bản vào bộ nhớ tạm!', 'success');
    } catch (err) {
      addToast('❌ Không thể sao chép văn bản', 'error');
    }
  };

  // Reset to initial extracted text
  const handleResetText = () => {
    if (window.confirm('Bạn có chắc muốn khôi phục lại nội dung ban đầu từ file gốc?')) {
      setEditedText(originalText);
      setIsDirty(false);
      addToast('🔄 Đã khôi phục nội dung ban đầu', 'info');
    }
  };

  // Quick formatting insert helper
  const insertFormatting = (prefix, suffix = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = editedText.substring(start, end);
    const replacement = prefix + (selected || 'Văn bản') + suffix;

    const newText = editedText.substring(0, start) + replacement + editedText.substring(end);
    setEditedText(newText);
    setIsDirty(newText !== originalText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selected ? selected.length : 7));
    }, 50);
  };

  // Reset Everything
  const resetAll = () => {
    setStep(1);
    setFile(null);
    setFileId(null);
    setPdfInfo(null);
    setUploading(false);
    setMode('hybrid');
    setDpi(250);
    setPageRangeType('all');
    setCustomRange('');
    setConverting(false);
    setProgress({ percent: 0, status: '' });
    setResult(null);
    setPreviewPage(0);
    setEditedText('');
    setOriginalText('');
    setIsDirty(false);
    setActiveResultTab('editor');
    setResultVisualPage(0);
  };

  const stepClass = (n) => {
    if (n < step) return 'step done';
    if (n === step) return 'step active';
    return 'step';
  };

  // Realtime stats calculation
  const wordCount = editedText ? editedText.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = editedText ? editedText.length : 0;
  const lineCount = editedText ? editedText.split('\n').length : 0;

  return (
    <main className="main-content">
      <div className="tool-page">
        {/* Header */}
        <div className="tool-header">
          <div className="tool-header-icon" style={{ background: 'rgba(220, 38, 38, 0.12)', color: 'var(--accent-red)' }}>📄</div>
          <h1>PDF <span className="gradient-text">→ Word Chuyên Sâu</span></h1>
          <p>Tự động <strong>cắt đồ thị, bảng biến thiên, hình học không gian</strong> & chèn vào Word chuẩn xác.</p>
        </div>

        {/* Steps */}
        <div className="steps">
          <div className={stepClass(1)}>
            <div className="step-number">1</div><span>Chọn File PDF</span>
          </div>
          <div className={`step-line ${step >= 2 ? 'active' : ''}`}></div>
          <div className={stepClass(2)}>
            <div className="step-number">2</div><span>Cấu Hình & Chuyển Đổi</span>
          </div>
          <div className={`step-line ${step >= 3 ? 'active' : ''}`}></div>
          <div className={stepClass(3)}>
            <div className="step-number">3</div><span>Xem Thử, Sửa & Tải Về</span>
          </div>
        </div>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="glass-panel">
            <div {...getRootProps()} className={`upload-zone ${isDragActive ? 'drag-over' : ''}`}>
              <input {...getInputProps()} />
              <div className="upload-zone-icon">📁</div>
              <h3>Kéo thả file PDF vào đây để chuyển đổi</h3>
              <p>hoặc <span className="browse-btn">nhấn vào đây để chọn file</span> từ máy tính</p>
              <p style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Hỗ trợ tất cả file PDF (Đề thi toán, tài liệu scan, giáo trình) • Tối đa 100MB
              </p>
            </div>

            {uploading && (
              <div className="progress-container" style={{ marginTop: '1.5rem' }}>
                <div className="progress-label">
                  <span className="status">{progress.status}</span>
                  <span className="percent">{progress.percent}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${progress.percent}%` }}></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Configure & Preview */}
        {step === 2 && file && pdfInfo && (
          <>
            <div className="glass-panel">
              {/* File Info Bar */}
              <div className="file-info">
                <div className="file-icon pdf">📄</div>
                <div className="file-details">
                  <div className="file-name">{file.name}</div>
                  <div className="file-size">
                    {formatSize(file.size)} • <strong>{pdfInfo.num_pages} trang</strong>
                    {pdfInfo.is_math_heavy && <span style={{ marginLeft: '8px', color: '#b45309', fontWeight: 600 }}>[🧮 Đề toán/Công thức/Đồ thị]</span>}
                    {pdfInfo.is_scanned && <span style={{ marginLeft: '8px', color: '#059669', fontWeight: 600 }}>[📷 Tài liệu Scan]</span>}
                  </div>
                </div>
                <button className="file-remove" onClick={resetAll} title="Chọn file khác">✕</button>
              </div>

              {/* Conversion Modes */}
              <h3 style={{ marginTop: '1.5rem', fontSize: '1rem', color: 'var(--text-primary)' }}>
                ⚙️ Chọn chế độ chuyển đổi phù hợp:
              </h3>
              
              <div className="options-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                {/* Mode 1: Smart Hybrid */}
                <div
                  className={`option-card ${mode === 'hybrid' ? 'selected' : ''}`}
                  onClick={() => setMode('hybrid')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <h4>⚡ Văn Bản + Tự Cắt Đồ Thị & Bảng Biến Thiên</h4>
                    <span className="tag hot" style={{ fontSize: '0.65rem' }}>Khuyên Dùng</span>
                  </div>
                  <p>
                    Trích xuất câu hỏi thành văn bản Word sửa được, <strong>tự động nhận diện & cắt nét căng 300 DPI</strong> tất cả đồ thị hàm số, bảng biến thiên, hình học chèn thẳng vào Word dưới câu hỏi tương ứng.
                  </p>
                </div>

                {/* Mode 2: Math HD */}
                <div
                  className={`option-card ${mode === 'math_hd' ? 'selected' : ''}`}
                  onClick={() => setMode('math_hd')}
                >
                  <h4>🌟 Toán Học Siêu Nét HD (Toàn Trang)</h4>
                  <p>
                    Giữ <strong>100% nguyên vẹn</strong> bố cục toàn bộ trang gốc dưới dạng vector/ảnh HD sắc nét (không vỡ nét hay sai ký tự).
                  </p>
                </div>

                {/* Mode 3: Editable Text */}
                <div
                  className={`option-card ${mode === 'editable_text' ? 'selected' : ''}`}
                  onClick={() => setMode('editable_text')}
                >
                  <h4>📝 Văn Bản & Bảng Biểu Thuần</h4>
                  <p>
                    Chuyển thành chữ viết và bảng biểu dạng text trong Word để gõ sửa. Thích hợp cho đề văn, sử, địa, tài liệu chữ thuần túy.
                  </p>
                </div>
              </div>

              {/* Advanced Options Bar */}
              <div style={{
                marginTop: '1.5rem',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-glass)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                alignItems: 'center'
              }}>
                {/* DPI Quality */}
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Độ sắc nét hình ảnh cắt (DPI):
                  </label>
                  <select
                    value={dpi}
                    onChange={e => setDpi(Number(e.target.value))}
                    className="input-field"
                    style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                  >
                    <option value={200}>200 DPI - Nhanh & Nhẹ</option>
                    <option value={250}>250 DPI - Sắc nét (Khuyên dùng)</option>
                    <option value={300}>300 DPI - Siêu nét in ấn (HD Max)</option>
                  </select>
                </div>

                {/* Page Range */}
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Phạm vi trang cần chuyển:
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className={`format-btn ${pageRangeType === 'all' ? 'active' : ''}`}
                      onClick={() => setPageRangeType('all')}
                      style={{ padding: '6px 12px' }}
                    >
                      Tất cả ({pdfInfo.num_pages} trang)
                    </button>
                    <button
                      type="button"
                      className={`format-btn ${pageRangeType === 'custom' ? 'active' : ''}`}
                      onClick={() => setPageRangeType('custom')}
                      style={{ padding: '6px 12px' }}
                    >
                      Chọn trang
                    </button>
                  </div>
                </div>

                {/* Custom Range Input */}
                {pageRangeType === 'custom' && (
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                      Nhập số trang (VD: 1-3 hoặc 1,3,5):
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="VD: 1-4 hoặc 1, 3, 5"
                      value={customRange}
                      onChange={e => setCustomRange(e.target.value)}
                      style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                    />
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {converting && (
                <div className="progress-container" style={{ marginTop: '1.5rem' }}>
                  <div className="progress-label">
                    <span className="status">{progress.status}</span>
                    <span className="percent">{progress.percent}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${progress.percent}%` }}></div>
                  </div>
                </div>
              )}

              {/* Action Button */}
              {!converting && (
                <button
                  className="btn btn-primary btn-lg btn-block"
                  style={{ marginTop: '1.5rem' }}
                  onClick={handleConvert}
                >
                  🚀 Bắt Đầu Chuyển Đổi Sang Word (.DOCX)
                </button>
              )}
            </div>

            {/* Interactive Preview Panel */}
            <div className="glass-panel" style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                  👁️ Xem Trước Trang PDF Gốc ({previewPage + 1} / {pdfInfo.num_pages})
                </h3>

                {/* Page Navigation Buttons */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                    disabled={previewPage <= 0}
                    onClick={() => setPreviewPage(p => Math.max(0, p - 1))}
                  >
                    ◀ Trang trước
                  </button>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, padding: '0 6px' }}>
                    {previewPage + 1} / {pdfInfo.num_pages}
                  </span>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                    disabled={previewPage >= pdfInfo.num_pages - 1}
                    onClick={() => setPreviewPage(p => Math.min(pdfInfo.num_pages - 1, p + 1))}
                  >
                    Trang sau ▶
                  </button>
                </div>
              </div>

              {/* Page Image Preview */}
              <div className="preview-container" style={{ textAlign: 'center', background: '#ffffff', padding: '1rem' }}>
                <img
                  src={api.getPreviewUrl(fileId, previewPage, 180)}
                  alt={`Trang ${previewPage + 1}`}
                  style={{ maxWidth: '100%', maxHeight: '600px', objectFit: 'contain', borderRadius: '4px', boxShadow: 'var(--shadow-md)' }}
                />
              </div>
            </div>
          </>
        )}

        {/* Step 3: Result, Live Editor, and Safe Download */}
        {step === 3 && result && (
          <>
            <div className="glass-panel">
              {/* Success Banner */}
              <div className="alert alert-success">
                <span>🎉</span>
                <div style={{ flex: 1 }}>
                  <strong>Chuyển đổi thành công!</strong> Đồ thị và bảng biến thiên đã được tự động cắt nét căng và đưa vào Word. Bạn có thể xem trước, sửa chữ trực tiếp bên dưới và tải file về máy.
                  <div style={{ fontSize: '0.8rem', marginTop: '3px', opacity: 0.9 }}>
                    Thời gian xử lý: <strong>{result.elapsed_seconds} giây</strong> • Dung lượng file: <strong>{formatSize(result.output_size)}</strong> • {result.pages_converted || result.total_pages} trang
                  </div>
                </div>
              </div>

              {/* Action Buttons Bar */}
              <div className="result-actions-bar" style={{ marginTop: '1.25rem' }}>
                <button
                  className="btn btn-success btn-lg"
                  onClick={handleDownloadWord}
                  disabled={downloading}
                  style={{ gap: '8px' }}
                >
                  {downloading ? <span className="spinner"></span> : '⬇️'}
                  <strong>Tải File Word (.DOCX)</strong>
                </button>

                <button
                  className={`btn ${isDirty ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={handleSaveWord}
                  disabled={saving || !isDirty}
                  style={{ gap: '6px' }}
                  title="Lưu các nội dung bạn đã chỉnh sửa vào file Word trên server (bảo toàn hình ảnh đồ thị/bảng biến thiên)"
                >
                  {saving ? <span className="spinner"></span> : '💾'}
                  <strong>{isDirty ? 'Lưu thay đổi vào File Word (*)' : 'Đã lưu vào File Word'}</strong>
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={handleCopyText}
                  style={{ gap: '6px' }}
                  title="Sao chép toàn bộ văn bản vào clipboard"
                >
                  📋 Sao chép text
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={handleDownloadText}
                  style={{ gap: '6px' }}
                  title="Tải văn bản dạng text thô .txt"
                >
                  📄 Tải file .TXT
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={resetAll}
                  style={{ marginLeft: 'auto' }}
                  title="Chọn file khác để chuyển đổi"
                >
                  🔄 Chuyển file khác
                </button>
              </div>

              {/* View Switcher Tabs */}
              <div className="editor-tab-header" style={{ marginTop: '1.75rem' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`editor-tab-btn ${activeResultTab === 'editor' ? 'active' : ''}`}
                    onClick={() => setActiveResultTab('editor')}
                  >
                    📝 Xem Thử & Chỉnh Sửa Nội Dung ({wordCount} từ)
                  </button>
                  <button
                    type="button"
                    className={`editor-tab-btn ${activeResultTab === 'visual' ? 'active' : ''}`}
                    onClick={() => setActiveResultTab('visual')}
                  >
                    🖼️ Xem Trước Tài Liệu Gốc ({pdfInfo?.num_pages || 1} trang)
                  </button>
                </div>

                {activeResultTab === 'editor' && (
                  <div className="editor-status-indicator">
                    {isDirty ? (
                      <span className="badge-unsaved">⚠️ Có thay đổi chưa lưu</span>
                    ) : (
                      <span className="badge-saved">✅ Đã đồng bộ với file Word</span>
                    )}
                  </div>
                )}
              </div>

              {/* Tab 1: Live Interactive Document Editor */}
              {activeResultTab === 'editor' && (
                <div className="doc-editor-wrapper">
                  {/* Editor Toolbar */}
                  <div className="doc-editor-toolbar">
                    <div className="toolbar-group">
                      <button
                        type="button"
                        className="tool-btn"
                        onClick={() => insertFormatting('# ')}
                        title="Tiêu đề lớn"
                      >
                        H1
                      </button>
                      <button
                        type="button"
                        className="tool-btn"
                        onClick={() => insertFormatting('## ')}
                        title="Tiêu đề phụ / Câu hỏi"
                      >
                        H2
                      </button>
                      <button
                        type="button"
                        className="tool-btn"
                        onClick={() => insertFormatting('**', '**')}
                        title="In đậm (Bold)"
                      >
                        <strong>B</strong>
                      </button>
                      <button
                        type="button"
                        className="tool-btn"
                        onClick={() => insertFormatting('- ')}
                        title="Danh sách gạch đầu dòng"
                      >
                        • Danh sách
                      </button>
                      <button
                        type="button"
                        className="tool-btn"
                        onClick={() => insertFormatting('1. ')}
                        title="Danh sách đánh số"
                      >
                        1. Đánh số
                      </button>
                      <button
                        type="button"
                        className="tool-btn"
                        onClick={() => insertFormatting('\n[🖼️ Đồ thị / Hình vẽ minh họa]\n')}
                        title="Chèn thẻ vị trí hình ảnh đồ thị"
                        style={{ color: 'var(--accent-amber)', fontWeight: 700 }}
                      >
                        🖼️ Thẻ Ảnh/Đồ Thị
                      </button>
                    </div>

                    <div className="toolbar-group" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="editor-stats-text">
                        <strong>{wordCount}</strong> từ • <strong>{charCount}</strong> ký tự • <strong>{lineCount}</strong> dòng
                      </span>
                      {isDirty && (
                        <button
                          type="button"
                          className="tool-btn reset-btn"
                          onClick={handleResetText}
                          title="Khôi phục lại nội dung ban đầu từ file gốc"
                        >
                          🔄 Khôi phục
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Main Textarea */}
                  <textarea
                    ref={textareaRef}
                    className="doc-editor-textarea"
                    value={editedText}
                    onChange={handleTextChange}
                    placeholder="Nội dung văn bản được trích xuất từ file Word sẽ hiển thị ở đây. Các đồ thị và bảng biến thiên được đánh dấu [🖼️ ...]..."
                    rows={18}
                    spellCheck={false}
                  />

                  {/* Footer Hints */}
                  <div className="doc-editor-footer">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>💡</span>
                      <span>
                        <strong>Mẹo:</strong> Các thẻ <code>[🖼️ Đồ thị / Hình vẽ ...]</code> đại diện cho vị trí hình ảnh/bảng biến thiên đã cắt. Khi bạn sửa câu hỏi và bấm <strong>"Lưu thay đổi vào File Word"</strong>, hệ thống sẽ tự động ghép lại các hình ảnh nét căng vào file Word tải về!
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Visual High-Res Page Preview */}
              {activeResultTab === 'visual' && fileId && pdfInfo && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Trang {resultVisualPage + 1} / {pdfInfo.num_pages}
                    </span>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                        disabled={resultVisualPage <= 0}
                        onClick={() => setResultVisualPage(p => Math.max(0, p - 1))}
                      >
                        ◀ Trang trước
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                        disabled={resultVisualPage >= pdfInfo.num_pages - 1}
                        onClick={() => setResultVisualPage(p => Math.min(pdfInfo.num_pages - 1, p + 1))}
                      >
                        Trang sau ▶
                      </button>
                    </div>
                  </div>

                  <div className="preview-container" style={{ textAlign: 'center', background: '#ffffff', padding: '1rem' }}>
                    <img
                      src={api.getPreviewUrl(fileId, resultVisualPage, 200)}
                      alt={`Trang ${resultVisualPage + 1}`}
                      style={{ maxWidth: '100%', maxHeight: '650px', objectFit: 'contain', borderRadius: '4px', boxShadow: 'var(--shadow-md)' }}
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <footer className="footer">
        <p>© 2026 <strong>Tools All</strong> — Công cụ xử lý PDF chuyên sâu bằng Python & React.</p>
      </footer>

      <ToastContainer toasts={toasts} />
    </main>
  );
}
