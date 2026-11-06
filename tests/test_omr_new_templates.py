"""
Unit tests for the 3 new answer sheet templates in D:\\tools\\phieu-cham:
1. TNDO-A20 (20 MCQ questions, SBD 6, MDT 3)
2. TNDO-A40 (40 MCQ questions, SBD 6, MDT 3)
3. TNDO-3P-2026 (40 MCQ + 8 True/False + 6 Short Answer, SBD 8, MDT 4)
"""

import unittest
from pathlib import Path
import cv2
import numpy as np

from backend.services.omr_engine_2025 import process_omr_sheet
from backend.services.sheet_templates import get_sheet_template, list_sheet_templates


class TestOMRNewTemplates(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.img_dir = Path("D:/tools/phieu-cham")
        cls.a20_img_path = cls.img_dir / "TNDO-A20-v2.png"
        cls.a40_img_path = cls.img_dir / "TNDO-A40-v2.png"
        cls.p3_img_path = cls.img_dir / "TNDO-3P-2026-v3.png"

    def test_list_templates(self):
        templates = list_sheet_templates()
        ids = [t["id"] for t in templates]
        self.assertIn("2025_standard", ids)
        self.assertIn("tndo_a20", ids)
        self.assertIn("tndo_a40", ids)
        self.assertIn("tndo_3p_2026", ids)

    def test_tndo_a20_clean_and_filled(self):
        self.assertTrue(self.a20_img_path.exists())
        img = cv2.imread(str(self.a20_img_path))
        self.assertIsNotNone(img)

        # 1. Clean image test
        res_clean = process_omr_sheet(img, sheet_type="tndo_a20")
        self.assertTrue(res_clean["success"])
        self.assertEqual(res_clean["sheet_type"], "tndo_a20")
        self.assertEqual(len(res_clean["part1_raw"]), 20)
        self.assertEqual(len(res_clean["part2_raw"]), 0)
        self.assertEqual(len(res_clean["part3_raw"]), 0)
        self.assertEqual(len(res_clean["sbd"]), 6)
        self.assertEqual(len(res_clean["exam_code"]), 3)

        # 2. Fill marks synthetically
        tmpl = get_sheet_template("tndo_a20")
        marked_img = img.copy()

        # Fill SBD: 098765
        sbd_grid = tmpl.get_sbd_grid()
        for col_idx, dig in enumerate([0, 9, 8, 7, 6, 5]):
            for d, x, y, r in sbd_grid[col_idx]:
                if d == dig:
                    cv2.circle(marked_img, (int(x), int(y)), int(r * 0.8), (20, 20, 20), -1)

        # Fill MDT: 201
        mdt_grid = tmpl.get_mdt_grid()
        for col_idx, dig in enumerate([2, 0, 1]):
            for d, x, y, r in mdt_grid[col_idx]:
                if d == dig:
                    cv2.circle(marked_img, (int(x), int(y)), int(r * 0.8), (20, 20, 20), -1)

        # Fill 10 questions: Q1..10
        p1_grid = tmpl.get_part1_grid()
        choices = ["A", "B", "C", "D"]
        for q in range(1, 11):
            opt = choices[(q - 1) % 4]
            x, y, r = p1_grid[q][opt]
            cv2.circle(marked_img, (int(x), int(y)), int(r * 0.8), (20, 20, 20), -1)

        answer_key = {
            "201": {
                "part1": {q: choices[(q - 1) % 4] for q in range(1, 21)}
            }
        }

        res_filled = process_omr_sheet(marked_img, answer_key=answer_key, max_p1=20, sheet_type="tndo_a20")
        self.assertEqual(res_filled["sbd"], "098765")
        self.assertEqual(res_filled["exam_code"], "201")
        # 10 questions correct * 0.5 points = 5.0 points
        self.assertAlmostEqual(res_filled["grading"]["total_score"], 5.0, places=2)
        self.assertAlmostEqual(res_filled["grading"]["part1_score"], 5.0, places=2)

    def test_tndo_a40_clean_and_filled(self):
        self.assertTrue(self.a40_img_path.exists())
        img = cv2.imread(str(self.a40_img_path))
        self.assertIsNotNone(img)

        res_clean = process_omr_sheet(img, sheet_type="tndo_a40")
        self.assertTrue(res_clean["success"])
        self.assertEqual(res_clean["sheet_type"], "tndo_a40")
        self.assertEqual(len(res_clean["part1_raw"]), 40)
        self.assertEqual(len(res_clean["part2_raw"]), 0)
        self.assertEqual(len(res_clean["part3_raw"]), 0)
        self.assertEqual(len(res_clean["sbd"]), 6)
        self.assertEqual(len(res_clean["exam_code"]), 3)

        # Fill 40 questions with answer key: 40 * 0.25 = 10.0 pts
        tmpl = get_sheet_template("tndo_a40")
        marked_img = img.copy()
        p1_grid = tmpl.get_part1_grid()
        choices = ["A", "B", "C", "D"]
        key = {}
        for q in range(1, 41):
            opt = choices[(q - 1) % 4]
            key[q] = opt
            x, y, r = p1_grid[q][opt]
            cv2.circle(marked_img, (int(x), int(y)), int(r * 0.8), (20, 20, 20), -1)

        res_filled = process_omr_sheet(marked_img, answer_key={"part1": key}, max_p1=40, sheet_type="tndo_a40")
        self.assertAlmostEqual(res_filled["grading"]["total_score"], 10.0, places=2)

    def test_tndo_3p_2026_clean(self):
        self.assertTrue(self.p3_img_path.exists())
        img = cv2.imread(str(self.p3_img_path))
        self.assertIsNotNone(img)

        res_clean = process_omr_sheet(img, sheet_type="tndo_3p_2026")
        self.assertTrue(res_clean["success"])
        self.assertEqual(res_clean["sheet_type"], "tndo_3p_2026")
        self.assertEqual(len(res_clean["part1_raw"]), 40)
        self.assertEqual(len(res_clean["part2_raw"]), 8)
        self.assertEqual(len(res_clean["part3_raw"]), 6)
        self.assertEqual(len(res_clean["sbd"]), 8)
        self.assertEqual(len(res_clean["exam_code"]), 4)


if __name__ == "__main__":
    unittest.main()

