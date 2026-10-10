import io
import json
import unittest
from openpyxl import Workbook
from backend.services.teacher_quiz import parse_answer_file


class TestAnswerFileParser(unittest.TestCase):
    def test_parse_tnmaker_excel(self):
        wb = Workbook()
        ws = wb.active
        ws.title = 'Dữ liệu'
        ws.append(['Câu\\Mã đề', '0101', '0102'])
        ws.append([1, 'A', 'B'])
        ws.append([2, 'C', 'D'])
        ws.append([3, 'B', 'A'])
        
        bio = io.BytesIO()
        wb.save(bio)
        data = bio.getvalue()
        
        result = parse_answer_file(data, 'Dap_an_TNMaker_2025.xlsx')
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]['code'], '0101')
        self.assertEqual(result[0]['answers'], ['A', 'C', 'B'])
        self.assertEqual(result[1]['code'], '0102')
        self.assertEqual(result[1]['answers'], ['B', 'D', 'A'])

    def test_parse_word_shuffle_json(self):
        raw = {
            "0101": {
                "I": [
                    {"cau_moi": 1, "dap_an": "A"},
                    {"cau_moi": 2, "dap_an": "B"}
                ]
            },
            "0102": {
                "I": [
                    {"cau_moi": 1, "dap_an": "C"},
                    {"cau_moi": 2, "dap_an": "D"}
                ]
            }
        }
        data = json.dumps(raw).encode('utf-8')
        result = parse_answer_file(data, 'Doi_chieu_cau_goc.json')
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]['code'], '0101')
        self.assertEqual(result[0]['answers'], ['A', 'B'])
        self.assertEqual(result[1]['code'], '0102')
        self.assertEqual(result[1]['answers'], ['C', 'D'])

    def test_parse_simple_json_dict(self):
        raw = {
            "title": "Đề thi giữa kỳ",
            "answers": ["A", "B", "C", "D", "A"]
        }
        data = json.dumps(raw).encode('utf-8')
        result = parse_answer_file(data, 'exam.json')
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['answers'], ["A", "B", "C", "D", "A"])


if __name__ == '__main__':
    unittest.main()
