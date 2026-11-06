"""
Unit tests for OMR Engine 2025 (Bộ GD&ĐT 2025 Answer Sheet Grader).
"""

import unittest
import numpy as np
import cv2
import base64
from backend.services.omr_engine_2025 import (
    process_omr_sheet,
    detect_four_corners,
    rectify_to_canonical,
    grade_answers,
    CANONICAL_WIDTH,
    CANONICAL_HEIGHT
)
from backend.services.sheet_2025_template import (
    get_part1_grid,
    get_part2_grid,
    get_part3_grid,
    get_sbd_grid,
    get_mdt_grid
)


class TestOMREngine2025(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Load the official template directly from phieu-cham-2025.pdf
        import pymupdf
        doc = pymupdf.open('d:/tools/phieu-cham-2025.pdf')
        page = doc[0]
        pix = page.get_pixmap(dpi=300)
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
        if pix.n == 1:
            cls.base_img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        elif pix.n == 4:
            cls.base_img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
        else:
            cls.base_img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

    def test_corner_detection_clean(self):
        corners, confident = detect_four_corners(self.base_img)
        self.assertTrue(confident, "Corner detection should be confident on clean template")
        self.assertEqual(len(corners), 4)

        # Check approximate positions of 4 corners
        # TL ~ (76, 92), TR ~ (2244, 92), BR ~ (2244, 3296), BL ~ (76, 3296)
        self.assertAlmostEqual(corners[0][0], 76.5, delta=15.0)
        self.assertAlmostEqual(corners[0][1], 92.5, delta=15.0)
        self.assertAlmostEqual(corners[1][0], 2244.5, delta=15.0)
        self.assertAlmostEqual(corners[2][0], 2244.5, delta=15.0)
        self.assertAlmostEqual(corners[3][0], 76.5, delta=15.0)

    def test_synthetic_marks_and_grading(self):
        """Simulate a student filling marks on SBD, MDT, Part I, Part II, Part III."""
        filled_img = self.base_img.copy()

        # 1. Fill SBD: "12345678"
        sbd_grid = get_sbd_grid()
        sbd_target = "12345678"
        for col_idx, char in enumerate(sbd_target):
            digit = int(char)
            # Find matching bubble
            for d, bx, by, br in sbd_grid[col_idx]:
                if d == digit:
                    cv2.circle(filled_img, (int(bx), int(by)), int(br * 0.75), (30, 30, 30), -1)

        # 2. Fill MDT: "0102"
        mdt_grid = get_mdt_grid()
        mdt_target = "0102"
        for col_idx, char in enumerate(mdt_target):
            digit = int(char)
            for d, bx, by, br in mdt_grid[col_idx]:
                if d == digit:
                    cv2.circle(filled_img, (int(bx), int(by)), int(br * 0.75), (30, 30, 30), -1)

        # 3. Fill Part I: 12 questions (Math exam)
        # 1: A, 2: B, 3: C, 4: D, 5: A, 6: B, 7: C, 8: D, 9: A, 10: B, 11: C, 12: D
        p1_grid = get_part1_grid()
        p1_ans = {
            1: 'A', 2: 'B', 3: 'C', 4: 'D',
            5: 'A', 6: 'B', 7: 'C', 8: 'D',
            9: 'A', 10: 'B', 11: 'C', 12: 'D'
        }
        for q_num, opt in p1_ans.items():
            bx, by, br = p1_grid[q_num][opt]
            cv2.circle(filled_img, (int(bx), int(by)), int(br * 0.75), (30, 30, 30), -1)

        # 4. Fill Part II: 4 questions (Math exam)
        # Q1: a-Đ, b-S, c-Đ, d-S (all 4 correct -> 1.0 pt)
        # Q2: a-Đ, b-Đ, c-S, d-S (all 4 correct -> 1.0 pt)
        p2_grid = get_part2_grid()
        p2_ans = {
            1: {'a': 'Đ', 'b': 'S', 'c': 'Đ', 'd': 'S'},
            2: {'a': 'Đ', 'b': 'Đ', 'c': 'S', 'd': 'S'},
        }
        for q_num, sub_dict in p2_ans.items():
            for sub_key, choice in sub_dict.items():
                bx, by, br = p2_grid[q_num][sub_key][choice]
                cv2.circle(filled_img, (int(bx), int(by)), int(br * 0.75), (30, 30, 30), -1)

        # 5. Fill Part III: 2 questions
        # Q1: "446" -> Col 0: blank, Col 1: 4, Col 2: 4, Col 3: 6
        p3_grid = get_part3_grid()
        # Q1 col 1 -> 4
        _, bx, by, br = p3_grid[1]['columns'][1][4]
        cv2.circle(filled_img, (int(bx), int(by)), int(br * 0.75), (30, 30, 30), -1)
        # Q1 col 2 -> 4
        _, bx, by, br = p3_grid[1]['columns'][2][4]
        cv2.circle(filled_img, (int(bx), int(by)), int(br * 0.75), (30, 30, 30), -1)
        # Q1 col 3 -> 6
        _, bx, by, br = p3_grid[1]['columns'][3][6]
        cv2.circle(filled_img, (int(bx), int(by)), int(br * 0.75), (30, 30, 30), -1)

        # Process with OMR Engine
        answer_key = {
            'part1': p1_ans,
            'part2': p2_ans,
            'part3': {1: '446'},
        }

        # Encode to JPEG
        _, buf = cv2.imencode('.jpg', filled_img)
        res = process_omr_sheet(buf.tobytes(), answer_key=answer_key, max_p1=12, max_p2=4, max_p3=2)

        self.assertTrue(res['success'])
        self.assertEqual(res['sbd'], sbd_target)
        self.assertEqual(res['exam_code'], mdt_target)

        grading = res['grading']
        # Part I: 12 * 0.25 = 3.0 pts
        self.assertAlmostEqual(grading['part1_score'], 3.0)
        # Part II: 2 * 1.0 = 2.0 pts
        self.assertAlmostEqual(grading['part2_score'], 2.0)
        # Part III: 1 * 0.5 = 0.5 pt
        self.assertAlmostEqual(grading['part3_score'], 0.5)
        # Total: 3.0 + 2.0 + 0.5 = 5.5 pts
        self.assertAlmostEqual(grading['total_score'], 5.5)

        # Check annotated image generated
        self.assertTrue(res['annotated_image'].startswith('data:image/jpeg;base64,'))

    def test_skewed_smartphone_photo(self):
        """Simulate a phone photo taken at an angle with perspective skew and background padding."""
        h, w = self.base_img.shape[:2]
        pad = 200
        canvas = np.ones((h + 2 * pad, w + 2 * pad, 3), dtype=np.uint8) * 190  # Desk surface
        canvas[pad:pad + h, pad:pad + w] = self.base_img

        # Perspective distortion
        src = np.array([
            [pad, pad],
            [pad + w, pad],
            [pad + w, pad + h],
            [pad, pad + h]
        ], dtype=np.float32)
        dst = np.array([
            [pad + 50, pad + 80],
            [pad + w - 40, pad + 20],
            [pad + w - 70, pad + h - 60],
            [pad + 30, pad + h - 40]
        ], dtype=np.float32)

        M = cv2.getPerspectiveTransform(src, dst)
        skewed = cv2.warpPerspective(canvas, M, (w + 2 * pad, h + 2 * pad), flags=cv2.INTER_LINEAR)

        # Detect corners on skewed photo
        corners, confident = detect_four_corners(skewed)
        self.assertTrue(confident, "Should detect corners on perspective-skewed phone photo")


if __name__ == '__main__':
    unittest.main()
