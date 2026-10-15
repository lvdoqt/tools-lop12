import { useState } from 'react';
import { api, validatePdfFiles } from '../api';
import { useFileResult } from '../useFileResult';
import { ToastContainer, useToast } from '../components/Toast';

const TOOLS = [
  { id: 'merge', title: 'Gộp PDF', text: 'Gộp nhiều file PDF thành một file duy nhất.', multiple: true, action: 'Gộp file PDF' },
  { id: 'split', title: 'Chia PDF', text: 'Chia tài liệu theo từng khoảng trang; mỗi khoảng tạo thành một file PDF.', multiple: false, action: 'Chia PDF' },
  { id: 'png', title: 'PDF → PNG', text: 'Xuất mỗi trang PDF thành ảnh PNG trong ZIP.', multiple: false, action: 'Xuất PNG' },
  { id: 'header', title: 'Gắn Header', text: 'Chèn tiêu đề / header (văn bản) vào đầu các trang của file PDF.', multiple: false, action: 'Gắn Header & Lưu PDF' },
];

const TEMPLATES = [
  'KỲ THI THỬ TỐT NGHIỆP THPT — MÔN TOÁN',
  'TRƯỜNG THPT ........................ — NĂM HỌC 2025-2026',
  'TÀI LIỆU ÔN TẬP TOÁN 12 — CHUYÊN ĐỀ NÂNG CAO',
  'KỲ THI THPT — TRANG {page}/{total}',
];

