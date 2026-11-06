"""
OMR Engine 2025 for Vietnamese High School Graduation Exam Answer Sheets
(Phiếu trả lời trắc nghiệm chuẩn Bộ GD&ĐT từ năm 2025 - phieu-cham-2025.pdf).

Features:
- Corner marker detection & perspective rectification
- Bubble sampling with local background contrast normalization
- SBD (8 digits) & Mã đề thi (4 digits) reading
- Part I (40 MCQ), Part II (8 True/False), Part III (6 Short Answer)
- Official MoET 2025 grading formula with progressive scoring for Part II
- Uncertainty / double-mark / faint mark detection
- Visual annotated overlay generation
"""

import base64
import io
import math
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image, ImageOps

try:
    from .sheet_2025_template import (
        CANONICAL_HEIGHT,
        CANONICAL_WIDTH,
        TARGET_BL,
        TARGET_BR,
        TARGET_TL,
        TARGET_TR,
        get_mdt_grid,
        get_part1_grid,
        get_part2_grid,
        get_part3_grid,
        get_sbd_grid,
    )
    from .sheet_templates import SheetTemplate, get_sheet_template
except ImportError:
    from services.sheet_2025_template import (
        CANONICAL_HEIGHT,
        CANONICAL_WIDTH,
        TARGET_BL,
        TARGET_BR,
        TARGET_TL,
        TARGET_TR,
        get_mdt_grid,
        get_part1_grid,
        get_part2_grid,
        get_part3_grid,
        get_sbd_grid,
    )
    from services.sheet_templates import SheetTemplate, get_sheet_template


# -------------------------------------------------------------
# Image Loading & Preprocessing
# -------------------------------------------------------------

def load_image_from_bytes_or_b64(input_data: Any) -> np.ndarray:
    """Decode raw bytes, file-like object, numpy array, or base64 string to BGR numpy array with EXIF transpose."""
    if isinstance(input_data, np.ndarray):
        return input_data
    if isinstance(input_data, str):
        if ',' in input_data:
            input_data = input_data.split(',', 1)[1]
        raw_bytes = base64.b64decode(input_data)
    elif hasattr(input_data, 'read'):
        raw_bytes = input_data.read()
    elif isinstance(input_data, (bytes, bytearray)):
        raw_bytes = bytes(input_data)
    else:
        raise ValueError("Unsupported input format for image loading.")

    pil_img = Image.open(io.BytesIO(raw_bytes))
    pil_img = ImageOps.exif_transpose(pil_img)
    rgb = np.array(pil_img.convert('RGB'))
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    return bgr


# -------------------------------------------------------------
# Corner Marker Detection
# -------------------------------------------------------------

def find_solid_square_in_roi(
    gray_roi: np.ndarray,
    offset: Tuple[int, int],
    target_corner_global: Tuple[float, float],
) -> Optional[Tuple[float, float, float]]:
    """
    Search for the solid black square fiducial inside an ROI.
    Picks the solid square that is closest to target_corner_global.
    Returns (center_x, center_y, area) or None.
    """
    h_roi, w_roi = gray_roi.shape
    x_off, y_off = offset
    roi_area = h_roi * w_roi

    candidates = []

    # Try Otsu and multiple fixed thresholds for contrast robustness
    thresh_methods = [
        cv2.threshold(gray_roi, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1],
        cv2.threshold(gray_roi, 80, 255, cv2.THRESH_BINARY_INV)[1],
        cv2.threshold(gray_roi, 120, 255, cv2.THRESH_BINARY_INV)[1],
    ]

    for thresh in thresh_methods:
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in contours:
            area = cv2.contourArea(c)
            # Fiducial square should be between 0.05% and 25% of ROI
            if area < 200 or area > 0.25 * roi_area:
                continue

            x, y, bw, bh = cv2.boundingRect(c)
            aspect = bw / float(bh) if bh > 0 else 0
            if not (0.70 <= aspect <= 1.40):
                continue

            extent = area / float(bw * bh) if (bw * bh) > 0 else 0
            if extent < 0.65:  # Must be solid filled
                continue

            cx = x_off + x + bw / 2.0
            cy = y_off + y + bh / 2.0
            dist_to_corner = math.hypot(cx - target_corner_global[0], cy - target_corner_global[1])
            candidates.append((cx, cy, area, extent, dist_to_corner))

    if not candidates:
        return None

    # Filter out duplicate candidates at almost same center
    dedup = []
    for cand in candidates:
        if not any(math.hypot(cand[0] - d[0], cand[1] - d[1]) < 15 for d in dedup):
            dedup.append(cand)

    # Pick candidate closest to target corner
    dedup.sort(key=lambda item: item[4])
    best = dedup[0]
    return (best[0], best[1], best[2])


