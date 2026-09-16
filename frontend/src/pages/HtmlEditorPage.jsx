import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Braces, Check,
  Code, CodeXml, Copy, Download, Eraser, Eye, FileCode2, FilePlus2,
  Highlighter, ImagePlus, IndentDecrease, IndentIncrease, Italic, Link,
  List, ListOrdered, Maximize2, Minimize2, Minus, Monitor, Pilcrow,
  Quote, Redo2, Sigma, Smartphone, Strikethrough, Subscript, Superscript,
  Table2, Type, Underline, Undo2, Unlink, Upload, X,
} from 'lucide-react';
import katex from 'katex';
import HtmlVisualEditor from '../components/HtmlVisualEditor';
import { ToastContainer, useToast } from '../components/Toast';
import { buildHtmlDocument, escapeHtml, replaceDocumentBody, SAMPLE_HTML } from '../lib/htmlEditor';
import './HtmlEditorPage.css';

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const FORMATS = [
  { icon: Bold, label: 'In đậm', command: 'bold', tag: 'strong' },
  { icon: Italic, label: 'In nghiêng', command: 'italic', tag: 'em' },
  { icon: Underline, label: 'Gạch chân', command: 'underline', tag: 'u' },
  { icon: Strikethrough, label: 'Gạch ngang', command: 'strikeThrough', tag: 's' },
  { icon: Subscript, label: 'Chỉ số dưới', command: 'subscript', tag: 'sub' },
  { icon: Superscript, label: 'Chỉ số trên', command: 'superscript', tag: 'sup' },
];
const ALIGNMENTS = [
  { icon: AlignLeft, label: 'Căn trái', value: 'left', command: 'justifyLeft' },
  { icon: AlignCenter, label: 'Căn giữa', value: 'center', command: 'justifyCenter' },
  { icon: AlignRight, label: 'Căn phải', value: 'right', command: 'justifyRight' },
  { icon: AlignJustify, label: 'Căn đều', value: 'justify', command: 'justifyFull' },
];
const MATH_PRESETS = [
  ['Phân số', String.raw`\frac{a}{b}`], ['Căn bậc hai', String.raw`\sqrt{x}`],
  ['Lũy thừa', 'x^{2}'], ['Tổng', String.raw`\sum_{i=1}^{n} i`],
  ['Tích phân', String.raw`\int_{a}^{b} f(x)\,dx`], ['Giới hạn', String.raw`\lim_{x\to 0} f(x)`],
  ['Ma trận', String.raw`\begin{pmatrix} a & b \\ c & d \end{pmatrix}`],
];

function IconButton({ icon: Icon, label, onClick, disabled, active }) {
  return <button type="button" className={`html-icon-button ${active ? 'is-active' : ''}`} title={label} aria-label={label} disabled={disabled}
    onMouseDown={e => e.preventDefault()} onClick={onClick}><Icon size={17} strokeWidth={1.8} /></button>;
}