export default function PdfToolsPage() {
  const [active, setActive] = useState('merge');
  const [files, setFiles] = useState([]);
  const [dpi, setDpi] = useState(180);
  const [pageCount, setPageCount] = useState(null);
  const [segments, setSegments] = useState([{ start: '1', end: '', stop: false }]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useFileResult();
  const { toasts, addToast } = useToast();

  // Header tool specific states
  const [headerText, setHeaderText] = useState('KỲ THI THỬ TỐT NGHIỆP THPT — MÔN TOÁN');
  const [headerAlign, setHeaderAlign] = useState('center');
  const [headerLeft, setHeaderLeft] = useState('');
  const [headerRight, setHeaderRight] = useState('Trang {page}/{total}');
  const [headerFontSize, setHeaderFontSize] = useState(10);
  const [headerColor, setHeaderColor] = useState('#1e293b');
  const [headerDrawLine, setHeaderDrawLine] = useState(true);
  const [headerMarginTop, setHeaderMarginTop] = useState(24);
  const [headerPagesMode, setHeaderPagesMode] = useState('all');
  const [headerCustomPages, setHeaderCustomPages] = useState('');
  const [headerFillWhite, setHeaderFillWhite] = useState(false);
  const [showAdvancedHeader, setShowAdvancedHeader] = useState(false);

  const tool = TOOLS.find(item => item.id === active);

  const selectTool = id => {
    setActive(id);
    setFiles([]);
    setResult(null);
    setPageCount(null);
    setSegments([{ start: '1', end: '', stop: false }]);
  };

  const loadFiles = async (event) => {
    const selected = Array.from(event.target.files || []);
    try {
      validatePdfFiles(selected);
    } catch (error) {
      event.target.value = '';
      setFiles([]);
      setResult(null);
      setPageCount(null);
      addToast(error.message, 'error');
      return;
    }
    setFiles(selected);
    setResult(null);
    setPageCount(null);
    setSegments([{ start: '1', end: '', stop: false }]);

    if ((active !== 'split' && active !== 'header') || !selected[0]) return;
    try {
      const info = await api.getPdfToolInfo(selected[0]);
      setPageCount(info.pages);
    } catch (error) {
      if (active === 'split') setFiles([]);
      addToast(error.message, 'error');
    }
  };

  const updateSegment = (index, field, value) => {
    setResult(null);
    setSegments(current => {
      const next = current.map((segment, i) => i === index ? { ...segment, [field]: value } : segment);
      const segment = next[index];
      const end = Number(segment.end);
      if (field === 'end' && end && pageCount && end < pageCount && !segment.stop) {
        next.splice(index + 1, next.length - index - 1, { start: String(end + 1), end: '', stop: false });
      }
      if (field === 'end' && (!end || (pageCount && end >= pageCount))) next.splice(index + 1);
      if (field === 'stop' && value) next.splice(index + 1);
      if (field === 'stop' && !value && end && pageCount && end < pageCount) {
        next.splice(index + 1, next.length - index - 1, { start: String(end + 1), end: '', stop: false });
      }
      return next;
    });
  };

  const process = async () => {
    if (!files.length || (active === 'merge' && files.length < 2)) {
      return addToast(active === 'merge' ? 'Hãy chọn ít nhất 2 file PDF.' : 'Hãy chọn một file PDF.', 'warning');
    }

    if (active === 'header') {
      if (!headerText.trim() && !headerLeft.trim() && !headerRight.trim()) {
        return addToast('Vui lòng nhập nội dung văn bản header.', 'warning');
      }
      if (headerPagesMode === 'custom' && !headerCustomPages.trim()) {
        return addToast('Vui lòng nhập danh sách khoảng trang (ví dụ: 1-5, 8).', 'warning');
      }
      setLoading(true);
      setResult(null);
      try {
        const data = await api.pdfTool('header', files, {
          text: headerText,
          align: headerAlign,
          left_text: headerLeft,
          right_text: headerRight,
          font_size: headerFontSize,
          color: headerColor,
          margin_top: headerMarginTop,
          draw_line: headerDrawLine,
          pages_mode: headerPagesMode,
          custom_pages: headerCustomPages,
          fill_white_bg: headerFillWhite,
        });
        setResult(data);
        addToast(`Đã gắn header cho ${data.pages} trang PDF thành công.`, 'success');
      } catch (error) {
        addToast(error.message, 'error', 6000);
      } finally {
        setLoading(false);
      }
      return;
    }

    let ranges = null;
    if (active === 'split') {
      if (!pageCount) return addToast('Đang đọc số trang PDF, vui lòng thử lại sau ít giây.', 'warning');
      ranges = [];
      for (const segment of segments) {
        const start = Number(segment.start);
        const end = segment.end ? Number(segment.end) : pageCount;
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > pageCount) {
          return addToast(`Khoảng trang phải nằm trong 1–${pageCount}.`, 'warning');
        }
        ranges.push({ start, end });
        if (segment.stop) break;
      }
    }

    setLoading(true);
    setResult(null);
    try {
      const data = await api.pdfTool(active, files, dpi, ranges);
      setResult(data);
      addToast('Đã xử lý PDF thành công.', 'success');
    } catch (error) {
      addToast(error.message, 'error', 6000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="main-content">
      <div className="tool-page pdf-tools-page">
        <div className="tool-header">
          <div className="tool-header-icon">PDF</div>
          <h1>Công cụ <span className="gradient-text">PDF</span></h1>
          <p>Gộp tài liệu, chia theo khoảng trang, gắn header văn bản hoặc chuyển PDF thành ảnh PNG.</p>
        </div>

        <section className="glass-panel">
          <div className="method-tabs">
            {TOOLS.map(item => (
              <button
                key={item.id}
                disabled={loading}
                className={`method-tab ${active === item.id ? 'active' : ''}`}
                onClick={() => selectTool(item.id)}
              >
                {item.title}
              </button>
            ))}
          </div>

          <div className="alert alert-info">
            <span>ℹ️</span>
            <span>{tool.text}</span>
          </div>

          <label className="pdf-upload-zone">
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple={tool.multiple}
              disabled={loading}
              onChange={loadFiles}
            />
            <strong>Chọn {tool.multiple ? 'các file PDF' : 'file PDF'}</strong>
            <span>{tool.multiple ? 'Tổng tối đa 4 MB, tối đa 30 file. Thứ tự chọn là thứ tự gộp.' : 'Tối đa 4 MB.'}</span>
          </label>

          <p className="tex-hint">File kết quả tối đa 4 MB. Nếu vượt giới hạn, hãy giảm số trang hoặc DPI.</p>

          {files.length > 0 && (
            <ul className="pdf-file-list">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`}>
                  {index + 1}. {file.name} <small>{(file.size / 1024 / 1024).toFixed(2)} MB</small>
                  {pageCount && <span className="pdf-badge-pages"> ({pageCount} trang)</span>}
                </li>
              ))}
            </ul>
          )}

          {/* GẮN HEADER SECTION */}
          {active === 'header' && (
            <div className="pdf-header-container">
              <div className="pdf-header-form">
                <div className="form-group">
                  <label className="form-label">
                    <strong>Nội dung Header (Tiêu đề văn bản)</strong>
                    <span className="tex-hint">Hỗ trợ biến số trang: <code>{'{page}'}</code> = trang hiện tại, <code>{'{total}'}</code> = tổng trang</span>
                  </label>
                  <input
                    type="text"
                    className="pdf-header-input"
                    value={headerText}
                    onChange={e => { setHeaderText(e.target.value); setResult(null); }}
                    placeholder="Ví dụ: KỲ THI THỬ TỐT NGHIỆP THPT — MÔN TOÁN"
                  />
                  <div className="pdf-template-chips">
                    <span className="chips-title">Mẫu nhanh:</span>
                    {TEMPLATES.map((tmpl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="template-chip"
                        onClick={() => { setHeaderText(tmpl); setResult(null); }}
                      >
                        {tmpl.split('—')[0].trim()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pdf-header-row">
                  <div className="form-group flex-1">
                    <label className="form-label">Canh lề tiêu đề chính</label>
                    <div className="align-button-group">
                      <button
                        type="button"
                        className={`align-btn ${headerAlign === 'left' ? 'active' : ''}`}
                        onClick={() => { setHeaderAlign('left'); setResult(null); }}
                      >
                        Trái
                      </button>
                      <button
                        type="button"
                        className={`align-btn ${headerAlign === 'center' ? 'active' : ''}`}
                        onClick={() => { setHeaderAlign('center'); setResult(null); }}
                      >
                        Giữa
                      </button>
                      <button
                        type="button"
                        className={`align-btn ${headerAlign === 'right' ? 'active' : ''}`}
                        onClick={() => { setHeaderAlign('right'); setResult(null); }}
                      >
                        Phải
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Cỡ chữ</label>
                    <select
                      className="pdf-select"
                      value={headerFontSize}
                      onChange={e => { setHeaderFontSize(Number(e.target.value)); setResult(null); }}
                    >
                      <option value="8">8 pt (Nhỏ)</option>
                      <option value="9">9 pt</option>
                      <option value="10">10 pt (Chuẩn)</option>
                      <option value="11">11 pt</option>
                      <option value="12">12 pt (Vừa)</option>
                      <option value="14">14 pt (Lớn)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Màu chữ</label>
                    <div className="pdf-color-picker-wrap">
                      <input
                        type="color"
                        value={headerColor}
                        onChange={e => { setHeaderColor(e.target.value); setResult(null); }}
                        className="pdf-color-input"
                      />
                      <span className="pdf-color-val">{headerColor}</span>
                    </div>
                  </div>
                </div>

                <div className="pdf-header-toggles">
                  <label className="pdf-checkbox-label">
                    <input
                      type="checkbox"
                      checked={headerDrawLine}
                      onChange={e => { setHeaderDrawLine(e.target.checked); setResult(null); }}
                    />
                    <span>Kẻ đường ngang phân cách dưới header</span>
                  </label>

                  <button
                    type="button"
                    className="btn-toggle-advanced"
                    onClick={() => setShowAdvancedHeader(!showAdvancedHeader)}
                  >
                    {showAdvancedHeader ? '▲ Thu gọn tùy chọn nâng cao' : '▼ Tùy chọn nâng cao (Header 2 bên, trang áp dụng...)'}
                  </button>
                </div>

                {showAdvancedHeader && (
                  <div className="pdf-advanced-panel">
                    <div className="pdf-header-row">
                      <div className="form-group flex-1">
                        <label className="form-label">Header phụ bên trái (tùy chọn)</label>
                        <input
                          type="text"
                          className="pdf-header-input"
                          value={headerLeft}
                          onChange={e => { setHeaderLeft(e.target.value); setResult(null); }}
                          placeholder="Ví dụ: SỞ GD&ĐT HÀ NỘI"
                        />
                      </div>
                      <div className="form-group flex-1">
                        <label className="form-label">Header phụ bên phải (tùy chọn)</label>
                        <input
                          type="text"
                          className="pdf-header-input"
                          value={headerRight}
                          onChange={e => { setHeaderRight(e.target.value); setResult(null); }}
                          placeholder="Ví dụ: Trang {page}/{total}"
                        />
                      </div>
                    </div>

                    <div className="pdf-header-row">
                      <div className="form-group flex-1">
                        <label className="form-label">Áp dụng cho các trang</label>
                        <select
                          className="pdf-select w-100"
                          value={headerPagesMode}
                          onChange={e => { setHeaderPagesMode(e.target.value); setResult(null); }}
                        >
                          <option value="all">Tất cả các trang</option>
                          <option value="skip_first">Bỏ qua trang bìa / trang đầu (từ trang 2)</option>
                          <option value="first_only">Chỉ trang đầu tiên</option>
                          <option value="custom">Tùy chỉnh khoảng trang</option>
                        </select>
                      </div>

                      {headerPagesMode === 'custom' && (
                        <div className="form-group flex-1">
                          <label className="form-label">Nhập khoảng trang (ví dụ: 1-3, 5)</label>
                          <input
                            type="text"
                            className="pdf-header-input"
                            value={headerCustomPages}
                            onChange={e => { setHeaderCustomPages(e.target.value); setResult(null); }}
                            placeholder="Ví dụ: 1-5, 8, 10"
                          />
                        </div>
                      )}

                      <div className="form-group">
                        <label className="form-label">Khoảng cách lề trên</label>
                        <select
                          className="pdf-select"
                          value={headerMarginTop}
                          onChange={e => { setHeaderMarginTop(Number(e.target.value)); setResult(null); }}
                        >
                          <option value="15">15 pt (Sát mép)</option>
                          <option value="20">20 pt (Gọn)</option>
                          <option value="24">24 pt (Tiêu chuẩn)</option>
                          <option value="32">32 pt (Rộng)</option>
                          <option value="42">42 pt (Rất rộng)</option>
                        </select>
                      </div>
                    </div>

                    <label className="pdf-checkbox-label">
                      <input
                        type="checkbox"
                        checked={headerFillWhite}
                        onChange={e => { setHeaderFillWhite(e.target.checked); setResult(null); }}
                      />
                      <span>Tạo dải nền trắng che đầu trang (hữu ích nếu file gốc có chữ sát mép trên)</span>
                    </label>
                  </div>
                )}
              </div>

              {/* LIVE PREVIEW BOX */}
              <div className="pdf-preview-box">
                <div className="pdf-preview-header-bar">
                  <span>👁️ Xem trước hiển thị trên trang {headerPagesMode === 'skip_first' ? '2' : '1'} / {pageCount || 10}</span>
                </div>
                <div
                  className="pdf-preview-sheet"
                  style={{ paddingTop: `${Math.max(12, headerMarginTop * 0.7)}px` }}
                >
                  {headerFillWhite && <div className="pdf-preview-white-bg" />}
                  <div
                    className="pdf-preview-text-line"
                    style={{ fontSize: `${headerFontSize}px`, color: headerColor }}
                  >
                    {headerLeft && (
                      <span className="preview-left">
                        {headerLeft.replace('{page}', headerPagesMode === 'skip_first' ? '2' : '1').replace('{total}', String(pageCount || 10))}
                      </span>
                    )}
                    {headerText && (
                      <span className={`preview-center align-${headerAlign}`}>
                        {headerText.replace('{page}', headerPagesMode === 'skip_first' ? '2' : '1').replace('{total}', String(pageCount || 10))}
                      </span>
                    )}
                    {headerRight && (
                      <span className="preview-right">
                        {headerRight.replace('{page}', headerPagesMode === 'skip_first' ? '2' : '1').replace('{total}', String(pageCount || 10))}
                      </span>
                    )}
                  </div>
                  {headerDrawLine && <div className="pdf-preview-rule" />}

                  <div className="pdf-preview-dummy-content">
                    <div className="dummy-bar dummy-heading" />
                    <div className="dummy-bar dummy-p1" />
                    <div className="dummy-bar dummy-p2" />
                    <div className="dummy-bar dummy-p3" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {active === 'split' && pageCount && (
            <div className="pdf-split-range">
              <h3>PDF có {pageCount} trang</h3>
              {segments.map((segment, index) => (
                <div className="pdf-segment" key={index}>
                  <strong>File {index + 1}</strong>
                  <label>
                    Từ trang
                    <input
                      type="number"
                      min="1"
                      max={pageCount}
                      value={segment.start}
                      onChange={e => updateSegment(index, 'start', e.target.value)}
                    />
                  </label>
                  <label>
                    Đến trang
                    <input
                      type="number"
                      min="1"
                      max={pageCount}
                      value={segment.end}
                      onChange={e => updateSegment(index, 'end', e.target.value)}
                      placeholder={`Đến hết (${pageCount})`}
                    />
                  </label>
                  {segment.end && Number(segment.end) < pageCount && (
                    <label className="pdf-stop">
                      <input
                        type="checkbox"
                        checked={segment.stop}
                        onChange={e => updateSegment(index, 'stop', e.target.checked)}
                      /> Dừng tại trang này
                    </label>
                  )}
                </div>
              ))}
              <p>Nhập trang cuối của mỗi đoạn. Nếu chưa đến trang {pageCount}, hệ thống tự thêm dòng phân đoạn tiếp theo. Chọn “Dừng tại trang này” nếu không cắt phần còn lại.</p>
            </div>
          )}

          {active === 'png' && (
            <label className="pdf-dpi">
              Chất lượng PNG
              <select value={dpi} onChange={event => setDpi(Number(event.target.value))}>
                <option value="120">120 DPI</option>
                <option value="180">180 DPI</option>
                <option value="240">240 DPI</option>
                <option value="300">300 DPI</option>
              </select>
            </label>
          )}

          <button
            className="btn btn-primary btn-lg"
            onClick={process}
            disabled={loading}
          >
            {loading ? <><span className="spinner" /> Đang xử lý...</> : tool.action}
          </button>

          {result && (
            <div className="alert alert-success pdf-result">
              <span>✓</span>
              <span>
                Đã xử lý {result.pages} trang{result.files > 1 ? ` thành ${result.files} file PDF` : ''}.{' '}
                <a href={result.download_url} download={result.filename}>Tải file kết quả ({result.filename})</a>
              </span>
            </div>
          )}
        </section>
      </div>
      <ToastContainer toasts={toasts} />
    </main>
  );
}
