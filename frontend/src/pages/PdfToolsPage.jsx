import { useState } from 'react';
import { api, validatePdfFiles } from '../api';
import { useFileResult } from '../useFileResult';
import { ToastContainer, useToast } from '../components/Toast';

const TOOLS = [
  { id: 'merge', title: 'Gộp PDF', text: 'Gộp nhiều file PDF thành một file duy nhất.', multiple: true, action: 'Gộp file PDF' },
  { id: 'split', title: 'Chia PDF', text: 'Chia tài liệu theo từng khoảng trang; mỗi khoảng tạo thành một file PDF.', multiple: false, action: 'Chia PDF' },
  { id: 'png', title: 'PDF → PNG', text: 'Xuất mỗi trang PDF thành ảnh PNG trong ZIP.', multiple: false, action: 'Xuất PNG' },
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
  const tool = TOOLS.find(item => item.id === active);

  const selectTool = id => { setActive(id); setFiles([]); setResult(null); setPageCount(null); setSegments([{ start: '1', end: '', stop: false }]); };
  const loadFiles = async (event) => {
    const selected = Array.from(event.target.files || []);
    try { validatePdfFiles(selected); }
    catch (error) { event.target.value = ''; setFiles([]); setResult(null); setPageCount(null); addToast(error.message, 'error'); return; }
    setFiles(selected); setResult(null); setPageCount(null); setSegments([{ start: '1', end: '', stop: false }]);
    if (active !== 'split' || !selected[0]) return;
    try { const info = await api.getPdfToolInfo(selected[0]); setPageCount(info.pages); }
    catch (error) { setFiles([]); addToast(error.message, 'error'); }
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
      if (field === 'stop' && !value && end && pageCount && end < pageCount) next.splice(index + 1, next.length - index - 1, { start: String(end + 1), end: '', stop: false });
      return next;
    });
  };
  const process = async () => {
    if (!files.length || (active === 'merge' && files.length < 2)) return addToast(active === 'merge' ? 'Hãy chọn ít nhất 2 file PDF.' : 'Hãy chọn một file PDF.', 'warning');
    let ranges = null;
    if (active === 'split') {
      if (!pageCount) return addToast('Đang đọc số trang PDF, vui lòng thử lại sau ít giây.', 'warning');
      ranges = [];
      for (const segment of segments) {
        const start = Number(segment.start); const end = segment.end ? Number(segment.end) : pageCount;
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > pageCount) return addToast(`Khoảng trang phải nằm trong 1–${pageCount}.`, 'warning');
        ranges.push({ start, end });
        if (segment.stop) break;
      }
    }
    setLoading(true);
    setResult(null);
    try { const data = await api.pdfTool(active, files, dpi, ranges); setResult(data); addToast('Đã xử lý PDF thành công.', 'success'); }
    catch (error) { addToast(error.message, 'error', 6000); }
    finally { setLoading(false); }
  };

  return <main className="main-content"><div className="tool-page pdf-tools-page">
    <div className="tool-header"><div className="tool-header-icon">PDF</div><h1>Công cụ <span className="gradient-text">PDF</span></h1><p>Gộp tài liệu, chia theo khoảng trang hoặc chuyển PDF thành ảnh PNG.</p></div>
    <section className="glass-panel">
      <div className="method-tabs">{TOOLS.map(item => <button key={item.id} disabled={loading} className={`method-tab ${active === item.id ? 'active' : ''}`} onClick={() => selectTool(item.id)}>{item.title}</button>)}</div>
      <div className="alert alert-info"><span>ℹ️</span><span>{tool.text}</span></div>
      <label className="pdf-upload-zone"><input type="file" accept="application/pdf,.pdf" multiple={tool.multiple} disabled={loading} onChange={loadFiles} /><strong>Chọn {tool.multiple ? 'các file PDF' : 'file PDF'}</strong><span>{tool.multiple ? 'Tổng tối đa 4 MB, tối đa 30 file. Thứ tự chọn là thứ tự gộp.' : 'Tối đa 4 MB.'}</span></label>
      <p className="tex-hint">File kết quả tối đa 4 MB. Nếu vượt giới hạn, hãy giảm số trang hoặc DPI.</p>
      {files.length > 0 && <ul className="pdf-file-list">{files.map((file, index) => <li key={`${file.name}-${index}`}>{index + 1}. {file.name} <small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></li>)}</ul>}
      {active === 'split' && pageCount && <div className="pdf-split-range"><h3>PDF có {pageCount} trang</h3>{segments.map((segment, index) => <div className="pdf-segment" key={index}><strong>File {index + 1}</strong><label>Từ trang <input type="number" min="1" max={pageCount} value={segment.start} onChange={e => updateSegment(index, 'start', e.target.value)} /></label><label>Đến trang <input type="number" min="1" max={pageCount} value={segment.end} onChange={e => updateSegment(index, 'end', e.target.value)} placeholder={`Đến hết (${pageCount})`} /></label>{segment.end && Number(segment.end) < pageCount && <label className="pdf-stop"><input type="checkbox" checked={segment.stop} onChange={e => updateSegment(index, 'stop', e.target.checked)} /> Dừng tại trang này</label>}</div>)}<p>Nhập trang cuối của mỗi đoạn. Nếu chưa đến trang {pageCount}, hệ thống tự thêm dòng phân đoạn tiếp theo. Chọn “Dừng tại trang này” nếu không cắt phần còn lại.</p></div>}
      {active === 'png' && <label className="pdf-dpi">Chất lượng PNG <select value={dpi} onChange={event => setDpi(Number(event.target.value))}><option value="120">120 DPI</option><option value="180">180 DPI</option><option value="240">240 DPI</option><option value="300">300 DPI</option></select></label>}
      <button className="btn btn-primary btn-lg" onClick={process} disabled={loading}>{loading ? <><span className="spinner" /> Đang xử lý...</> : tool.action}</button>
      {result && <div className="alert alert-success pdf-result"><span>✓</span><span>Đã xử lý {result.pages} trang{result.files > 1 ? ` thành ${result.files} file PDF` : ''}. <a href={result.download_url} download={result.filename}>Tải file kết quả</a></span></div>}
    </section>
  </div><ToastContainer toasts={toasts} /></main>;
}