def detect_four_corners(bgr: np.ndarray) -> Tuple[np.ndarray, bool]:
    """
    Detect the 4 primary corner fiducials on the sheet:
    TL (Top-Left), TR (Top-Right), BR (Bottom-Right), BL (Bottom-Left).
    Returns (corners_4x2, is_confident).
    """
    h, w = bgr.shape[:2]
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    # Quadrant ROI definitions (expanded to 35% margin)
    tl_roi = gray[0:int(h * 0.35), 0:int(w * 0.35)]
    tr_roi = gray[0:int(h * 0.35), int(w * 0.65):w]
    bl_roi = gray[int(h * 0.65):h, 0:int(w * 0.35)]
    br_roi = gray[int(h * 0.65):h, int(w * 0.65):w]

    tl = find_solid_square_in_roi(tl_roi, (0, 0), (0.0, 0.0))
    tr = find_solid_square_in_roi(tr_roi, (int(w * 0.65), 0), (float(w), 0.0))
    bl = find_solid_square_in_roi(bl_roi, (0, int(h * 0.65)), (0.0, float(h)))
    br = find_solid_square_in_roi(br_roi, (int(w * 0.65), int(h * 0.65)), (float(w), float(h)))

    if tl and tr and bl and br:
        pts = np.array([
            [tl[0], tl[1]],
            [tr[0], tr[1]],
            [br[0], br[1]],
            [bl[0], bl[1]],
        ], dtype=np.float32)
        return pts, True

    # Fallback: Find largest contour representing sheet boundary
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        largest = max(contours, key=cv2.contourArea)
        peri = cv2.arcLength(largest, True)
        approx = cv2.approxPolyDP(largest, 0.02 * peri, True)
        if len(approx) == 4 and cv2.contourArea(approx) > 0.20 * (w * h):
            pts = approx.reshape(4, 2).astype(np.float32)
            # Sort into TL, TR, BR, BL order:
            s = pts.sum(axis=1)
            diff = np.diff(pts, axis=1)
            tl_pt = pts[np.argmin(s)]
            br_pt = pts[np.argmax(s)]
            tr_pt = pts[np.argmin(diff)]
            bl_pt = pts[np.argmax(diff)]
            return np.array([tl_pt, tr_pt, br_pt, bl_pt], dtype=np.float32), False

    # Default fallback: image corners
    default_pts = np.array([
        [0, 0],
        [w, 0],
        [w, h],
        [0, h]
    ], dtype=np.float32)
    return default_pts, False


