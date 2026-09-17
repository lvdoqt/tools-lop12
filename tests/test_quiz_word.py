from copy import deepcopy
from io import BytesIO
import json
from pathlib import Path
import socket
import unittest
from unittest.mock import patch
from zipfile import ZipFile

from fastapi.testclient import TestClient
from lxml import etree
import olefile

from backend.main import app, WordSettings
from backend.services.quiz_word import validate_quiz, export_quiz
from backend.services.word_math import compile_math, OMML_NS
from backend.services.word_ole import build_equation_ole, MATHTYPE_CLSID
from backend.services.word_images import public_address, download_image, svg_png

SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="30pt" height="15pt" viewBox="0 0 30 15"><path d="M1 1L20 12" stroke="black"/></svg>'
SAMPLE = {'title': 'Đề thử', 'questions': [
    {'type': 'sa', 'question': r'Tính $\sqrt{2}+x_1$.', 'correct_option': '2', 'explanation': 'Giải'},
    {'type': 'mcq', 'question': 'Bảng <table><tr><td>Nhóm</td><td>$[8;10)$</td></tr></table><img src="https://example.com/pic.svg"/>',
     'option_a': r'$\frac{1}{2}$', 'option_b': r'$\vec{n}$', 'option_c': r'$\heva{&x=1\\&y=2}$', 'option_d': '$4$', 'correct_option': 'A', 'explanation': 'Giải'},
    {'type': 'msq', 'question': 'Đúng hay sai?', 'option_a': 'A', 'option_b': 'B', 'option_c': 'C', 'option_d': 'D', 'correct_option': '', 'explanation': 'Tất cả sai.'},
]}


