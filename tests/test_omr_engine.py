import unittest
import numpy as np
import cv2
import base64
from backend.services.omr_engine import (
    process_omr_sheet,
    detect_four_corners,
    rectify_sheet,
    analyze_bubble_marks,
    CANONICAL_WIDTH,
    CANONICAL_HEIGHT
)
from tests.test_sheet_generator import generate_synthetic_sheet


class TestOMREngine(unittest.TestCase):
    def setUp(self):
        self.img, self.answers = generate_synthetic_sheet()

    def test_clean_sheet_corner_detection_and_grading(self):
        # Encode synthetic sheet to base64
        _, buffer = cv2.imencode('.jpg', self.img)
        b64 = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')
        
        result = process_omr_sheet(b64, self.answers)
        self.assertEqual(result['score'], 20)
        self.assertEqual(result['total'], 20)
        self.assertEqual(result['answers'], self.answers)
        self.assertIn('data:image/jpeg;base64,', result['annotated_image'])
        self.assertEqual(result['uncertain_questions'], [])

    def test_perspective_skewed_sheet(self):
        # Apply perspective distortion to simulate a photo taken at an angle with padding around sheet
        pad = 120
        h, w = self.img.shape[:2]
        padded = np.ones((h + 2 * pad, w + 2 * pad, 3), dtype=np.uint8) * 200 # grey table background
        padded[pad:pad + h, pad:pad + w] = self.img
        
        # Slightly distort corners
        src = np.array([
            [pad, pad],
            [pad + w, pad],
            [pad + w, pad + h],
            [pad, pad + h]
        ], dtype=np.float32)
        dst = np.array([
            [pad + 30, pad + 20],
            [pad + w - 20, pad + 35],
            [pad + w - 40, pad + h - 15],
            [pad + 25, pad + h - 30]
        ], dtype=np.float32)
        M = cv2.getPerspectiveTransform(src, dst)
        distorted = cv2.warpPerspective(padded, M, (w + 2 * pad, h + 2 * pad), flags=cv2.INTER_CUBIC)
        
        _, buffer = cv2.imencode('.jpg', distorted)
        b64 = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')
        
        result = process_omr_sheet(b64, self.answers)
        self.assertEqual(result['score'], 20)
        self.assertEqual(result['answers'], self.answers)


if __name__ == '__main__':
    unittest.main()