def rectify_to_canonical(
    bgr: np.ndarray,
    corners: np.ndarray,
    template: Optional[SheetTemplate] = None,
) -> np.ndarray:
    """Warp source image so that the 4 detected corners match the exact canonical target corners."""
    if template is not None:
        dst = np.array(template.target_anchors, dtype=np.float32)
        target_w = template.canonical_width
        target_h = template.canonical_height
    else:
        dst = np.array([
            list(TARGET_TL),
            list(TARGET_TR),
            list(TARGET_BR),
            list(TARGET_BL),
        ], dtype=np.float32)
        target_w = CANONICAL_WIDTH
        target_h = CANONICAL_HEIGHT

    M = cv2.getPerspectiveTransform(corners, dst)
    warped = cv2.warpPerspective(
        bgr,
        M,
        (target_w, target_h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REPLICATE
    )
    return warped


# -------------------------------------------------------------
# Bubble Darkness Sampling
# -------------------------------------------------------------

def sample_bubble(warped_gray: np.ndarray, cx: float, cy: float, r: float) -> Tuple[float, float]:
    """
    Sample bubble darkness normalized against local background.
    Returns:
    - darkness_score (0.0 to 100.0+): higher means more solidly filled with pencil/pen.
    - fill_ratio (0.0 to 1.0): fraction of pixels significantly darker than background.
    """
    h_img, w_img = warped_gray.shape
    ix, iy = int(round(cx)), int(round(cy))
    ir = int(round(r))

    # Outer bounding box for local background
    pad = int(ir * 1.6)
    y1, y2 = max(0, iy - pad), min(h_img, iy + pad + 1)
    x1, x2 = max(0, ix - pad), min(w_img, ix + pad + 1)

    roi = warped_gray[y1:y2, x1:x2]
    if roi.size == 0:
        return 0.0, 0.0

    rh, rw = roi.shape
    rcx, rcy = ix - x1, iy - y1

    # Create coordinate grid
    y_idx, x_idx = np.ogrid[:rh, :rw]
    dist_sq = (x_idx - rcx) ** 2 + (y_idx - rcy) ** 2

    # Inner core mask (radius 0.65 * r to ignore pre-printed outer circle outline)
    inner_mask = dist_sq <= (ir * 0.65) ** 2

    # Outer background ring mask (between 1.15 * r and 1.55 * r)
    bg_mask = (dist_sq >= (ir * 1.15) ** 2) & (dist_sq <= (ir * 1.55) ** 2)

    inner_pixels = roi[inner_mask]
    bg_pixels = roi[bg_mask]

    if inner_pixels.size == 0 or bg_pixels.size == 0:
        return 0.0, 0.0

    bg_median = float(np.median(bg_pixels))
    inner_mean = float(np.mean(inner_pixels))

    # Darkness contrast score
    contrast = max(0.0, bg_median - inner_mean)

    # Pixel fill ratio (pixels darker than background by at least 30 intensity units)
    dark_count = np.count_nonzero(inner_pixels < (bg_median - 28.0))
    fill_ratio = float(dark_count) / float(inner_pixels.size)

    # Combined score
    score = (contrast * 0.6) + (fill_ratio * 100.0 * 0.4)
    return score, fill_ratio


# -------------------------------------------------------------
# Data Reading: SBD & Mã Đề
# -------------------------------------------------------------

def read_sbd(
    warped_gray: np.ndarray,
    grid: Optional[Dict[int, List[Tuple[int, float, float, float]]]] = None,
) -> Tuple[str, List[int]]:
    """Read Student ID (Số báo danh). Supports 6 or 8 digits. Returns (sbd_str, uncertain_col_indices)."""
    if grid is None:
        grid = get_sbd_grid()

    sbd_chars = []
    uncertain_cols = []
    col_indices = sorted(grid.keys())

    for col_idx in col_indices:
        bubbles = grid[col_idx]
        scores = []
        for digit, x, y, r in bubbles:
            score, fill = sample_bubble(warped_gray, x, y, r)
            scores.append((digit, score, fill))

        scores.sort(key=lambda s: s[1], reverse=True)
        top1 = scores[0]
        top2 = scores[1] if len(scores) > 1 else (0, 0.0, 0.0)

        # Criteria for valid mark: score > 20 and distinct from top2
        if top1[1] > 22.0:
            if (top1[1] - top2[1]) < 10.0 and top2[1] > 20.0:
                # Multiple marks or ambiguous
                sbd_chars.append(str(top1[0]))
                uncertain_cols.append(col_idx)
            else:
                sbd_chars.append(str(top1[0]))
        else:
            # Blank column
            sbd_chars.append('?')
            uncertain_cols.append(col_idx)

    return "".join(sbd_chars), uncertain_cols


def read_exam_code(
    warped_gray: np.ndarray,
    grid: Optional[Dict[int, List[Tuple[int, float, float, float]]]] = None,
) -> Tuple[str, List[int]]:
    """Read Exam Code (Mã đề thi). Supports 3 or 4 digits. Returns (code_str, uncertain_col_indices)."""
    if grid is None:
        grid = get_mdt_grid()

    code_chars = []
    uncertain_cols = []
    col_indices = sorted(grid.keys())

    for col_idx in col_indices:
        bubbles = grid[col_idx]
        scores = []
        for digit, x, y, r in bubbles:
            score, fill = sample_bubble(warped_gray, x, y, r)
            scores.append((digit, score, fill))

        scores.sort(key=lambda s: s[1], reverse=True)
        top1 = scores[0]
        top2 = scores[1] if len(scores) > 1 else (0, 0.0, 0.0)

        if top1[1] > 22.0:
            if (top1[1] - top2[1]) < 10.0 and top2[1] > 20.0:
                code_chars.append(str(top1[0]))
                uncertain_cols.append(col_idx)
            else:
                code_chars.append(str(top1[0]))
        else:
            code_chars.append('?')
            uncertain_cols.append(col_idx)

    return "".join(code_chars), uncertain_cols


# -------------------------------------------------------------
# Data Reading: Phần I (Trắc nghiệm nhiều lựa chọn A, B, C, D)
# -------------------------------------------------------------

def read_part1(
    warped_gray: np.ndarray,
    max_questions: int = 40,
    grid: Optional[Dict[int, Dict[str, Tuple[float, float, float]]]] = None,
) -> List[Dict[str, Any]]:
    """
    Read Part I answers for questions 1 to max_questions.
    Returns list of dicts:
    [{ 'question': 1, 'chosen': 'A', 'score': 45.2, 'is_uncertain': False, 'scores': {...} }, ...]
    """
    if grid is None:
        grid = get_part1_grid()

    results = []
    available_q_nums = sorted([q for q in grid.keys() if q <= max_questions])

    for q_num in available_q_nums:
        opt_bubbles = grid[q_num]
        scores = {}
        for opt in ['A', 'B', 'C', 'D']:
            if opt not in opt_bubbles:
                continue
            x, y, r = opt_bubbles[opt]
            score, fill = sample_bubble(warped_gray, x, y, r)
            scores[opt] = (score, fill)

        if not scores:
            continue

        sorted_opts = sorted(scores.items(), key=lambda item: item[1][0], reverse=True)
        top1_opt, (top1_score, top1_fill) = sorted_opts[0]
        top2_opt, (top2_score, top2_fill) = sorted_opts[1] if len(sorted_opts) > 1 else ('', (0.0, 0.0))

        chosen = None
        is_uncertain = False

        if top1_score > 22.0:
            if (top1_score - top2_score) < 10.0 and top2_score > 20.0:
                chosen = top1_opt
                is_uncertain = True  # Double-mark warning
            else:
                chosen = top1_opt
        else:
            chosen = None  # Blank question

        results.append({
            'question': q_num,
            'chosen': chosen,
            'top_score': round(top1_score, 1),
            'is_uncertain': is_uncertain,
            'scores': {opt: round(s[0], 1) for opt, s in scores.items()},
        })

    return results


# -------------------------------------------------------------
# Data Reading: Phần II (Trắc nghiệm Đúng / Sai)
# -------------------------------------------------------------

def read_part2(
    warped_gray: np.ndarray,
    max_questions: int = 8,
    grid: Optional[Dict[int, Dict[str, Dict[str, Tuple[float, float, float]]]]] = None,
) -> List[Dict[str, Any]]:
    """
    Read Part II answers for questions 1 to max_questions.
    Each question has 4 sub-items: a, b, c, d with choices 'Đ' or 'S'.
    """
    if grid is None:
        grid = get_part2_grid()

    if not grid or max_questions <= 0:
        return []

    results = []
    available_q_nums = sorted([q for q in grid.keys() if q <= max_questions])

    for q_num in available_q_nums:
        sub_grid = grid[q_num]
        sub_answers = {}
        is_q_uncertain = False

        for sub_key in ['a', 'b', 'c', 'd']:
            if sub_key not in sub_grid:
                continue
            d_x, d_y, d_r = sub_grid[sub_key]['Đ']
            s_x, s_y, s_r = sub_grid[sub_key]['S']

            score_d, _ = sample_bubble(warped_gray, d_x, d_y, d_r)
            score_s, _ = sample_bubble(warped_gray, s_x, s_y, s_r)

            chosen_sub = None
            uncertain_sub = False

            if score_d > 22.0 or score_s > 22.0:
                if abs(score_d - score_s) < 10.0 and min(score_d, score_s) > 20.0:
                    chosen_sub = 'Đ' if score_d >= score_s else 'S'
                    uncertain_sub = True
                    is_q_uncertain = True
                elif score_d > score_s:
                    chosen_sub = 'Đ'
                else:
                    chosen_sub = 'S'
            else:
                chosen_sub = None  # Blank

            sub_answers[sub_key] = {
                'chosen': chosen_sub,
                'score_D': round(score_d, 1),
                'score_S': round(score_s, 1),
                'uncertain': uncertain_sub,
            }

        results.append({
            'question': q_num,
            'sub': sub_answers,
            'is_uncertain': is_q_uncertain,
        })

    return results


# -------------------------------------------------------------
# Data Reading: Phần III (Trắc nghiệm Trả lời ngắn)
# -------------------------------------------------------------

def read_part3(
    warped_gray: np.ndarray,
    max_questions: int = 6,
    grid: Optional[Dict[int, Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """
    Read Part III answers for questions 1 to max_questions.
    Constructs numerical string answer: e.g. "-12,5", "446", "0,25".
    """
    if grid is None:
        grid = get_part3_grid()

    if not grid or max_questions <= 0:
        return []

    results = []
    available_q_nums = sorted([q for q in grid.keys() if q <= max_questions])

    for q_num in available_q_nums:
        q_data = grid[q_num]

        # 1. Minus sign
        mx, my, mr = q_data['minus']
        score_minus, _ = sample_bubble(warped_gray, mx, my, mr)
        has_minus = score_minus > 24.0

        # 2. Comma 1 & Comma 2
        c1x, c1y, c1r = q_data['comma_1']
        c2x, c2y, c2r = q_data['comma_2']
        score_c1, _ = sample_bubble(warped_gray, c1x, c1y, c1r) if c1r > 0 else (0.0, 0.0)
        score_c2, _ = sample_bubble(warped_gray, c2x, c2y, c2r) if c2r > 0 else (0.0, 0.0)
        has_comma_1 = score_c1 > 24.0
        has_comma_2 = score_c2 > 24.0

        # 3. Digit columns
        col_digits = []
        is_uncertain = False

        for col_idx, col in enumerate(q_data['columns']):
            digit_scores = []
            for digit, x, y, r in col:
                score, _ = sample_bubble(warped_gray, x, y, r)
                digit_scores.append((digit, score))

            digit_scores.sort(key=lambda item: item[1], reverse=True)
            top1 = digit_scores[0]
            top2 = digit_scores[1] if len(digit_scores) > 1 else (0, 0.0)

            if top1[1] > 22.0:
                if (top1[1] - top2[1]) < 10.0 and top2[1] > 20.0:
                    col_digits.append(str(top1[0]))
                    is_uncertain = True
                else:
                    col_digits.append(str(top1[0]))
            else:
                col_digits.append(None)

        digit_chars = [d if d is not None else '' for d in col_digits]
        assembled = "".join(digit_chars).strip()

        if has_comma_1 and len(digit_chars) >= 2:
            part_a = digit_chars[0] or '0'
            part_b = "".join(digit_chars[1:]).rstrip()
            if part_b:
                assembled = f"{part_a},{part_b}"
        elif has_comma_2 and len(digit_chars) >= 3:
            part_a = "".join(digit_chars[:2]).lstrip() or '0'
            part_b = "".join(digit_chars[2:]).rstrip()
            if part_b:
                assembled = f"{part_a},{part_b}"

        if has_minus and assembled:
            assembled = "-" + assembled

        results.append({
            'question': q_num,
            'raw_value': assembled if assembled else None,
            'has_minus': has_minus,
            'col_digits': col_digits,
            'has_comma': has_comma_1 or has_comma_2,
            'is_uncertain': is_uncertain,
        })

    return results


# -------------------------------------------------------------
# Official Scoring Engine (Bộ GD&ĐT 2025)
# -------------------------------------------------------------

def grade_answers(
    part1_parsed: List[Dict[str, Any]],
    part2_parsed: List[Dict[str, Any]],
    part3_parsed: List[Dict[str, Any]],
    answer_key: Dict[str, Any],
    max_p1: int = 40,
    max_p2: int = 8,
    max_p3: int = 6,
) -> Dict[str, Any]:
    """
    Grade student answers against answer_key according to official MoET 2025 specifications.
    Formula:
    - Pure MCQ sheet (Part II & Part III = 0): 10.0 / max_p1 points per question (e.g. 0.5 for 20q, 0.25 for 40q)
    - 3-Part sheets:
        - Part I:  0.25 pt / question (Math: 12 questions = 3.0 pts)
        - Part II: Progressive scoring (Math: 4 questions = 4.0 pts):
            1 correct sub-item: 0.1 pt
            2 correct sub-items: 0.25 pt
            3 correct sub-items: 0.5 pt
            4 correct sub-items: 1.0 pt
        - Part III: 0.5 pt / question (Math: 6 questions = 3.0 pts)
    Total: 10.0 pts.
    """
    key_p1 = answer_key.get('part1', {})
    key_p2 = answer_key.get('part2', {})
    key_p3 = answer_key.get('part3', {})

    # Part I points calculation
    if max_p2 == 0 and max_p3 == 0:
        points_per_p1 = round(10.0 / max(1, max_p1), 4)
    else:
        points_per_p1 = 0.25

    # Part I Grading
    p1_graded = []
    p1_score = 0.0
    for item in part1_parsed:
        q_num = item['question']
        str_q = str(q_num)
        correct_ans = key_p1.get(str_q) or key_p1.get(q_num)
        if not correct_ans:
            continue

        is_correct = (item['chosen'] == correct_ans)
        points = points_per_p1 if is_correct else 0.0
        p1_score += points
        p1_graded.append({
            'question': q_num,
            'chosen': item['chosen'],
            'correct': correct_ans,
            'is_correct': is_correct,
            'points': round(points, 2),
            'uncertain': item['is_uncertain'],
        })

    # Part II Grading
    p2_graded = []
    p2_score = 0.0
    progressive_table = {0: 0.0, 1: 0.1, 2: 0.25, 3: 0.5, 4: 1.0}

    for item in part2_parsed:
        q_num = item['question']
        str_q = str(q_num)
        # Support both relative (1..8) and absolute (41..48)
        correct_q = (
            key_p2.get(str_q)
            or key_p2.get(q_num)
            or key_p2.get(str(q_num + 40))
            or key_p2.get(q_num + 40)
        )
        if not correct_q:
            continue

        # correct_q can be a dict {'a': 'Đ', 'b': 'S', ...} or a 4-char string 'ĐSĐS' / 'DSDS'
        sub_details = {}
        correct_count = 0

        for idx, sub_key in enumerate(['a', 'b', 'c', 'd']):
            expected = None
            if isinstance(correct_q, dict):
                expected = correct_q.get(sub_key)
            elif isinstance(correct_q, str) and len(correct_q) >= 4:
                char = correct_q[idx].upper()
                expected = 'Đ' if char in ['Đ', 'D', 'T', '1'] else 'S'

            student_choice = item['sub'][sub_key]['chosen']
            sub_correct = (student_choice == expected) and (student_choice is not None)
            if sub_correct:
                correct_count += 1

            sub_details[sub_key] = {
                'chosen': student_choice,
                'correct': expected,
                'is_correct': sub_correct,
            }

        q_points = progressive_table.get(correct_count, 0.0)
        p2_score += q_points
        p2_graded.append({
            'question': q_num,
            'sub': sub_details,
            'correct_count': correct_count,
            'points': q_points,
            'uncertain': item['is_uncertain'],
        })

    # Part III Grading
    p3_graded = []
    p3_score = 0.0

    def normalize_num_str(val: Optional[str]) -> Optional[str]:
        if not val:
            return None
        v = str(val).strip().replace('.', ',')
        return v

    for item in part3_parsed:
        q_num = item['question']
        str_q = str(q_num)
        # Support both relative (1..6) and absolute (49..54)
        correct_ans = (
            key_p3.get(str_q)
            or key_p3.get(q_num)
            or key_p3.get(str(q_num + 48))
            or key_p3.get(q_num + 48)
        )
        if not correct_ans:
            continue

        norm_student = normalize_num_str(item['raw_value'])
        norm_correct = normalize_num_str(str(correct_ans))

        is_correct = (norm_student is not None) and (norm_student == norm_correct)
        points = 0.5 if is_correct else 0.0
        p3_score += points
        p3_graded.append({
            'question': q_num,
            'chosen': norm_student,
            'correct': norm_correct,
            'is_correct': is_correct,
            'points': points,
            'uncertain': item['is_uncertain'],
        })

    total_score = min(10.0, round(p1_score + p2_score + p3_score, 2))

    return {
        'total_score': total_score,
        'part1_score': round(p1_score, 2),
        'part2_score': round(p2_score, 2),
        'part3_score': round(p3_score, 2),
        'part1_results': p1_graded,
        'part2_results': p2_graded,
        'part3_results': p3_graded,
    }


# -------------------------------------------------------------
# Visual Annotated Overlay Generation
# -------------------------------------------------------------

def generate_annotated_image(
    warped_bgr: np.ndarray,
    sbd: str,
    exam_code: str,
    grade_res: Dict[str, Any],
    template: Optional[SheetTemplate] = None,
) -> str:
    """
    Draw green circles (correct), red circles (wrong), and yellow circles (uncertain)
    over the canonical answer sheet, plus header info bar. Returns base64 JPEG data URL.
    """
    if template is None:
        template = get_sheet_template("2025_standard")

    annotated = warped_bgr.copy()
    p1_grid = template.get_part1_grid()
    p2_grid = template.get_part2_grid()
    p3_grid = template.get_part3_grid()

    # Draw Part I results
    for item in grade_res.get('part1_results', []):
        q_num = item['question']
        chosen = item['chosen']
        correct = item['correct']
        uncertain = item.get('uncertain', False)

        if q_num not in p1_grid:
            continue

        if chosen == correct and chosen:
            # Correct: Green circle around chosen
            cx, cy, cr = p1_grid[q_num][chosen]
            cv2.circle(annotated, (int(cx), int(cy)), int(cr * 1.25), (0, 200, 0), 4)
        else:
            # Wrong: Red circle around chosen (if chosen)
            if chosen and chosen in p1_grid[q_num]:
                cx, cy, cr = p1_grid[q_num][chosen]
                cv2.circle(annotated, (int(cx), int(cy)), int(cr * 1.25), (0, 0, 220), 4)
            # Green outline around correct
            if correct and correct in p1_grid[q_num]:
                cx, cy, cr = p1_grid[q_num][correct]
                cv2.circle(annotated, (int(cx), int(cy)), int(cr * 1.25), (0, 200, 0), 3)

        if uncertain and chosen and chosen in p1_grid[q_num]:
            cx, cy, cr = p1_grid[q_num][chosen]
            cv2.circle(annotated, (int(cx), int(cy)), int(cr * 1.55), (0, 215, 255), 3)

    # Draw Part II results
    for item in grade_res.get('part2_results', []):
        q_num = item['question']
        if q_num not in p2_grid:
            continue
        for sub_key, sub_item in item['sub'].items():
            if sub_key not in p2_grid[q_num]:
                continue
            chosen = sub_item['chosen']
            correct = sub_item['correct']

            if chosen == correct and chosen:
                cx, cy, cr = p2_grid[q_num][sub_key][chosen]
                cv2.circle(annotated, (int(cx), int(cy)), int(cr * 1.25), (0, 200, 0), 4)
            else:
                if chosen and chosen in p2_grid[q_num][sub_key]:
                    cx, cy, cr = p2_grid[q_num][sub_key][chosen]
                    cv2.circle(annotated, (int(cx), int(cy)), int(cr * 1.25), (0, 0, 220), 4)
                if correct and correct in p2_grid[q_num][sub_key]:
                    cx, cy, cr = p2_grid[q_num][sub_key][correct]
                    cv2.circle(annotated, (int(cx), int(cy)), int(cr * 1.25), (0, 200, 0), 3)

    # Header Banner on Image
    w_can = template.canonical_width
    h_can = template.canonical_height

    score_text = f"DIEM: {grade_res['total_score']}/10.0  |  SBD: {sbd}  |  MD: {exam_code}"
    if len(p2_grid) > 0 or len(p3_grid) > 0:
        sub_text = f"P.I: {grade_res['part1_score']}  |  P.II: {grade_res['part2_score']}  |  P.III: {grade_res['part3_score']}"
    else:
        num_correct = sum(1 for x in grade_res.get('part1_results', []) if x.get('is_correct'))
        tot_q = len(grade_res.get('part1_results', []))
        sub_text = f"Trac nghiem: {grade_res['part1_score']} diem ({num_correct}/{tot_q} cau)"

    # Banner dimensions
    b_x1 = int(w_can * 0.05)
    b_x2 = int(w_can * 0.95)
    b_y1 = int(h_can * 0.012)
    b_y2 = int(h_can * 0.058)

    cv2.rectangle(annotated, (b_x1, b_y1), (b_x2, b_y2), (255, 255, 255), -1)
    cv2.rectangle(annotated, (b_x1, b_y1), (b_x2, b_y2), (0, 160, 0), 3)

    font_scale = 1.0 if w_can >= 2000 else 0.7
    t_y1 = b_y1 + int((b_y2 - b_y1) * 0.45)
    t_y2 = b_y1 + int((b_y2 - b_y1) * 0.85)

    cv2.putText(annotated, score_text, (b_x1 + 20, t_y1), cv2.FONT_HERSHEY_DUPLEX, font_scale, (0, 120, 0), 2)
    cv2.putText(annotated, sub_text, (b_x1 + 20, t_y2), cv2.FONT_HERSHEY_SIMPLEX, font_scale * 0.8, (50, 50, 50), 2)

    # Downscale for lightweight mobile transmission (target width ~1164)
    scale = min(1.0, 1164.0 / w_can)
    preview = cv2.resize(annotated, (int(w_can * scale), int(h_can * scale)), interpolation=cv2.INTER_AREA)

    _, buffer = cv2.imencode('.jpg', preview, [cv2.IMWRITE_JPEG_QUALITY, 85])
    b64 = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/jpeg;base64,{b64}"


# -------------------------------------------------------------
# Main Process Entrypoint
# -------------------------------------------------------------

def process_omr_sheet(
    image_input: Any,
    answer_key: Optional[Dict[str, Any]] = None,
    max_p1: int = 40,
    max_p2: int = 8,
    max_p3: int = 6,
    sheet_type: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Full pipeline to process a photographed answer sheet:
    1. Resolve template geometry (MoET 2025, TNDO-A20, TNDO-A40, TNDO-3P-2026)
    2. Detect 4 fiducials & perspective warp to template canonical coordinates
    3. Read SBD, Mã Đề, Part I, Part II, Part III
    4. Calculate official score if answer_key provided
    5. Generate visual annotated preview overlay
    """
    template = get_sheet_template(sheet_type)

    # If pure MCQ sheet (A20, A40), force p2 and p3 to 0
    if len(template.get_part2_grid()) == 0:
        max_p2 = 0
    if len(template.get_part3_grid()) == 0:
        max_p3 = 0

    bgr = load_image_from_bytes_or_b64(image_input)
    corners, confident = detect_four_corners(bgr)
    warped = rectify_to_canonical(bgr, corners, template)
    warped_gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)

    # Read IDs using template grids
    sbd_grid = template.get_sbd_grid()
    mdt_grid = template.get_mdt_grid()
    sbd, sbd_uncertain = read_sbd(warped_gray, sbd_grid)
    exam_code, code_uncertain = read_exam_code(warped_gray, mdt_grid)

    # Read Test Sections using template grids
    p1_grid = template.get_part1_grid()
    p2_grid = template.get_part2_grid()
    p3_grid = template.get_part3_grid()

    p1_parsed = read_part1(warped_gray, max_p1, p1_grid)
    p2_parsed = read_part2(warped_gray, max_p2, p2_grid) if p2_grid and max_p2 > 0 else []
    p3_parsed = read_part3(warped_gray, max_p3, p3_grid) if p3_grid and max_p3 > 0 else []

    uncertain_questions = []
    for item in p1_parsed:
        if item['is_uncertain']:
            uncertain_questions.append(f"P1_Q{item['question']}")
    for item in p2_parsed:
        if item['is_uncertain']:
            uncertain_questions.append(f"P2_Q{item['question']}")
    for item in p3_parsed:
        if item['is_uncertain']:
            uncertain_questions.append(f"P3_Q{item['question']}")

    # If answer_key contains multiple exam codes (e.g. from word-shuffle), select matching code:
    selected_key = {}
    if answer_key:
        if exam_code in answer_key:
            selected_key = answer_key[exam_code]
        elif 'part1' in answer_key or 'part2' in answer_key:
            selected_key = answer_key
        else:
            first_key = next(iter(answer_key.values())) if answer_key else {}
            if isinstance(first_key, dict) and ('part1' in first_key or 'part2' in first_key):
                selected_key = first_key
            else:
                selected_key = answer_key

    grade_res = grade_answers(
        p1_parsed,
        p2_parsed,
        p3_parsed,
        selected_key,
        max_p1=max_p1,
        max_p2=max_p2,
        max_p3=max_p3,
    )
    annotated_url = generate_annotated_image(warped, sbd, exam_code, grade_res, template)

    return {
        'success': True,
        'sbd': sbd,
        'exam_code': exam_code,
        'sheet_type': template.id,
        'sheet_name': template.name,
        'confident_alignment': confident,
        'uncertain_questions': uncertain_questions,
        'grading': grade_res,
        'part1_raw': p1_parsed,
        'part2_raw': p2_parsed,
        'part3_raw': p3_parsed,
        'annotated_image': annotated_url,
    }