class QuizWordTests(unittest.TestCase):
    def test_schema_errors_and_wrapped_quiz(self):
        for source in ['broken', '{}', '[]', '{"questions":[]}', json.dumps({'questions': [{'type': 'other'}]})]:
            with self.subTest(source=source), self.assertRaises(ValueError): validate_quiz(source)
        summary = validate_quiz(json.dumps({'quiz': SAMPLE}, ensure_ascii=False))['summary']
        self.assertEqual(summary['counts'], {'mcq': 1, 'msq': 1, 'sa': 1})
        self.assertEqual(summary['image_count'], 1)
        self.assertTrue(summary['warnings'])
        for key, value in [('option_a', ''), ('correct_option', 'AB')]:
            data = deepcopy(SAMPLE); data['questions'][1][key] = value
            with self.assertRaises(ValueError): validate_quiz(json.dumps(data))

    def test_invalid_math_and_tables_never_silently_drop_content(self):
        for value in [r'$\unknown{x}$', '$x', '<table><tr><td>A</td></tr><tr><td>A</td><td>B</td></tr></table>', '<img src="file:///secret"/>', '<script>alert(1)</script>']:
            data = deepcopy(SAMPLE); data['questions'][0]['question'] = value
            with self.subTest(value=value), self.assertRaises(ValueError): validate_quiz(json.dumps(data))

    def test_native_math_structures(self):
        formula = compile_math(r'\sqrt{2}+\frac{x_1^2}{3}+\vec{n}+\heva{&x=1\\&y=2}')
        root = formula['omml']
        for name in ('rad', 'f', 'sSubSup', 'acc', 'd', 'm'):
            self.assertTrue(root.findall(f'.//{{{OMML_NS}}}{name}'), name)
        with olefile.OleFileIO(formula['ole']) as ole:
            self.assertTrue(ole.exists('Equation Native'))
            self.assertIn(b'DSMT4', ole.openstream('Equation Native').read())

    def test_display_environments_in_solutions_are_equations(self):
        for environment in ('equation', 'equation*', 'align*', 'eqnarray*', 'gather', 'multline*'):
            with self.subTest(environment=environment):
                data = deepcopy(SAMPLE)
                data['questions'][0]['explanation'] = (
                    r'\allowdisplaybreaks' + '\n' + r'\begin{' + environment + '}'
                    + (r'x &= 1 \\ y &= 2' if environment.startswith(('align', 'eqnarray')) else 'x=1')
                    + r'\end{' + environment + '}'
                )
                prepared = validate_quiz(json.dumps(data), True)
                tree = prepared['trees'][0]['explanation']
                self.assertEqual(len(list(tree.iter('quiz-math'))), 1)
                self.assertNotIn('\\', ''.join(tree.itertext()))

    def test_mathtype_unicode_has_an_explicit_math_font(self):
        formula = compile_math(r'\mathbb{R}+x_1+x^2+\sqrt{2}+4')
        with olefile.OleFileIO(formula['ole']) as ole:
            native = ole.openstream('Equation Native').read()[28:]
        self.assertIn(b'Cambria Math\0', native)
        # MTEF CHAR: 16-bit font position + USER2 (Cambria Math), MTCode,
        # Unicode position. Falling back to an ANSI variable font loses ℝ.
        self.assertIn(b'\x02\x10\x8a\x1d\x21\x1d\x21', native)

    def test_zip_embeds_editable_math_and_images_without_answer_leaks(self):
        source = json.dumps(SAMPLE, ensure_ascii=False)
        prepared = validate_quiz(source)
        previews = {f['id']: {'svg': SVG, 'width': 30, 'height': 15, 'baseline': 2} for f in prepared['formulas'].values()}
        settings = WordSettings(include_answers=False).model_dump()
        with patch('backend.services.quiz_word.load_images', return_value={'https://example.com/pic.svg': svg_png(SVG.encode())}):
            content = export_quiz(source, settings, previews)
        with ZipFile(BytesIO(content)) as archive:
            self.assertEqual(set(archive.namelist()), {'De-Toan-Equation.docx', 'De-Toan-MathType.docx'})
            for name in archive.namelist():
                with ZipFile(BytesIO(archive.read(name))) as doc:
                    root = etree.fromstring(doc.read('word/document.xml'))
                    text = ''.join(root.itertext())
                    self.assertLess(text.index('PHẦN I.'), text.index('PHẦN III.'))
                    self.assertNotIn('Tất cả sai', text)
                    self.assertNotIn('ĐÁP ÁN VÀ', text)
                    self.assertNotIn('\\frac', text)
                    self.assertTrue(any(n.startswith('word/media/') for n in doc.namelist()))
                    self.assertNotIn(b'TargetMode="External"', doc.read('word/_rels/document.xml.rels'))
                    if 'MathType' in name:
                        self.assertIn(b'Equation.DSMT4', doc.read('word/document.xml'))
                        for entry in doc.namelist():
                            if entry.startswith('word/embeddings/'):
                                with olefile.OleFileIO(doc.read(entry)) as ole: self.assertTrue(ole.exists('Equation Native'))
                    else:
                        self.assertTrue(root.findall(f'.//{{{OMML_NS}}}oMath'))

    def test_answer_option_and_api_errors(self):
        data = deepcopy(SAMPLE); del data['questions'][0]['correct_option']
        validate_quiz(json.dumps(data))
        with self.assertRaises(ValueError): validate_quiz(json.dumps(data), True)
        client = TestClient(app)
        response = client.post('/api/json-to-word/validate', json={'source': json.dumps(SAMPLE)})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['total'], 3)
        self.assertEqual(response.headers['cache-control'], 'no-store')
        self.assertEqual(client.post('/api/json-to-word/validate', json={'source': 'invalid'}).status_code, 400)
        self.assertEqual(client.post('/api/json-to-word/export', json={'source': json.dumps(SAMPLE)}).status_code, 400)

    def test_default_export_repeats_questions_before_each_solution(self):
        data = deepcopy(SAMPLE)
        data['questions'][0]['correct_option'] = '$2$'
        data['questions'][0]['explanation'] = r'SOLUTION-SA $\frac{4}{2}=2$'
        data['questions'][1]['explanation'] = 'SOLUTION-MCQ'
        data['questions'][2]['explanation'] = 'SOLUTION-MSQ'
        source = json.dumps(data, ensure_ascii=False)
        settings = WordSettings().model_dump()
        self.assertTrue(settings['include_answers'])
        prepared = validate_quiz(source, True)
        previews = {f['id']: {'svg': SVG, 'width': 30, 'height': 15, 'baseline': 2} for f in prepared['formulas'].values()}
        with patch('backend.services.quiz_word.load_images', return_value={'https://example.com/pic.svg': svg_png(SVG.encode())}):
            content = export_quiz(source, settings, previews)
        with ZipFile(BytesIO(content)) as archive:
            for filename in archive.namelist():
                with self.subTest(filename=filename), ZipFile(BytesIO(archive.read(filename))) as doc:
                    root = etree.fromstring(doc.read('word/document.xml'))
                    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
                          'o': 'urn:schemas-microsoft-com:office:office',
                          'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
                    text = ''.join(root.itertext())
                    exam, solutions = text.split('PHẦN 2. LỜI GIẢI CHI TIẾT')
                    self.assertIn('PHẦN 1. ĐỀ THI', exam)
                    self.assertNotIn('SOLUTION-', exam)
                    self.assertNotIn('Đáp án:', exam)
                    self.assertEqual(exam.count('Câu 1.'), 3)
                    self.assertEqual(solutions.count('Câu 1.'), 3)
                    self.assertEqual(solutions.count('Lời giải'), 3)
                    self.assertLess(solutions.index('Bảng'), solutions.index('SOLUTION-MCQ'))
                    self.assertLess(solutions.index('SOLUTION-MCQ'), solutions.index('Đúng hay sai?'))
                    self.assertLess(solutions.index('Đúng hay sai?'), solutions.index('SOLUTION-MSQ'))
                    self.assertLess(solutions.index('SOLUTION-MSQ'), solutions.index('Tính'))
                    self.assertLess(solutions.index('Tính'), solutions.index('SOLUTION-SA'))
                    self.assertIn('a) Sai; b) Sai; c) Sai; d) Sai', solutions)
                    self.assertTrue(root.xpath('//w:br[@w:type="page"]', namespaces=ns))
                    objects = root.xpath('//o:OLEObject', namespaces=ns)
                    if 'MathType' in filename:
                        self.assertGreater(len(objects), len(prepared['formulas']))
                        self.assertEqual(len(objects), len({obj.get('{%s}id' % ns['r']) for obj in objects}))
                        self.assertFalse(root.xpath('//w:instrText[contains(., "EMBED")]', namespaces=ns))
                    else:
                        self.assertFalse(objects)
                        self.assertTrue(root.findall(f'.//{{{OMML_NS}}}oMath'))

    def test_equation_storage_small_and_large_streams(self):
        # Exercise both mini-stream storage and regular FAT storage, including
        # more than one FAT sector. The old writer truncated streams >= 4096.
        for size in (50, 4067, 4068, 100_000):
            payload = bytes(range(256)) * (size // 256) + bytes(range(size % 256))
            with self.subTest(size=size), olefile.OleFileIO(build_equation_ole(payload)) as ole:
                self.assertEqual(ole.root.clsid.lower(), str(MATHTYPE_CLSID))
                self.assertEqual(ole.openstream('Equation Native').read()[28:], payload)
                self.assertIn(b'Equation.DSMT4', ole.openstream('\x01CompObj').read())
                self.assertEqual(ole.root.sid_child, 2)
                self.assertEqual(ole.direntries[2].sid_left, 1)
                self.assertEqual(ole.direntries[2].sid_right, 3)
                self.assertEqual(ole.direntries[4].color, 0)

    def test_network_and_svg_restrictions(self):
        with patch('socket.getaddrinfo', return_value=[(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('127.0.0.1', 443))]):
            with self.assertRaises(ValueError): public_address('example.com')
        for url in ['http://example.com/a.png', 'file:///etc/passwd', 'https://user:pass@example.com/a']:
            with self.subTest(url=url), self.assertRaises(ValueError): download_image(url)
        for payload in [b'<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com"/></svg>', b'<!DOCTYPE svg [<!ENTITY x "oops">]><svg>&x;</svg>']:
            with self.assertRaises(ValueError): svg_png(payload)

    @unittest.skipUnless(Path('quiz-bank.json').exists(), 'Local exam fixture')
    def test_user_quiz_with_solutions(self):
        prepared = validate_quiz(Path('quiz-bank.json').read_text(encoding='utf-8'), True)
        self.assertEqual(prepared['summary']['counts'], {'mcq': 12, 'msq': 4, 'sa': 6})
        self.assertEqual(prepared['summary']['image_count'], 13)
        self.assertTrue(prepared['summary']['standard'])


if __name__ == '__main__': unittest.main()
