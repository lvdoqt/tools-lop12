const API_BASE = (import.meta.env?.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

async function checked(response) {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(typeof data.detail === 'string' ? data.detail : `Yêu cầu thất bại (${response.status}).`);
  }
  return response;
}

export async function parseLatex(source, title, difficulty, signal) {
  return (await checked(await fetch(`${API_BASE}/latex-to-json/parse`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, title, difficulty }), signal,
  }))).json();
}

export async function getUploadConfig(signal) {
  return (await checked(await fetch(`${API_BASE}/latex-to-json/config`, { signal }))).json();
}

export async function uploadSignedSvg(svg, signal) {
  const result = await (await checked(await fetch(`${API_BASE}/latex-to-json/upload-svg`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ svg }), signal,
  }))).json();
  if (typeof result.url !== 'string' || !result.url.startsWith('https://')) throw new Error('Chưa có link HTTPS từ Cloudinary.');
  return result.url;
}

export async function compatSvg(source, signal) {
  return (await checked(await fetch(`${API_BASE}/latex-to-json/compat-svg`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source }), signal,
  }))).text();
}

function asDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Không đọc được font SVG.'));
    reader.readAsDataURL(blob);
  });
}

export async function standaloneSvg(raw, signal) {
  // Parse inertly. SVG is only displayed as an image, never injected into the page.
  const parsed = new DOMParser().parseFromString(raw, 'text/html');
  const svg = parsed.querySelector('svg');
  if (!svg || !svg.querySelector('path, text, circle, rect, line, polygon, use')) throw new Error('TikZJax không tạo được hình SVG.');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.querySelectorAll('script, foreignObject, iframe, style').forEach(node => node.remove());
  for (const node of [svg, ...svg.querySelectorAll('*')]) {
    for (const attr of [...node.attributes]) {
      if (/^on/i.test(attr.name) || (/(?:^|:)href$/i.test(attr.name) && !attr.value.startsWith('#'))) node.removeAttribute(attr.name);
    }
  }
  // SVGs in <img> cannot fetch external fonts. Embed each used BaKoMa font.
  const fonts = new Set([...svg.querySelectorAll('[font-family]')].map(node => node.getAttribute('font-family')));
  let css = '';
  for (const font of fonts) {
    if (!/^[a-z][a-z0-9]*$/i.test(font)) throw new Error('Font TikZ không hợp lệ.');
    const fontSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000);
    const response = await fetch(`${import.meta.env?.BASE_URL || '/'}tikzjax-assets/css/bakoma/ttf/${font}.ttf`, { signal: fontSignal });
    if (!response.ok) throw new Error(`Không tải được font ${font}.`);
    css += `@font-face{font-family:${font};src:url('${await asDataUrl(await response.blob())}') format('truetype');}`;
  }
  if (css) {
    const style = parsed.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = css;
    svg.prepend(style);
  }
  return new XMLSerializer().serializeToString(svg);
}

export function createTikzRenderer() {
  let worker;
  return {
    dispose() { worker?.terminate(); worker = null; },
    render(source, signal) {
      return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(new DOMException('Đã hủy', 'AbortError'));
        worker ||= new Worker(new URL('./tikz.worker.js', import.meta.url), { type: 'module' });
        const finish = (error, value) => {
          clearTimeout(timer);
          signal?.removeEventListener('abort', abort);
          if (error) { this.dispose(); reject(error); }
          else resolve(value);
        };
        const abort = () => finish(new DOMException('Đã hủy', 'AbortError'));
        const timer = setTimeout(() => finish(new Error('TikZJax quá thời gian 60 giây.')), 60_000);
        signal?.addEventListener('abort', abort, { once: true });
        worker.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data.svg);
        worker.onerror = () => finish(new Error('Không khởi động được TikZJax.'));
        worker.postMessage(source);
      });
    },
  };
}

export async function uploadSvg(svg, cloudName, uploadPreset, signal) {
  if (!/^[a-z0-9_-]+$/i.test(cloudName) || !uploadPreset.trim()) throw new Error('Hãy nhập Cloud name và Unsigned upload preset.');
  const form = new FormData();
  form.append('file', new Blob([svg], { type: 'image/svg+xml' }), 'diagram.svg');
  form.append('upload_preset', uploadPreset.trim());
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: form, signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `Cloudinary trả lỗi ${response.status}.`);
  if (typeof data.secure_url !== 'string' || !data.secure_url.startsWith('https://')) throw new Error('Cloudinary chưa trả về link HTTPS.');
  return data.secure_url;
}

export function finalizeQuiz(quiz, diagrams, urls) {
  const replacements = new Map(diagrams.map(diagram => {
    const url = urls[diagram.id];
    if (!url) throw new Error(`Hình ${diagram.id} chưa có link Cloudinary.`);
    const escaped = url.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    return [diagram.token, `<img src="${escaped}" alt="Hình câu ${diagram.question_number}" />`];
  }));
  const replace = value => typeof value === 'string' ? value.replace(/@@tikz-\d+@@/g, token => {
    if (!replacements.has(token)) throw new Error('Còn vị trí hình chưa xử lý.');
    return replacements.get(token);
  }) : value;
  return { ...quiz, questions: quiz.questions.map(question => Object.fromEntries(Object.entries(question).map(([key, value]) => [key, replace(value)]))) };
}
