from io import BytesIO
from zipfile import ZipFile
import unittest
from docx import Document
from backend.services.word_shuffle import Exam, export_shuffle, plain

class EnglishShuffleTests(unittest.TestCase):
    def test_english_exam_parsing_and_export(self):
        content = open('D:/tools/anh- GIUA KI 1 (k12).docx', 'rb').read()
        exam = Exam(content, subject='tieng_anh')
        summary = exam.summary()
        self.assertEqual(summary['total'], 40)
        self.assertEqual(summary['errors'], [])
        self.assertEqual(len(summary['sections']), 7)

        # Check export
        archive_bytes = export_shuffle(content, count=2, start_code='0101', subject='tieng_anh')
        archive = ZipFile(BytesIO(archive_bytes))
        self.assertIn('De_0101.docx', archive.namelist())
        self.assertIn('De_0102.docx', archive.namelist())
        self.assertIn('Dap_an_TNMaker_2025.xlsx', archive.namelist())
        self.assertIn('Doi_chieu_cau_goc.json', archive.namelist())

    def test_group_tags_and_web_settings_override(self):
        doc = Document()
        doc.add_paragraph('TRƯỜNG THPT X')

        # Part 1: <#g0> (Fixed position, no question shuffle, no option shuffle)
        doc.add_paragraph('<#g0>')
        doc.add_paragraph('LISTENING - Section 1')
        doc.add_paragraph('Question 1. Stephen Hawking was born in 1942.')
        p1 = doc.add_paragraph()
        r1 = p1.add_run('A')
        r1.underline = True
        p1.add_run('. TRUE\tB. FALSE')

        # Part 2: <g2> (Floating position, keep question order, shuffle options)
        doc.add_paragraph('<g2> Read the following leaflet:')
        doc.add_paragraph('ACT NOW FOR A CLEANER CAMPUS')
        doc.add_paragraph('Question 2. We must build a greener school.')
        p2 = doc.add_paragraph()
        r2 = p2.add_run('B')
        r2.underline = True
        p2.add_run('. environmental\tA. environment\tC. environmentally\tD. environmentalist')

        # Part 3: <g3> (Floating position, shuffle questions and options)
        doc.add_paragraph('<g3> Read the following passage:')
        doc.add_paragraph('Walt Disney was a pioneer.')
        doc.add_paragraph('Question 3. What was Walt Disney famous for?')
        p3 = doc.add_paragraph()
        r3 = p3.add_run('A')
        r3.underline = True
        p3.add_run('. Animation\tB. Cars\tC. Painting\tD. Music')

        out = BytesIO()
        doc.save(out)
        content = out.getvalue()

        exam = Exam(content, subject='tieng_anh')
        summary = exam.summary()
        self.assertEqual(len(summary['sections']), 3)
        self.assertEqual(summary['sections'][0]['mode'], 0)
        self.assertTrue(summary['sections'][0]['fixed_position'])
        self.assertEqual(summary['sections'][1]['mode'], 2)
        self.assertFalse(summary['sections'][1]['fixed_position'])
        self.assertEqual(summary['sections'][2]['mode'], 3)
        self.assertFalse(summary['sections'][2]['fixed_position'])

        # Verify <#g0>, <g2>, <g3> tags are stripped from headers
        for s in exam.groups:
            header_text = ' '.join(plain([b]) for b in s.header)
            self.assertNotIn('<#g0>', header_text)
            self.assertNotIn('<g2>', header_text)
            self.assertNotIn('<g3>', header_text)

        # Test export with web override: make Part 2 fixed and Mode 1
        web_override = [
            {'index': 1, 'fixed_position': True, 'mode': 0},
            {'index': 2, 'fixed_position': True, 'mode': 1},
            {'index': 3, 'fixed_position': False, 'mode': 3},
        ]
        archive_bytes = export_shuffle(content, count=2, start_code='0101', subject='tieng_anh', group_settings=web_override)
        archive = ZipFile(BytesIO(archive_bytes))
        self.assertIn('De_0101.docx', archive.namelist())

if __name__ == '__main__':
    unittest.main()
