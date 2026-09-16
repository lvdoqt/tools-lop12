from pathlib import Path
import unittest
from unittest.mock import patch
from unittest.mock import Mock
from io import BytesIO
from html import unescape
import tarfile

from fastapi.testclient import TestClient
from backend.main import app
from backend.services.latex_quiz import expand_system_macros, parse_quiz
from backend.services.quiz_svg import render_compat_svg
import pymupdf


MCQ = r"""\begin{ex}
    Tiếng Việt: đạo hàm của $x^{2}$? % ignore \choice and braces {
    \choice[4]{$x$}{\True $2x$}{$\frac{1}{x}$}{$\heva{&x=1\\&y=2}$}
    \loigiai{Lời giải $\frac{d}{dx}x^2=2x$.}
\end{ex}"""
TIKZ = r"\begin{tikzpicture}\draw (0,0)--(1,1);\end{tikzpicture}"


class LatexQuizTests(unittest.TestCase):
    def test_math_unicode_comments_and_nested_braces(self):
        question = parse_quiz(MCQ)['quiz']['questions'][0]
        self.assertEqual(question['correct_option'], 'B')
        self.assertEqual(question['option_c'], r'$\frac{1}{x}$')
        self.assertEqual(question['option_d'], r'$\left\{\begin{aligned}&x=1\\&y=2\end{aligned}\right.$')
        self.assertIn('Tiếng Việt', question['question'])
        self.assertNotIn('ignore', question['question'])
        self.assertFalse(question['is_dynamic'])

    def test_all_types_and_decimal_answer(self):
        source = MCQ + r"""\begin{ex}Đúng sai?
        \choiceTF{\True A}{B}{\True C}{D}\loigiai{Giải}
        \end{ex}\begin{ex}Tính diện tích.
        \shortans[oly]{$26{,}9$}\loigiai{Giải}\end{ex}"""
        result = parse_quiz(source, 'Đề kiểm tra', 'hard')['quiz']
        self.assertEqual(result['title'], 'Đề kiểm tra')
        self.assertEqual([q['type'] for q in result['questions']], ['mcq', 'msq', 'sa'])
        self.assertEqual([q['correct_option'] for q in result['questions']], ['B', 'A,C', '26,9'])
        self.assertNotIn('option_a', result['questions'][2])
        self.assertTrue(all(q['difficulty_level'] == 'hard' for q in result['questions']))

    def test_immini_and_diagrams_in_options_and_solution(self):
        source = r'\begin{ex}\immini{Câu hỏi\choice{\True A}{B}{C}{' + TIKZ + '}}{' + TIKZ + r'}\loigiai{' + TIKZ + r'}\end{ex}'
        result = parse_quiz(source)
        question = result['quiz']['questions'][0]
        self.assertEqual(len(result['diagrams']), 3)
        self.assertIn(result['diagrams'][0]['token'], question['question'])
        self.assertIn(result['diagrams'][1]['token'], question['option_d'])
        self.assertIn(result['diagrams'][2]['token'], question['explanation'])
        self.assertNotIn(r'\immini', str(question))

    def test_tables_become_html_and_escaped_percent_survives(self):
        source = r'\begin{ex}Tỉ lệ 10\%.\begin{tabular}{|c|c|}\hline Điểm & $[0;2)$\\\hline Số & $3$\\\hline\end{tabular}\shortans{3}\end{ex}'
        result = parse_quiz(source)
        table = result['quiz']['questions'][0]['question']
        self.assertIn('<table border="1" style="border-collapse: collapse; border: 1px solid #000;">', table)
        self.assertEqual(table.count('<td style="border: 1px solid #000; padding: 6px 10px;">'), 4)
        self.assertIn('>Điểm</td>', table)
        self.assertIn(r'10\%', result['quiz']['questions'][0]['question'])
        self.assertEqual(len(result['warnings']), 1)

    def test_system_macros_expand_in_question_options_and_solution(self):
        source = r'''\newcommand{\hoac}[1]{\left[\begin{aligned}#1\end{aligned}\right.}
        \newcommand{\heva}[1]{\left\{\begin{aligned}#1\end{aligned}\right.}
        \begin{ex}Giải $\hoac{&x=\frac{1}{2}\\&x=-1}$.
        \choice{\True $\heva{&x=1\\&y=2}$}{$2$}{$3$}{$4$}
        \loigiai{Ta có \[\heva{&x=1\\&\hoac{&y=2\\&y=3}}\].}
        \end{ex}'''
        q = parse_quiz(source)['quiz']['questions'][0]
        self.assertIn(r'$\left[\begin{aligned}&x=\frac{1}{2}\\&x=-1\end{aligned}\right.$', q['question'])
        self.assertEqual(q['option_a'], r'$\left\{\begin{aligned}&x=1\\&y=2\end{aligned}\right.$')
        self.assertIn(r'\[\left\{\begin{aligned}&x=1\\&\left[\begin{aligned}&y=2\\&y=3\end{aligned}\right.\end{aligned}\right.\]', q['explanation'])
        self.assertNotIn(r'\newcommand', str(q))
        self.assertNotIn(r'\hoac', str(q))
        self.assertNotIn(r'\heva', str(q))

    def test_system_macro_names_escapes_and_missing_arguments(self):
        self.assertEqual(expand_system_macros(r'\hoacother{a} \\heva{b}'), r'\hoacother{a} \\heva{b}')
        self.assertEqual(expand_system_macros('\\heva \n {x^{2}=1}'), r'\left\{\begin{aligned}x^{2}=1\end{aligned}\right.')
        with self.assertRaisesRegex(ValueError, 'Câu 1:'):
            parse_quiz(r'\begin{ex}$\heva$\shortans{1}\end{ex}')

    def test_table_math_separators_do_not_create_extra_cells_or_rows(self):
        source = r'''\begin{ex}Bảng:
        \begin{tabular}{|c|c|}\hline
        Điều kiện & Giá trị\\[2pt]\hline
        $\heva{&x=\frac{1}{2}\\&y<2}$ & $\hoac{&a=1\\&a=2}$\\\hline
        Nhãn \& chữ & <script>alert(1)</script>\\\hline
        \end{tabular}\shortans{1}\end{ex}'''
        table = parse_quiz(source)['quiz']['questions'][0]['question']
        self.assertEqual(table.count('<tr>'), 3)
        self.assertEqual(table.count('<td '), 6)
        self.assertEqual(table.count('border: 1px solid #000;'), 7)
        self.assertNotIn('[2pt]', table)
        self.assertNotIn('<script>', table)
        self.assertIn('&lt;script&gt;', table)
        self.assertIn(r'$\left\{\begin{aligned}&x=\frac{1}{2}\\&y<2\end{aligned}\right.$', unescape(table))
        self.assertIn(r'$\left[\begin{aligned}&a=1\\&a=2\end{aligned}\right.$', unescape(table))

    def test_tables_in_options_and_explanations_have_borders(self):
        table = r'\begin{tabular}{cc}A&B\\1&2\end{tabular}'
        source = r'\begin{ex}Chọn bảng\choice{\True ' + table + r'}{B}{C}{D}\loigiai{' + table + r'}\end{ex}'
        q = parse_quiz(source)['quiz']['questions'][0]
        for field in ['option_a', 'explanation']:
            self.assertEqual(q[field].count('border: 1px solid #000;'), 5)

    def test_invalid_input_never_silently_drops_questions(self):
        for source in ['', MCQ.replace(r'\True', ''), MCQ.replace(r'{$x$}', r'{\True $x$}'), MCQ.replace(r'\end{ex}', ''), MCQ.replace(r'\loigiai{', r'\loigiai{{'), MCQ + r'\begin{ex}Không có đáp án\end{ex}']:
            with self.subTest(source=source):
                with self.assertRaises(ValueError):
                    parse_quiz(source)

    def test_false_statements_can_all_be_false(self):
        q = parse_quiz(r'\begin{ex}Câu hỏi\choiceTF{A}{B}{C}{D}\end{ex}')['quiz']['questions'][0]
        self.assertEqual(q['type'], 'msq')
        self.assertEqual(q['correct_option'], '')

    def test_parse_api_and_validation(self):
        client = TestClient(app)
        response = client.post('/api/latex-to-json/parse', json={'source': MCQ})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['quiz']['questions'][0]['option_d'], r'$\left\{\begin{aligned}&x=1\\&y=2\end{aligned}\right.$')
        self.assertEqual(response.headers['cache-control'], 'no-store')
        self.assertEqual(client.post('/api/latex-to-json/parse', json={'source': 'broken'}).status_code, 400)
        self.assertEqual(client.post('/api/latex-to-json/parse', json={'source': MCQ, 'difficulty': 'invalid'}).status_code, 422)

    def test_compat_svg_api_reports_errors(self):
        client = TestClient(app)
        with patch('backend.main.render_compat_svg', return_value='<svg/>'):
            response = client.post('/api/latex-to-json/compat-svg', json={'source': TIKZ})
            self.assertEqual(response.text, '<svg/>')
            self.assertIn('image/svg+xml', response.headers['content-type'])
        with patch('backend.main.render_compat_svg', side_effect=RuntimeError('service unavailable')):
            self.assertEqual(client.post('/api/latex-to-json/compat-svg', json={'source': TIKZ}).status_code, 502)

    def test_long_diagram_uses_tar_upload_instead_of_oversized_url(self):
        source = TIKZ + '\n' + '% explanation\n' * 1000
        with pymupdf.open() as document:
            document.new_page().insert_text((20, 20), 'SVG')
            response = Mock(status_code=200, content=document.tobytes())
        with patch('backend.services.quiz_svg.requests.post', return_value=response) as post:
            svg = render_compat_svg(source)
        self.assertIn('<svg', svg)
        self.assertEqual(post.call_args.args[0], 'https://latexonline.cc/data')
        self.assertEqual(post.call_args.kwargs['params']['target'], 'diagram.tex')
        with tarfile.open(fileobj=BytesIO(post.call_args.kwargs['files']['file'][1]), mode='r:gz') as archive:
            self.assertEqual(archive.getnames(), ['diagram.tex'])
            self.assertIn(source, archive.extractfile('diagram.tex').read().decode('utf-8'))

    @unittest.skipUnless(Path('T.Do.tex').exists(), 'User exam is not distributed with the repository')
    def test_user_exam(self):
        result = parse_quiz(Path('T.Do.tex').read_text(encoding='utf-8'))
        self.assertEqual(len(result['quiz']['questions']), 22)
        self.assertEqual(len(result['diagrams']), 13)
        self.assertEqual([q['type'] for q in result['quiz']['questions']], ['mcq'] * 12 + ['msq'] * 4 + ['sa'] * 6)
        self.assertEqual(result['quiz']['questions'][-1]['correct_option'], '26,9')


if __name__ == '__main__':
    unittest.main()
