from io import BytesIO
from zipfile import ZipFile
import unittest
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

if __name__ == '__main__':
    unittest.main()

