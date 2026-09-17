import assert from 'node:assert/strict';
import { test } from 'node:test';
import { api, MAX_PDF_BYTES, releaseResult, validatePdfFiles } from '../frontend/src/api.js';

const originalFetch = globalThis.fetch;

test('PDF validation applies the combined limit before uploading', () => {
  const file = size => ({ name: 'test.pdf', size });
  assert.doesNotThrow(() => validatePdfFiles([file(MAX_PDF_BYTES)]));
  assert.throws(() => validatePdfFiles([file(MAX_PDF_BYTES), file(1)]), /4 MB/);
  assert.throws(() => validatePdfFiles([file(0)]));
  assert.throws(() => validatePdfFiles(Array.from({ length: 31 }, () => file(1))));
});

test('PDF response becomes a usable browser download with metadata', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/pdf-tools/split-ranges');
    assert.equal(options.body.get('ranges'), '[{"start":1,"end":2}]');
    return new Response('%PDF-result', { headers: {
      'Content-Type': 'application/pdf', 'X-PDF-Pages': '2', 'X-PDF-Files': '1',
    } });
  });
  const result = await api.pdfTool('split', [new File(['pdf'], 'input.pdf')], 180, [{ start: 1, end: 2 }]);
  assert.equal(result.pages, 2);
  assert.equal(result.filename, 'pdf-output.pdf');
  assert.equal(await (await originalFetch(result.download_url)).text(), '%PDF-result');
  releaseResult(result);
  await assert.rejects(originalFetch(result.download_url));
});

test('TikZ previews and downloads preserve binary and UTF-8 content', async t => {
  const content = { png: Buffer.from([137, 80, 78, 71]), pdf: Buffer.from('%PDF-test'), tex: Buffer.from('Tiếng Việt'), svg: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><text>Tiếng Việt</text></svg>') };
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, '/api/tikz/render');
    return Response.json({ output_id: 'test', assets: Object.fromEntries(Object.entries(content).map(([key, value]) => [key, value.toString('base64')])) });
  });
  const result = await api.renderTikz('test');
  assert.equal(result.preview_url, result.downloads.png);
  assert.equal(result.pdf_preview_url, result.downloads.pdf);
  for (const format of Object.keys(content)) {
    assert.deepEqual(Buffer.from(await (await originalFetch(result.downloads[format])).arrayBuffer()), content[format]);
  }
  releaseResult(result);
});

test('oversized uploads never call fetch', async t => {
  const request = t.mock.method(globalThis, 'fetch', () => { throw new Error('Must not upload'); });
  await assert.rejects(api.getPdfToolInfo({ name: 'large.pdf', size: MAX_PDF_BYTES + 1 }), /4 MB/);
  assert.equal(request.mock.callCount(), 0);
});

test('platform payload errors and backend errors are readable', async t => {
  const request = t.mock.method(globalThis, 'fetch', async () => new Response('FUNCTION_PAYLOAD_TOO_LARGE', { status: 413 }));
  await assert.rejects(api.renderTikz('test'), /giới hạn/);
  request.mock.mockImplementation(async () => Response.json({ detail: 'Giảm DPI' }, { status: 413 }));
  await assert.rejects(api.renderTikz('test'), /Giảm DPI/);
});
