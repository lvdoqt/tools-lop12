import assert from 'node:assert/strict';
import { test } from 'node:test';
import { finalizeQuiz, uploadSvg, parseLatex } from '../frontend/src/lib/quizConversion.js';

test('image links replace only tokens in the corresponding question fields', () => {
  const quiz = { title: 'Toán 12', questions: [{ question: 'Trước @@tikz-1@@ sau', option_a: '$x^2$', explanation: '@@tikz-2@@', is_dynamic: false }] };
  const diagrams = [1, 2].map(i => ({ id: `tikz-${i}`, token: `@@tikz-${i}@@`, question_number: 1 }));
  const result = finalizeQuiz(quiz, diagrams, { 'tikz-1': 'https://res.cloudinary.com/a.svg', 'tikz-2': 'https://res.cloudinary.com/b.svg?a=1&b=2' });
  assert.match(result.questions[0].question, /^Trước <img src="https:\/\/res.cloudinary.com\/a.svg" alt="Hình câu 1" \/> sau$/);
  assert.match(result.questions[0].explanation, /&amp;b=2/);
  assert.equal(result.questions[0].option_a, '$x^2$');
  assert.equal(result.questions[0].is_dynamic, false);
  assert.match(quiz.questions[0].question, /@@tikz-1@@/);
  assert.throws(() => finalizeQuiz(quiz, diagrams, {}), /chưa có link/);
});

test('upload sends SVG bytes and unsigned preset and uses secure_url', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.cloudinary.com/v1_1/my-cloud/image/upload');
    assert.equal(options.body.get('upload_preset'), 'quiz');
    assert.equal(await options.body.get('file').text(), '<svg/>');
    assert.equal(options.body.get('file').type, 'image/svg+xml');
    return Response.json({ secure_url: 'https://res.cloudinary.com/my-cloud/test.svg' });
  });
  assert.equal(await uploadSvg('<svg/>', 'my-cloud', 'quiz'), 'https://res.cloudinary.com/my-cloud/test.svg');
});

test('upload errors and invalid Cloudinary settings do not fabricate links', async t => {
  const request = t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { message: 'Invalid upload preset' } }, { status: 400 }));
  await assert.rejects(uploadSvg('<svg/>', 'a/b', 'preset'), /Cloud name/);
  assert.equal(request.mock.callCount(), 0);
  await assert.rejects(uploadSvg('<svg/>', 'cloud', 'preset'), /Invalid upload preset/);
  request.mock.mockImplementation(async () => Response.json({ url: 'http://example.com/image.svg' }));
  await assert.rejects(uploadSvg('<svg/>', 'cloud', 'preset'), /HTTPS/);
});

test('parse errors preserve the question-specific backend message', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ detail: 'Câu 5: thiếu đáp án' }, { status: 400 }));
  await assert.rejects(parseLatex('tex', 'Toán 12', 'easy'), /Câu 5/);
});
