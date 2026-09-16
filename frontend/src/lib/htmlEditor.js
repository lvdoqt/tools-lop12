import DOMPurify from 'dompurify';
import renderMathInElement from 'katex/contrib/auto-render';
import katexStyles from 'katex/dist/katex.min.css?inline';

export const SAMPLE_HTML = String.raw`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bài học của tôi</title>
  <style>
    body { font-family: Georgia, serif; color: #29332e; line-height: 1.8; padding: 28px; max-width: 760px; margin: auto; }
    h1 { color: #9b600e; line-height: 1.3; }
    h2 { font-size: 1.25rem; }
    .badge { color: #98600f; background: #fff3d6; padding: 6px 12px; border-radius: 20px; font: 12px sans-serif; }
    blockquote { border-left: 3px solid #d5a449; margin: 24px 0; padding: 12px 20px; background: #fffaf0; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ded9ce; padding: 10px; text-align: left; }
    th { background: #faf7ef; }
  </style>
</head>
<body>
  <span class="badge">GÓC HỌC TẬP · TOÁN HỌC</span>
  <h1>Một bài học, theo cách của bạn.</h1>
  <p>Thử sửa <strong>văn bản này</strong>, thêm hình ảnh hoặc viết công thức LaTeX. Kết quả sẽ xuất hiện ngay bên phải.</p>
  <h2>01. Phương trình bậc hai</h2>
  <p>Với $ax^2 + bx + c = 0$ và $a \ne 0$, ta có:</p>
  <p>$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$</p>
  <blockquote>Mẹo: chọn một đoạn văn bản rồi dùng thanh công cụ để định dạng.</blockquote>
  <h2>02. Ghi chú nhanh</h2>
  <table>
    <thead><tr><th>Biệt thức</th><th>Số nghiệm thực</th></tr></thead>
    <tbody>
      <tr><td>$\Delta > 0$</td><td>Hai nghiệm phân biệt</td></tr>
      <tr><td>$\Delta = 0$</td><td>Một nghiệm kép</td></tr>
      <tr><td>$\Delta < 0$</td><td>Không có nghiệm thực</td></tr>
    </tbody>
  </table>
</body>
</html>`;

export const escapeHtml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function sanitizeHtml(html, wholeDocument = false) {
  return DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: wholeDocument,
    ADD_TAGS: ['link'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'base', 'meta', 'form'],
    FORBID_ATTR: ['srcdoc', 'autofocus', 'contenteditable'],
  });
}

export function buildHtmlDocument(source, renderMath = false) {
  const doc = new DOMParser().parseFromString(sanitizeHtml(source, true), 'text/html');
  doc.querySelectorAll('link').forEach(link => {
    if (link.getAttribute('rel')?.toLowerCase() !== 'stylesheet') link.remove();
  });
  const defaults = doc.createElement('style');
  defaults.textContent = 'html { color-scheme: light; } body { overflow-wrap: break-word; } img { max-width: 100%; } body:empty::before { content: "Nội dung của bạn sẽ xuất hiện tại đây…"; color: #9a9488; font: 15px sans-serif; }';
  doc.head.prepend(defaults);
  const charset = doc.createElement('meta');
  charset.setAttribute('charset', 'UTF-8');
  doc.head.prepend(charset);
  // Frames grant the parent DOM access but never allow script execution.
  const policy = doc.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline' https: http:; img-src https: http: data: blob:; font-src https: http: data:; media-src https: http: data: blob:; base-uri 'none'; form-action 'none'";
  doc.head.prepend(policy);
  let mathErrors = 0;
  if (renderMath) {
    const mathStyle = doc.createElement('style');
    // srcdoc inherits the app URL; absolute URLs also work for nested routes.
    mathStyle.textContent = katexStyles.replace(/url\((['"]?)(\/[^)'"\s]+)\1\)/g, (_, quote, url) => `url("${window.location.origin}${url}")`);
    doc.head.append(mathStyle);
    renderMathInElement(doc.body, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
        { left: '$', right: '$', display: false },
      ],
      trust: false,
      strict: false,
      maxExpand: 500,
      maxSize: 20,
      errorCallback: () => { mathErrors += 1; },
    });
  }
  return { html: '<!DOCTYPE html>\n' + doc.documentElement.outerHTML, mathErrors };
}

export function replaceDocumentBody(source, body) {
  if (!/<(?:!doctype|html|head|body)(?:\s|>)/i.test(source)) return body;
  const doc = new DOMParser().parseFromString(source, 'text/html');
  doc.body.innerHTML = body;
  const doctype = doc.doctype ? new XMLSerializer().serializeToString(doc.doctype) + '\n' : '';
  return doctype + doc.documentElement.outerHTML;
}
