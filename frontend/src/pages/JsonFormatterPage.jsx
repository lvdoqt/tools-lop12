import { useMemo, useRef, useState } from 'react';
import { ToastContainer, useToast } from '../components/Toast';

const SAMPLE_JSON = `{
  "name": "Tools All",
  "version": "1.0.0",
  "features": ["format", "minify", "validate"],
  "active": true
}`;

function getErrorDetails(message, source) {
  const match = message.match(/position\s+(\d+)/i);
  const position = match ? Number(match[1]) : Math.max(0, source.length - 1);
  const before = source.slice(0, position);
  const line = before.split('\n').length;
  const column = position - before.lastIndexOf('\n');
  const character = source[position] || 'cuối tệp';
  const lower = message.toLowerCase();
  let suggestion = 'Kiểm tra dấu phẩy, dấu ngoặc và dấu nháy kép ở ngay trước vị trí này.';

  if (lower.includes('unterminated string')) suggestion = 'Thêm dấu nháy kép (") để đóng chuỗi đang bị thiếu.';
  else if (lower.includes('unexpected token') || lower.includes('expected')) suggestion = 'JSON chỉ dùng dấu nháy kép cho tên trường/chuỗi; kiểm tra dấu phẩy hoặc dấu ngoặc ngay trước ký tự này.';
  else if (lower.includes('unexpected end')) suggestion = 'JSON đang bị thiếu phần kết thúc. Hãy đóng dấu nháy, ngoặc vuông ] hoặc ngoặc nhọn }.';
  return { position, line, column, character, message, suggestion };
}

export default function JsonFormatterPage() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [indent, setIndent] = useState(2);
  const [error, setError] = useState(null);
  const [inputScrollTop, setInputScrollTop] = useState(0);
  const inputRef = useRef(null);
  const { toasts, addToast } = useToast();
  const stats = useMemo(() => ({ input: new Blob([input]).size, output: new Blob([output]).size }), [input, output]);
  const lineNumbers = useMemo(() => Array.from({ length: Math.max(1, input.split('\n').length) }, (_, i) => i + 1), [input]);

  const focusError = (details) => requestAnimationFrame(() => {
    const editor = inputRef.current;
    if (!editor) return;
    editor.focus();
    editor.setSelectionRange(details.position, Math.min(details.position + 1, input.length));
  });
  const parse = () => {
    try { const value = JSON.parse(input); setError(null); return value; }
    catch (err) { const details = getErrorDetails(err.message, input); setError(details); focusError(details); addToast(`JSON không hợp lệ tại dòng ${details.line}, cột ${details.column}`, 'error'); return null; }
  };
  const format = () => { if (!input.trim()) return addToast('Hãy dán JSON vào ô bên trái.', 'warning'); const value = parse(); if (value !== null) { setOutput(JSON.stringify(value, null, indent)); addToast('Đã định dạng JSON', 'success'); } };
  const minify = () => { if (!input.trim()) return addToast('Hãy dán JSON vào ô bên trái.', 'warning'); const value = parse(); if (value !== null) { setOutput(JSON.stringify(value)); addToast('Đã nén JSON', 'success'); } };
  const validate = () => { if (!input.trim()) return addToast('Hãy dán JSON để kiểm tra.', 'warning'); const value = parse(); if (value !== null) { setOutput(JSON.stringify(value, null, indent)); addToast('JSON hợp lệ', 'success'); } };
  const copy = async () => { if (!output) return addToast('Chưa có kết quả để sao chép.', 'warning'); try { await navigator.clipboard.writeText(output); addToast('Đã sao chép kết quả', 'success'); } catch { addToast('Không thể sao chép', 'error'); } };
  const download = () => { if (!output) return addToast('Chưa có kết quả để tải.', 'warning'); const url = URL.createObjectURL(new Blob([output], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'formatted.json'; link.click(); URL.revokeObjectURL(url); };

  return <main className="main-content"><div className="tool-page json-page">
    <div className="tool-header"><div className="tool-header-icon json-header-icon">{'{ }'}</div><h1>JSON <span className="gradient-text">Formatter</span></h1><p>Định dạng, nén và kiểm tra JSON ngay trên trình duyệt của bạn.</p></div>
    <div className="glass-panel">
      <div className="json-toolbar"><div className="json-actions"><button className="btn btn-primary" onClick={format}>✨ Định dạng</button><button className="btn btn-secondary" onClick={minify}>↙ Nén JSON</button><button className="btn btn-secondary" onClick={validate}>✓ Kiểm tra</button></div><label className="json-indent">Thụt lề <select value={indent} onChange={e => setIndent(Number(e.target.value))}><option value={2}>2 spaces</option><option value={4}>4 spaces</option></select></label></div>
      {error && <div className="alert alert-error json-error"><span>⚠️</span><div><strong>Lỗi tại dòng {error.line}, cột {error.column}</strong> — ký tự <code>{error.character}</code>.<br />{error.suggestion}<span className="json-error-detail"> ({error.message})</span></div></div>}
      <div className="json-editor-grid">
        <div className="json-editor-panel"><div className="json-editor-label"><label htmlFor="json-input">JSON đầu vào</label><span>{stats.input} bytes</span></div><div className={`json-editor ${error ? 'has-error' : ''}`}><div className="json-line-numbers" aria-hidden="true" style={{ transform: `translateY(-${inputScrollTop}px)` }}>{lineNumbers.map(line => <span className={error?.line === line ? 'error-line' : ''} key={line}>{line}</span>)}</div><textarea ref={inputRef} id="json-input" className="json-textarea json-input-textarea" value={input} onScroll={e => setInputScrollTop(e.currentTarget.scrollTop)} onChange={e => { setInput(e.target.value); setError(null); }} placeholder={'Dán JSON của bạn vào đây...\n\nVí dụ:\n{"hello": "world"}'} spellCheck="false" wrap="off" /></div></div>
        <div className="json-editor-panel"><div className="json-editor-label"><label htmlFor="json-output">Kết quả</label><span>{stats.output} bytes</span></div><textarea id="json-output" className="json-textarea" value={output} readOnly placeholder="Kết quả sẽ xuất hiện ở đây..." spellCheck="false" /></div>
      </div>
      <div className="json-footer-actions"><div><button className="btn btn-secondary" onClick={() => { setInput(SAMPLE_JSON); setOutput(''); setError(null); }}>📄 Dùng ví dụ</button><button className="btn btn-secondary" onClick={() => { setInput(''); setOutput(''); setError(null); }}>↺ Xóa tất cả</button></div><div><button className="btn btn-secondary" onClick={copy}>📋 Sao chép</button><button className="btn btn-success" onClick={download}>⬇ Tải .json</button></div></div>
    </div>
  </div><ToastContainer toasts={toasts} /></main>;
}