function InsertDialog({ kind, selected, onClose, onInsert }) {
  const dialogRef = useRef(null);
  const [url, setUrl] = useState('');
  const [text, setText] = useState(selected);
  const [latex, setLatex] = useState(selected.replace(/^\$\$?|\$\$?$/g, '') || String.raw`\frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`);
  const [display, setDisplay] = useState(true);
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(3);
  const [error, setError] = useState('');
  const titles = { link: 'Chèn liên kết', image: 'Chèn hình ảnh', table: 'Chèn bảng', math: 'Chèn công thức LaTeX' };
  const mathPreview = useMemo(() => kind === 'math' ? buildHtmlDocument(`<p>${display ? '$$' : '$'}${escapeHtml(latex)}${display ? '$$' : '$'}</p>`, true).html : '', [kind, latex, display]);
  useEffect(() => { dialogRef.current.showModal(); }, []);

  const submit = e => {
    e.preventDefault();
    let html;
    if (kind === 'math') {
      try { katex.renderToString(latex, { throwOnError: true, trust: false, maxExpand: 500, maxSize: 20 }); }
      catch (err) { setError(`Kiểm tra công thức: ${err.message}`); return; }
      const delimiter = display ? '$$' : '$';
      html = `<${display ? 'p' : 'span'}>${delimiter}${escapeHtml(latex)}${delimiter}</${display ? 'p' : 'span'}>`;
    } else if (kind === 'table') {
      const rowCount = Math.max(1, Math.min(20, Number(rows) || 1));
      const columnCount = Math.max(1, Math.min(10, Number(columns) || 1));
      const cell = (tag, content) => `<${tag} style="border: 1px solid #ccc; padding: 8px;">${content}</${tag}>`;
      html = '<table style="border-collapse: collapse; width: 100%;"><thead><tr>' + Array.from({ length: columnCount }, (_, i) => cell('th', `Cột ${i + 1}`)).join('') + '</tr></thead><tbody>' + Array.from({ length: rowCount }, () => '<tr>' + Array.from({ length: columnCount }, () => cell('td', 'Nội dung')).join('') + '</tr>').join('') + '</tbody></table><p><br></p>';
    } else {
      const value = url.trim();
      const allowed = kind === 'link' ? /^(https?:\/\/|mailto:|tel:|#)/i : /^(https?:\/\/|data:image\/(png|jpeg|gif|webp);base64,)/i;
      if (!allowed.test(value)) { setError(kind === 'link' ? 'Dùng liên kết https://, http://, mailto:, tel: hoặc #.' : 'Dùng URL ảnh https://, http:// hoặc ảnh PNG/JPEG/GIF/WebP dạng data URL.'); return; }
      html = kind === 'link' ? `<a href="${escapeHtml(value)}">${escapeHtml(text || value)}</a>` : `<img src="${escapeHtml(value)}" alt="${escapeHtml(text)}" style="max-width: 100%; height: auto;">`;
    }
    onInsert(html);
    onClose();
  };

  return <dialog ref={dialogRef} className="html-dialog" onCancel={onClose} onClick={e => { if (e.target === dialogRef.current) onClose(); }}>
    <form onSubmit={submit}>
      <div className="html-dialog-heading"><h2>{titles[kind]}</h2><IconButton icon={X} label="Đóng hộp thoại" onClick={onClose} /></div>
      {(kind === 'link' || kind === 'image') && <>
        <label>Đường dẫn<input autoFocus value={url} onChange={e => { setUrl(e.target.value); setError(''); }} placeholder="https://..." required /></label>
        <label>{kind === 'link' ? 'Văn bản hiển thị' : 'Mô tả hình ảnh (alt)'}<input value={text} onChange={e => setText(e.target.value)} /></label>
      </>}
      {kind === 'table' && <div className="html-dialog-grid">
        <label>Số hàng nội dung<input autoFocus type="number" min="1" max="20" value={rows} onChange={e => setRows(e.target.value)} required /></label>
        <label>Số cột<input type="number" min="1" max="10" value={columns} onChange={e => setColumns(e.target.value)} required /></label>
        <p>Bảng có thêm một hàng tiêu đề.</p>
      </div>}
      {kind === 'math' && <>
        <label>Công thức LaTeX<textarea aria-label="Công thức LaTeX" autoFocus value={latex} onChange={e => { setLatex(e.target.value); setError(''); }} rows="4" spellCheck="false" required /></label>
        <div className="html-math-presets">{MATH_PRESETS.map(([label, value]) => <button type="button" key={label} onClick={() => { setLatex(value); setError(''); }}>{label}</button>)}</div>
        <label className="html-checkbox"><input type="checkbox" checked={display} onChange={e => setDisplay(e.target.checked)} />Công thức trên dòng riêng</label>
        <iframe title="Xem trước công thức" sandbox="allow-same-origin" srcDoc={mathPreview} className="html-math-preview" />
      </>}
      {error && <p role="alert" className="html-error">{error}</p>}
      <div className="html-dialog-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button><button className="btn btn-primary" type="submit">Chèn vào tài liệu</button></div>
    </form>
  </dialog>;
}

export default function HtmlEditorPage() {
  const [source, setSource] = useState(SAMPLE_HTML);
  const [previewSource, setPreviewSource] = useState(SAMPLE_HTML);
  const [mode, setMode] = useState('source');
  const [visualDocument, setVisualDocument] = useState('');
  const [visualRevision, setVisualRevision] = useState(0);
  const [filename, setFilename] = useState('bai-hoc.html');
  const [dialog, setDialog] = useState(null);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [renderMath, setRenderMath] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [historyState, setHistoryState] = useState({ index: 0, length: 1 });
  const sourceRef = useRef(source);
  const textareaRef = useRef(null);
  const visualRef = useRef(null);
  const fileRef = useRef(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const historyRef = useRef({ entries: [SAMPLE_HTML], index: 0, time: 0 });
  const { toasts, addToast } = useToast();
  const preview = useMemo(() => buildHtmlDocument(previewSource, renderMath), [previewSource, renderMath]);
  const lines = useMemo(() => source.split('\n').length, [source]);

  useEffect(() => {
    const timer = setTimeout(() => setPreviewSource(source), 250);
    return () => clearTimeout(timer);
  }, [source]);
  const refreshVisual = value => {
    setVisualDocument(buildHtmlDocument(value).html);
    // The frame was edited in place: undo may restore the same srcdoc prop.
    setVisualRevision(revision => revision + 1);
  };
  const update = (value, groupTyping = false) => {
    if (value === sourceRef.current) return;
    sourceRef.current = value;
    setSource(value);
    const history = historyRef.current;
    const now = Date.now();
    if (groupTyping && history.index > 0 && history.index === history.entries.length - 1 && now - history.time < 650) {
      history.entries[history.index] = value;
    } else {
      history.entries = history.entries.slice(0, history.index + 1);
      history.entries.push(value);
      // Bound memory for large uploaded documents.
      const capacity = Math.max(2, Math.min(100, Math.floor(8 * 1024 * 1024 / Math.max(value.length, 1))));
      if (history.entries.length > capacity) history.entries = history.entries.slice(-capacity);
      history.index = history.entries.length - 1;
    }
    history.time = groupTyping ? now : 0;
    setHistoryState({ index: history.index, length: history.entries.length });
  };
  const travelHistory = direction => {
    const history = historyRef.current;
    const nextIndex = history.index + direction;
    if (nextIndex < 0 || nextIndex >= history.entries.length) return;
    history.index = nextIndex;
    history.time = 0;
    const value = history.entries[nextIndex];
    sourceRef.current = value;
    setSource(value);
    if (mode === 'visual') refreshVisual(value);
    setHistoryState({ index: nextIndex, length: history.entries.length });
  };
  const switchMode = nextMode => {
    if (nextMode === mode) return;
    if (nextMode === 'visual') refreshVisual(sourceRef.current);
    historyRef.current.time = 0;
    setMode(nextMode);
  };
  const insertSource = (prefix, suffix = '', placeholder = '') => {
    const value = sourceRef.current;
    const { start, end } = selectionRef.current;
    const selected = value.slice(start, end) || placeholder;
    const replacement = prefix + selected + suffix;
    update(value.slice(0, start) + replacement + value.slice(end));
    requestAnimationFrame(() => {
      const editor = textareaRef.current;
      if (!editor) return;
      editor.focus();
      const nextStart = suffix ? start + prefix.length : start + replacement.length;
      const nextEnd = suffix ? nextStart + selected.length : nextStart;
      editor.setSelectionRange(nextStart, nextEnd);
      selectionRef.current = { start: nextStart, end: nextEnd };
    });
  };
  const insertHtml = html => {
    if (mode === 'visual') visualRef.current?.command('insertHTML', html);
    else {
      const value = sourceRef.current;
      const { start, end } = selectionRef.current;
      update(value.slice(0, start) + html + value.slice(end));
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(start + html.length, start + html.length);
        selectionRef.current = { start: start + html.length, end: start + html.length };
      });
    }
  };
  const format = (command, tag, value, placeholder = 'Văn bản') => {
    if (mode === 'visual') visualRef.current?.command(command, value);
    else insertSource(`<${tag}>`, `</${tag.split(' ')[0]}>`, placeholder);
  };
  const openDialog = kind => {
    const { start, end } = selectionRef.current;
    const selected = mode === 'source' ? sourceRef.current.slice(start, end) : visualRef.current?.selectedText() || '';
    setDialog({ kind, selected });
  };
  const removeFormatting = linksOnly => {
    if (mode === 'visual') visualRef.current?.command(linksOnly ? 'unlink' : 'removeFormat');
    else {
      const { start, end } = selectionRef.current;
      if (start === end) { addToast('Chọn đoạn mã cần bỏ định dạng.', 'warning'); return; }
      const selected = sourceRef.current.slice(start, end);
      insertHtml(selected.replace(linksOnly ? /<\/?a\b[^>]*>/gi : /<\/?(?:strong|b|em|i|u|s|strike|sub|sup|span|font)\b[^>]*>/gi, ''));
    }
  };
  const loadFile = async file => {
    if (!file) return;
    if (!/\.html?$/i.test(file.name)) { addToast('Chọn tệp .html hoặc .htm.', 'error'); return; }
    if (file.size > MAX_FILE_SIZE) { addToast('Tệp HTML tối đa 2 MB.', 'error'); return; }
    try {
      const value = await file.text();
      update(value);
      setFilename(file.name);
      selectionRef.current = { start: 0, end: 0 };
      if (mode === 'visual') refreshVisual(value);
      addToast(`Đã mở ${file.name}`, 'success');
    } catch { addToast('Không đọc được tệp. Hãy thử tệp HTML UTF-8.', 'error'); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(sourceRef.current); addToast('Đã sao chép mã HTML', 'success'); }
    catch { addToast('Không thể truy cập clipboard. Chọn mã và nhấn Ctrl+C để sao chép.', 'error'); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([sourceRef.current], { type: 'text/html;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = /\.html?$/i.test(filename) ? filename : `${filename || 'tai-lieu'}.html`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    addToast('Đã tải mã HTML, giữ nguyên công thức LaTeX.', 'success');
  };
  const newDocument = () => {
    const value = '<!DOCTYPE html>\n<html lang="vi">\n<head>\n  <meta charset="UTF-8">\n  <title>Tài liệu mới</title>\n</head>\n<body>\n  <p>Viết nội dung của bạn tại đây.</p>\n</body>\n</html>';
    update(value);
    setFilename('tai-lieu.html');
    selectionRef.current = { start: 0, end: 0 };
    if (mode === 'visual') refreshVisual(value);
  };
  const keyboard = e => {
    if ((e.ctrlKey || e.metaKey) && ['z', 'y'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      travelHistory(e.key.toLowerCase() === 'y' || e.shiftKey ? 1 : -1);
    }
    if ((e.ctrlKey || e.metaKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      const item = FORMATS.find(item => item.command === ({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]));
      format(item.command, item.tag);
    }
  };

  return <main className="main-content"><div className={`html-page ${expanded ? 'html-expanded' : ''}`}>
    <header className="html-page-heading">
      <div className="html-heading-title"><div className="html-page-icon"><CodeXml size={27} /></div><div><div className="html-eyebrow">KHÔNG GIAN SOẠN THẢO</div><h1>Edit <span className="gradient-text">HTML</span></h1></div></div>
      <p>Từ mã nguồn đến trang hoàn chỉnh.<br />Sửa văn bản, thêm công thức và xem thay đổi tức thì.</p>
    </header>
    <section className="html-workspace" aria-label="Trình chỉnh sửa HTML">
      <div className="html-filebar">
        <div className="html-filename"><FileCode2 size={18} /><input aria-label="Tên tệp HTML" value={filename} onChange={e => setFilename(e.target.value)} /></div>
        <div className="html-file-actions">
          <button className="btn btn-secondary" onClick={newDocument}><FilePlus2 size={16} />Tạo mới</button>
          <button className="btn btn-secondary" onClick={() => fileRef.current.click()}><Upload size={16} />Mở HTML</button>
          <button className="btn btn-secondary" onClick={copy}><Copy size={16} />Sao chép</button>
          <button className="btn btn-primary" onClick={download}><Download size={16} />Tải HTML</button>
          <IconButton icon={expanded ? Minimize2 : Maximize2} label={expanded ? 'Thu gọn không gian làm việc' : 'Mở rộng không gian làm việc'} onClick={() => setExpanded(value => !value)} />
        </div>
        <input ref={fileRef} type="file" accept=".html,.htm,text/html" aria-label="Tải lên tệp HTML" hidden onChange={e => { loadFile(e.target.files[0]); e.target.value = ''; }} />
      </div>
      <div className="html-columns">
        <section className={`html-edit-panel ${dragging ? 'html-dragging' : ''}`} aria-label="Chỉnh sửa bên trái"
          onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
          onDrop={e => { e.preventDefault(); setDragging(false); loadFile(e.dataTransfer.files[0]); }}>
          <div className="html-panel-heading">
            <div className="html-mode-tabs" role="group" aria-label="Chế độ chỉnh sửa">
              <button className={mode === 'source' ? 'active' : ''} aria-pressed={mode === 'source'} onClick={() => switchMode('source')}><CodeXml size={16} />Mã HTML</button>
              <button className={mode === 'visual' ? 'active' : ''} aria-pressed={mode === 'visual'} onClick={() => switchMode('visual')}><Type size={16} />Văn bản</button>
            </div><span className="html-panel-caption">CHỈNH SỬA</span>
          </div>
          <div className="html-toolbar" role="toolbar" aria-label="Công cụ định dạng HTML">
            <div className="html-toolbar-group">
              <IconButton icon={Undo2} label="Hoàn tác (Ctrl+Z)" disabled={historyState.index === 0} onClick={() => travelHistory(-1)} />
              <IconButton icon={Redo2} label="Làm lại (Ctrl+Shift+Z)" disabled={historyState.index === historyState.length - 1} onClick={() => travelHistory(1)} />
            </div>
            <div className="html-toolbar-group">
              <select aria-label="Kiểu đoạn văn" value="" onChange={e => format('formatBlock', e.target.value, e.target.value)}>
                <option value="" disabled>Đoạn văn</option><option value="p">Đoạn thường</option><option value="h1">Tiêu đề 1</option><option value="h2">Tiêu đề 2</option><option value="h3">Tiêu đề 3</option><option value="h4">Tiêu đề 4</option><option value="h5">Tiêu đề 5</option><option value="h6">Tiêu đề 6</option>
              </select>
              <select aria-label="Phông chữ" value="" onChange={e => format('fontName', `span style="font-family: ${e.target.value}"`, e.target.value)}>
                <option value="" disabled>Phông chữ</option>{['Arial', 'Georgia', 'Times New Roman', 'Verdana', 'Courier New'].map(font => <option key={font}>{font}</option>)}
              </select>
              <select aria-label="Cỡ chữ" value="" onChange={e => format('fontSize', `span style="font-size: ${[10, 13, 16, 18, 24, 32, 48][Number(e.target.value) - 1]}px"`, e.target.value)}>
                <option value="" disabled>Cỡ chữ</option>{[10, 13, 16, 18, 24, 32, 48].map((size, index) => <option value={index + 1} key={size}>{size}</option>)}
              </select>
            </div>
            <div className="html-toolbar-group">{FORMATS.map(item => <IconButton key={item.command} icon={item.icon} label={item.label} onClick={() => format(item.command, item.tag)} />)}</div>
            <div className="html-toolbar-group">
              <label className="html-color-control" title="Màu chữ"><Type size={17} /><input type="color" aria-label="Màu chữ" defaultValue="#29332e" onChange={e => format('foreColor', `span style="color: ${e.target.value}"`, e.target.value)} /></label>
              <label className="html-color-control" title="Màu nền chữ"><Highlighter size={17} /><input type="color" aria-label="Màu nền chữ" defaultValue="#fef08a" onChange={e => format('hiliteColor', `span style="background-color: ${e.target.value}"`, e.target.value)} /></label>
              <IconButton icon={Eraser} label="Xóa định dạng chữ" onClick={() => removeFormatting(false)} />
            </div>
            <div className="html-toolbar-group">{ALIGNMENTS.map(item => <IconButton key={item.value} icon={item.icon} label={item.label} onClick={() => format(item.command, `p style="text-align: ${item.value}"`)} />)}</div>
            <div className="html-toolbar-group">
              <IconButton icon={List} label="Danh sách dấu đầu dòng" onClick={() => mode === 'visual' ? visualRef.current?.command('insertUnorderedList') : insertSource('<ul>\n  <li>', '</li>\n</ul>', 'Mục danh sách')} />
              <IconButton icon={ListOrdered} label="Danh sách đánh số" onClick={() => mode === 'visual' ? visualRef.current?.command('insertOrderedList') : insertSource('<ol>\n  <li>', '</li>\n</ol>', 'Mục danh sách')} />
              <IconButton icon={IndentIncrease} label="Tăng thụt lề" onClick={() => format('indent', 'div style="margin-left: 40px"')} />
              <IconButton icon={IndentDecrease} label="Giảm thụt lề" onClick={() => mode === 'visual' ? visualRef.current?.command('outdent') : insertHtml(sourceRef.current.slice(selectionRef.current.start, selectionRef.current.end).replace(/^(?: {1,2}|\t)/gm, ''))} />
              <IconButton icon={Quote} label="Trích dẫn" onClick={() => format('formatBlock', 'blockquote', 'blockquote')} />
            </div>
            <div className="html-toolbar-group">
              <IconButton icon={Link} label="Chèn liên kết" onClick={() => openDialog('link')} />
              <IconButton icon={Unlink} label="Bỏ liên kết" onClick={() => removeFormatting(true)} />
              <IconButton icon={ImagePlus} label="Chèn hình ảnh" onClick={() => openDialog('image')} />
              <IconButton icon={Table2} label="Chèn bảng" onClick={() => openDialog('table')} />
              <IconButton icon={Minus} label="Đường kẻ ngang" onClick={() => insertHtml('<hr>')} />
              <IconButton icon={Code} label="Mã trong dòng" onClick={() => mode === 'visual' ? insertHtml(`<code>${escapeHtml(visualRef.current?.selectedText() || 'mã nguồn')}</code>`) : insertSource('<code>', '</code>', 'mã nguồn')} />
              <IconButton icon={Braces} label="Khối mã" onClick={() => format('formatBlock', 'pre', 'pre', 'mã nguồn')} />
              <button className="html-math-button" onMouseDown={e => e.preventDefault()} onClick={() => openDialog('math')}><Sigma size={17} />LaTeX</button>
            </div>
          </div>
          <div className="html-editor-content">
            {mode === 'source' ? <div className="html-code-editor">
              <div className="html-line-gutter" aria-hidden="true"><div style={{ transform: `translateY(-${scrollTop}px)` }}>{Array.from({ length: lines }, (_, index) => <div key={index}>{index + 1}</div>)}</div></div>
              <textarea ref={textareaRef} aria-label="Mã HTML" value={source} spellCheck="false" wrap="off" placeholder="Dán mã HTML của bạn vào đây…" onKeyDown={keyboard}
                onSelect={e => { selectionRef.current = { start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd }; }}
                onScroll={e => setScrollTop(e.currentTarget.scrollTop)} onChange={e => update(e.target.value, true)} />
            </div> : <HtmlVisualEditor key={visualRevision} ref={visualRef} documentHtml={visualDocument} onChange={(body, groupTyping) => update(replaceDocumentBody(sourceRef.current, body), groupTyping)} onHistory={travelHistory} />}
            {dragging && <div className="html-drop-overlay"><Upload size={32} />Thả tệp HTML để mở</div>}
          </div>
          <div className="html-panel-footer"><span><Pilcrow size={13} />{lines} dòng · {source.length.toLocaleString('vi-VN')} ký tự</span><span>UTF-8</span></div>
        </section>
        <section className="html-preview-panel" aria-label="Xem trước bên phải">
          <div className="html-panel-heading"><strong><Eye size={17} />Xem trước</strong><div className="html-preview-tools">
            <span className="html-live"><span />Trực tiếp</span>
            <IconButton icon={Monitor} label="Xem trước máy tính" active={!mobilePreview} onClick={() => setMobilePreview(false)} />
            <IconButton icon={Smartphone} label="Xem trước điện thoại" active={mobilePreview} onClick={() => setMobilePreview(true)} />
          </div></div>
          <div className={`html-preview-canvas ${mobilePreview ? 'html-preview-mobile' : ''}`}><iframe title="Bản xem trước HTML" sandbox="allow-same-origin" srcDoc={preview.html} /></div>
          <div className="html-panel-footer"><span><Check size={13} />{source === previewSource ? 'Đã cập nhật' : 'Đang cập nhật…'}</span><label className="html-checkbox"><input type="checkbox" checked={renderMath} onChange={e => setRenderMath(e.target.checked)} />Hiển thị LaTeX</label></div>
        </section>
      </div>
    </section>
    <div className="html-help"><p><strong>Bắt đầu:</strong> mở tệp .html/.htm (tối đa 2 MB), kéo thả hoặc dán mã bên trái. Chuyển sang <strong>Văn bản</strong> để sửa trực quan; công thức giữ dạng LaTeX để bạn chỉnh trực tiếp.</p>
      <p>Hỗ trợ <code>{'$…$'}</code>, <code>{'$$…$$'}</code>, <code>{'\\(…\\)'}</code>, <code>{'\\[…\\]'}</code>. Xem trước HTML/CSS không chạy JavaScript. Ảnh và CSS ngoài cần URL đầy đủ. Chế độ Văn bản chuẩn hóa HTML khi sửa; tải HTML giữ mã LaTeX gốc.</p>
      {preview.mathErrors > 0 && <p className="html-error" role="status">Có {preview.mathErrors} công thức chưa hiển thị được. Kiểm tra mã LaTeX trong vùng soạn thảo.</p>}
    </div>
    {dialog && <InsertDialog {...dialog} onClose={() => setDialog(null)} onInsert={insertHtml} />}
    <ToastContainer toasts={toasts} />
  </div></main>;
}
