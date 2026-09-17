const API_BASE = (import.meta.env?.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

async function post(path, payload, signal) {
  const body = JSON.stringify(payload);
  if (new Blob([body]).size > 4 * 1024 * 1024) throw new Error('Dữ liệu xuất vượt quá 4 MB. Hãy giảm số câu mỗi lần xuất.');
  const response = await fetch(`${API_BASE}/json-to-word/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(typeof data.detail === 'string' ? data.detail : `Không xử lý được yêu cầu (${response.status}). Kiểm tra thông tin đề và thử lại.`);
  }
  return response;
}

export async function validateWord(source, settings, signal) {
  return (await post('validate', { source, settings }, signal)).json();
}

export async function exportWord(source, settings, previews, signal) {
  return (await post('export', { source, settings, previews }, signal)).blob();
}

export function renderWordMath(formulas, signal, progress) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./wordMath.worker.js', import.meta.url), { type: 'module' });
    const stop = () => { worker.terminate(); signal.removeEventListener('abort', abort); };
    const abort = () => { stop(); reject(new DOMException('Đã hủy', 'AbortError')); };
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }) => {
      if (data.error) { stop(); reject(new Error(data.error)); }
      else if (data.previews) { stop(); resolve(data.previews); }
      else progress(`Đang dựng công thức ${data.progress}/${data.total}…`);
    };
    worker.onerror = () => { stop(); reject(new Error('Không tải được bộ chuyển công thức. Hãy tải lại trang.')); };
    worker.postMessage(formulas);
  });
}
