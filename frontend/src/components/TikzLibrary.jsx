import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE } from '../api';

function downloadTikz(source, title = 'tikz-diagram') {
  const url = URL.createObjectURL(new Blob([source], { type: 'application/x-tex;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = `${title.replace(/[<>:"/\\|?*]/g, '-')}.tex`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function TikzLibrary({ compiled, onOpen, addToast }) {
  const [key, setKey] = useState('');
  const [connected, setConnected] = useState(false);
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [savedId, setSavedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const attempted = useRef(null);
  const saveLock = useRef(false);

  const request = useCallback(async (path = '', method = 'GET', body) => {
    const response = await fetch(`${API_BASE}/tikz/library${path}`, {
      method, headers: { 'Content-Type': 'application/json', 'X-Library-Key': key.trim() },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Không truy cập được thư viện.');
    return data;
  }, [key]);

  async function load(append = false) {
    setBusy(true); setError('');
    try {
      const search = append ? activeQuery : query;
      const rows = await request(`?offset=${append ? items.length : 0}&q=${encodeURIComponent(search)}`);
      setItems(previous => append ? [...previous, ...rows] : rows);
      setMore(rows.length === 25); setActiveQuery(search); setConnected(true);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  const save = useCallback(async () => {
    if (!compiled?.svg || !connected || saveLock.current) return;
    saveLock.current = true; setSaving(true); setError('');
    const snapshot = compiled;
    try {
      const row = await request('', 'POST', {
        source: snapshot.source, svg: snapshot.svg, dpi: snapshot.dpi,
        title: title.trim() || `Hình TikZ ${new Date().toLocaleString('vi-VN')}`,
      });
      setQuery(''); setActiveQuery('');
      const rows = await request('?offset=0');
      setItems(rows); setMore(rows.length === 25);
      setSavedId(snapshot.id);
      addToast(`Đã lưu “${row.title}” lên thư viện`, 'success');
    } catch (e) { setError(`Chưa hoàn tất lưu: ${e.message} Bấm “Lưu vào thư viện” để thử lại.`); }
    finally { saveLock.current = false; setSaving(false); }
  }, [compiled, connected, title, request, addToast]);

  // Each successful compilation is saved once when the library is unlocked.
  useEffect(() => {
    if (compiled?.svg && connected && !saving && attempted.current !== compiled.id) {
      attempted.current = compiled.id;
      save();
    }
  }, [compiled, connected, saving, save]);

  async function action(fn) {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  const copy = text => action(async () => { await navigator.clipboard.writeText(text); addToast('Đã sao chép', 'success'); });

  const download = (url, filename) => action(async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Không tải được ảnh từ Cloudinary. Bạn có thể thử link mở ảnh.');
    const objectUrl = URL.createObjectURL(await response.blob());
    const a = document.createElement('a'); a.href = objectUrl; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  });

  return <section className="glass-panel tikz-library">
    <h2>Thư viện hình TikZ</h2>
    <p>Ảnh lưu trên Cloudinary, mã TikZ lưu trên Supabase. Mở thư viện để tự lưu mỗi lần vẽ thành công.</p>
    {!connected ? <form className="tikz-library-toolbar" onSubmit={e => { e.preventDefault(); load(); }}>
      <label>Mã truy cập thư viện<input type="password" value={key} onChange={e => setKey(e.target.value)} autoComplete="current-password" required /></label>
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Đang mở...' : 'Mở thư viện'}</button>
    </form> : <>
      <div className="tikz-library-toolbar">
        <label>Tên hình cho lần lưu tiếp theo<input value={title} maxLength={200} onChange={e => setTitle(e.target.value)} placeholder="Ví dụ: Hình chóp S.ABCD" /></label>
        <button className="btn btn-primary" disabled={!compiled?.svg || saving || savedId === compiled?.id} onClick={save}>{saving ? 'Đang lưu lên đám mây...' : savedId === compiled?.id ? 'Đã lưu hình hiện tại' : 'Lưu vào thư viện'}</button>
        <button className="tool-btn" disabled={busy || saving} onClick={() => { setConnected(false); setKey(''); setItems([]); setDetail(null); }}>Khóa thư viện</button>
      </div>
      <form className="tikz-library-toolbar" onSubmit={e => { e.preventDefault(); load(); }}>
        <label>Tìm theo tên<input value={query} maxLength={200} onChange={e => setQuery(e.target.value)} placeholder="Tên hình..." /></label>
        <button className="tool-btn" disabled={busy || saving}>Tìm / Làm mới</button>
      </form>
      {!items.length && !busy && <p>Chưa có hình phù hợp. Vẽ hình mới để lưu vào thư viện.</p>}
      <div className="tikz-library-grid">{items.map(item => <article className="tikz-library-card" key={item.id}>
        <img loading="lazy" src={item.svg_url.replace('/image/upload/', '/image/upload/w_420,c_limit/')} alt={item.title} />
        <strong>{item.title}</strong><small>{new Date(item.created_at).toLocaleString('vi-VN')} · {item.dpi} DPI</small>
        <div className="tikz-library-links">{[['SVG', item.svg_url], ['PNG', item.png_url]].map(([format, url]) => <div key={format}>
          <a href={url} target="_blank" rel="noreferrer">Mở {format} ↗</a>
          <button className="tool-btn" disabled={busy} onClick={() => download(url, `tikz-${item.id}.${format.toLowerCase()}`)}>Tải {format}</button>
          <button className="tool-btn" disabled={busy} onClick={() => copy(url)}>Sao chép link</button>
          <input aria-label={`Link ${format} ${item.title}`} readOnly value={url} onFocus={e => e.target.select()} />
        </div>)}</div>
        <div className="tikz-library-toolbar">
          <button className="tool-btn" disabled={busy} onClick={() => action(async () => setDetail(await request(`/${item.id}`)))}>Xem mã TikZ</button>
          <button className="tool-btn" disabled={busy} onClick={() => action(async () => onOpen(await request(`/${item.id}`)))}>Mở để sửa</button>
          <button className="tool-btn" disabled={busy || saving} onClick={() => {
            const name = window.prompt('Tên hình mới', item.title);
            if (name?.trim()) action(async () => { const row = await request(`/${item.id}`, 'PATCH', { title: name.trim() }); setItems(previous => previous.map(old => old.id === row.id ? row : old)); });
          }}>Đổi tên</button>
          <button className="tool-btn" disabled={busy || saving} onClick={() => {
            if (window.confirm(`Xóa “${item.title}” khỏi thư viện? Link ảnh Cloudinary vẫn được giữ.`)) action(async () => { await request(`/${item.id}`, 'DELETE'); setItems(previous => previous.filter(old => old.id !== item.id)); if (detail?.id === item.id) setDetail(null); });
          }}>Xóa khỏi thư viện</button>
        </div>
      </article>)}</div>
      {more && <button className="btn btn-secondary" disabled={busy || saving} onClick={() => load(true)}>Tải thêm</button>}
      {detail && <div className="tikz-library-detail">
        <h3>{detail.title}</h3>
        <textarea aria-label="Mã TikZ đã lưu" className="tikz-textarea" readOnly value={detail.source} />
        <div className="tikz-library-toolbar">
          <button className="tool-btn" onClick={() => copy(detail.source)}>Sao chép mã</button>
          <button className="tool-btn" onClick={() => downloadTikz(detail.source, detail.title)}>Tải TEX</button>
          <button className="tool-btn" onClick={() => setDetail(null)}>Đóng mã</button>
        </div>
      </div>}
    </>}
    {error && <div className="alert alert-error" role="alert">{error}</div>}
  </section>;
}
