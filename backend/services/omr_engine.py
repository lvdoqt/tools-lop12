"""
OMR Engine using OpenCV for robust multiple choice answer sheet grading.
Handles corner marker detection, perspective rectification, bubble reading,
uncertainty detection, and visual overlay generation.
"""

import base64
import cv2
import io
import math
import numpy as np
from PIL import Image, ImageOps


CANONICAL_WIDTH = 1000
CANONICAL_HEIGHT = 1414

# Target centers of 4 corner registration squares on 1000x1414 canvas:
# CSS: tl/tr top 3%, bl/br bottom 3%, tl/bl left 4%, tr/br right 4%, size 7mm x 7mm (3.33% W x 2.35% H)
TARGET_TL = (56.7, 59.0)
TARGET_TR = (943.3, 59.0)
TARGET_BR = (943.3, 1355.0)
TARGET_BL = (56.7, 1355.0)


def load_image_from_base64(b64_string: str) -> np.ndarray:
    """Decode base64 image (with or without data URL prefix) and handle EXIF rotation."""
    if ',' in b64_string:
        b64_string = b64_string.split(',', 1)[1]
    raw_bytes = base64.b64decode(b64_string)
    
    # Use PIL to safely handle EXIF orientation tags from smartphone cameras
    pil_img = Image.open(io.BytesIO(raw_bytes))
    pil_img = ImageOps.exif_transpose(pil_img)
    
    # Convert to RGB then BGR numpy array
    rgb = np.array(pil_img.convert('RGB'))
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    return bgr


def find_corner_marker_in_quadrant(gray_quad: np.ndarray, quad_offset: tuple[int, int], corner_name: str) -> tuple[float, float] | None:
    """
    Search for the solid black fiducial marker inside a quadrant ROI.
    Uses multiple thresholding passes and contour filtering.
    """
    h_q, w_q = gray_quad.shape
    x_off, y_off = quad_offset
    total_area = w_q * h_q
    
    candidates = []
    
    # Try different binarization methods
    threshold_images = []
    # 1. Otsu thresholding
    _, otsu = cv2.threshold(gray_quad, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    threshold_images.append(otsu)
    
    # 2. Adaptive thresholding
    adaptive = cv2.adaptiveThreshold(
        gray_quad, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 8
    )
    threshold_images.append(adaptive)
    
    # 3. Fixed threshold levels
    for lvl in [70, 95, 120]:
        _, fixed = cv2.threshold(gray_quad, lvl, 255, cv2.THRESH_BINARY_INV)
        threshold_images.append(fixed)

    for thresh in threshold_images:
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in contours:
            area = cv2.contourArea(cnt)
            # Fiducial square is ~ 7mm x 7mm on A4 (~ 0.05% to 2.5% of quadrant area)
            if area < 60 or area > 0.15 * total_area:
                continue
            
            x, y, w, h = cv2.boundingRect(cnt)
            aspect_ratio = float(w) / max(1, h)
            if not (0.60 <= aspect_ratio <= 1.65):
                continue
            
            solidity = area / max(1, float(w * h))
            if solidity < 0.60:
                continue
                
            M = cv2.moments(cnt)
            if M['m00'] == 0:
                continue
            cx = float(M['m10'] / M['m00']) + x_off
            cy = float(M['m01'] / M['m00']) + y_off
            
            # Score candidate: solid square shape + reasonable size
            squareness = 1.0 - abs(1.0 - aspect_ratio)
            score = squareness * 2.0 + solidity * 3.0
            candidates.append((score, (cx, cy), area))
            
    if not candidates:
        return None

    # Sort candidates by score descending
    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


def detect_four_corners(image: np.ndarray) -> tuple[np.ndarray, bool]:
    """
    Detect the 4 fiducial registration corners of the answer sheet.
    Falls back to geometric extrapolation if 3 corners are found.
    Returns (src_points, success).
    """
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    
    # Define 4 corner search zones (quadrants)
    qx = int(w * 0.35)
    qy = int(h * 0.35)
    
    quads = {
        'tl': (gray[0:qy, 0:qx], (0, 0)),
        'tr': (gray[0:qy, w - qx:w], (w - qx, 0)),
        'bl': (gray[h - qy:h, 0:qx], (0, h - qy)),
        'br': (gray[h - qy:h, w - qx:w], (w - qx, h - qy)),
    }
    
    points = {}
    for name, (q_img, offset) in quads.items():
        pt = find_corner_marker_in_quadrant(q_img, offset, name)
        if pt is not None:
            points[name] = pt
            
    # If all 4 found, perfect!
    if len(points) == 4:
        return np.array([points['tl'], points['tr'], points['br'], points['bl']], dtype=np.float32), True
        
    # If 3 corners found, extrapolate the 4th corner using parallelogram property
    if len(points) == 3:
        if 'br' not in points:
            # br ~ bl + (tr - tl)
            ext_x = points['bl'][0] + (points['tr'][0] - points['tl'][0])
            ext_y = points['bl'][1] + (points['tr'][1] - points['tl'][1])
            points['br'] = (ext_x, ext_y)
        elif 'bl' not in points:
            # bl ~ br - (tr - tl)
            ext_x = points['br'][0] - (points['tr'][0] - points['tl'][0])
            ext_y = points['br'][1] - (points['tr'][1] - points['tl'][1])
            points['bl'] = (ext_x, ext_y)
        elif 'tr' not in points:
            # tr ~ tl + (br - bl)
            ext_x = points['tl'][0] + (points['br'][0] - points['bl'][0])
            ext_y = points['tl'][1] + (points['br'][1] - points['bl'][1])
            points['tr'] = (ext_x, ext_y)
        elif 'tl' not in points:
            # tl ~ tr - (br - bl)
            ext_x = points['tr'][0] - (points['br'][0] - points['bl'][0])
            ext_y = points['tr'][1] - (points['br'][1] - points['bl'][1])
            points['tl'] = (ext_x, ext_y)
        return np.array([points['tl'], points['tr'], points['br'], points['bl']], dtype=np.float32), True

    # Fallback to outer boundary of the image with standard 4% / 3% margin if markers not isolated
    fallback_tl = (w * 0.0567, h * 0.0417)
    fallback_tr = (w * 0.9433, h * 0.0417)
    fallback_br = (w * 0.9433, h * 0.9583)
    fallback_bl = (w * 0.0567, h * 0.9583)
    return np.array([fallback_tl, fallback_tr, fallback_br, fallback_bl], dtype=np.float32), False


def rectify_sheet(image: np.ndarray, src_points: np.ndarray) -> np.ndarray:
    """
    Warp image to canonical 1000x1414 resolution using perspective transform.
    """
    dst_points = np.array([
        TARGET_TL,
        TARGET_TR,
        TARGET_BR,
        TARGET_BL
    ], dtype=np.float32)
    
    matrix = cv2.getPerspectiveTransform(src_points, dst_points)
    warped = cv2.warpPerspective(image, matrix, (CANONICAL_WIDTH, CANONICAL_HEIGHT), flags=cv2.INTER_CUBIC)
    return warped


def get_bubble_center(question_index: int, option_index: int) -> tuple[int, int]:
    """Calculate canonical pixel coordinates for a specific question & option (A=0, B=1, C=2, D=3)."""
    group = question_index // 30
    row = question_index % 30
    x_pct = 12.0 + option_index * 4.0 + group * 22.0
    y_pct = 24.5 + row * 2.25
    x = int(CANONICAL_WIDTH * (x_pct / 100.0))
    y = int(CANONICAL_HEIGHT * (y_pct / 100.0))
    return x, y


def analyze_bubble_marks(warped_color: np.ndarray, num_questions: int) -> tuple[list[str], list[int], list[dict]]:
    """
    Read answers from warped sheet.
    Returns:
    - detected_answers: list of 'A', 'B', 'C', 'D' or ''
    - uncertain_questions: list of 1-based question numbers
    - bubble_details: list of question evaluation metadata
    """
    warped_gray = cv2.cvtColor(warped_color, cv2.COLOR_BGR2GRAY)
    detected_answers = []
    uncertain_questions = []
    bubble_details = []
    
    options = ['A', 'B', 'C', 'D']
    
    for i in range(num_questions):
        option_scores = []
        centers = []
        
        # Calculate local background brightness around this question row
        group = i // 30
        row = i % 30
        bg_x = int(CANONICAL_WIDTH * (10.0 + group * 22.0) / 100.0)
        bg_y = int(CANONICAL_HEIGHT * (24.5 + row * 2.25) / 100.0)
        bg_patch = warped_gray[max(0, bg_y - 6):min(CANONICAL_HEIGHT, bg_y + 7), max(0, bg_x - 12):min(CANONICAL_WIDTH, bg_x)]
        bg_val = float(np.median(bg_patch)) if bg_patch.size > 0 else 240.0
        bg_val = max(100.0, bg_val)
        
        for opt_idx in range(4):
            cx, cy = get_bubble_center(i, opt_idx)
            centers.append((cx, cy))
            
            # Sample circular area inside the bubble (radius = 7.5 px)
            patch = warped_gray[max(0, cy - 8):min(CANONICAL_HEIGHT, cy + 9), max(0, cx - 8):min(CANONICAL_WIDTH, cx + 9)]
            if patch.size == 0:
                option_scores.append(0.0)
                continue
                
            # Compute dark pixel density and normalized darkness
            dark_pixels = np.sum(patch < (bg_val * 0.72))
            total_pixels = patch.size
            dark_ratio = dark_pixels / max(1, total_pixels)
            
            mean_intensity = float(np.mean(patch))
            contrast_score = (bg_val - mean_intensity) / bg_val
            
            # Combined fill score
            fill_score = (contrast_score * 0.6) + (dark_ratio * 0.4)
            option_scores.append(fill_score)
            
        # Analyze the 4 options
        sorted_indices = sorted(range(4), key=lambda idx: option_scores[idx], reverse=True)
        top1_idx = sorted_indices[0]
        top2_idx = sorted_indices[1]
        top1_score = option_scores[top1_idx]
        top2_score = option_scores[top2_idx]
        
        chosen_opt = ''
        is_uncertain = False
        
        if top1_score >= 0.18:
            chosen_opt = options[top1_idx]
            # Flag uncertainty if:
            # 1. Margin over 2nd option is too narrow (student filled 2 bubbles or dirty erasure)
            # 2. Or the top option was only faintly filled (< 0.23)
            if (top1_score - top2_score < 0.065 and top2_score >= 0.15) or top1_score < 0.23:
                is_uncertain = True
        elif top1_score >= 0.13:
            # Very faint mark
            chosen_opt = options[top1_idx]
            is_uncertain = True
        else:
            # Blank / unanswered
            chosen_opt = ''
            
        if is_uncertain:
            uncertain_questions.append(i + 1)
            
        detected_answers.append(chosen_opt)
        bubble_details.append({
            'question': i + 1,
            'chosen': chosen_opt,
            'scores': option_scores,
            'centers': centers,
            'is_uncertain': is_uncertain
        })
        
    return detected_answers, uncertain_questions, bubble_details


def generate_annotated_overlay(
    warped_color: np.ndarray,
    key_answers: list[str],
    detected_answers: list[str],
    bubble_details: list[dict],
    score: int,
    total: int
) -> str:
    """
    Generate an annotated visualization image with:
    - Green ring around correct answers
    - Red ring around wrong answers, with dashed green ring at expected answer
    - Orange marker for uncertain questions
    - Header score card
    Returns base64 data URL.
    """
    annotated = warped_color.copy()
    overlay = annotated.copy()
    options = ['A', 'B', 'C', 'D']
    
    # Colors (BGR)
    COLOR_CORRECT = (34, 197, 94)    # Emerald green
    COLOR_WRONG = (68, 68, 239)      # Crimson red
    COLOR_EXPECTED = (22, 163, 74)   # Dark green
    COLOR_UNCERTAIN = (245, 158, 11) # Amber / Yellow
    
    for i, detail in enumerate(bubble_details):
        expected = key_answers[i] if i < len(key_answers) else ''
        chosen = detected_answers[i]
        centers = detail['centers']
        is_uncertain = detail['is_uncertain']
        
        # Highlight uncertain question row
        if is_uncertain:
            group = i // 30
            row = i % 30
            qx = int(CANONICAL_WIDTH * (2.0 + group * 22.0) / 100.0)
            qy = int(CANONICAL_HEIGHT * (24.5 + row * 2.25) / 100.0)
            cv2.rectangle(overlay, (qx - 4, qy - 9), (qx + 55, qy + 9), COLOR_UNCERTAIN, 1)
        
        if chosen == expected and chosen != '':
            # Student got it right
            opt_idx = options.index(chosen)
            cx, cy = centers[opt_idx]
            cv2.circle(overlay, (cx, cy), 11, COLOR_CORRECT, -1)
            cv2.circle(annotated, (cx, cy), 12, COLOR_CORRECT, 2)
        else:
            # Student got it wrong or left blank
            if chosen != '' and chosen in options:
                opt_idx = options.index(chosen)
                cx, cy = centers[opt_idx]
                cv2.circle(overlay, (cx, cy), 11, COLOR_WRONG, -1)
                cv2.circle(annotated, (cx, cy), 12, COLOR_WRONG, 2)
                # Draw cross on wrong option
                cv2.line(annotated, (cx - 5, cy - 5), (cx + 5, cy + 5), (255, 255, 255), 2)
                cv2.line(annotated, (cx - 5, cy + 5), (cx + 5, cy - 5), (255, 255, 255), 2)
                
            # Indicate correct answer with a green ring
            if expected in options:
                exp_idx = options.index(expected)
                ecx, ecy = centers[exp_idx]
                cv2.circle(annotated, (ecx, ecy), 12, COLOR_EXPECTED, 2)
                
    # Blend semi-transparent filled marks
    cv2.addWeighted(overlay, 0.35, annotated, 0.65, 0, annotated)
    
    # Draw Score Banner in the top header
    # Banner box
    badge_x1, badge_y1, badge_x2, badge_y2 = 680, 50, 930, 140
    cv2.rectangle(annotated, (badge_x1, badge_y1), (badge_x2, badge_y2), (248, 250, 252), -1)
    cv2.rectangle(annotated, (badge_x1, badge_y1), (badge_x2, badge_y2), (203, 213, 225), 2)
    
    score_10 = round((score / max(1, total)) * 10, 2)
    cv2.putText(annotated, "KET QUA CHAM", (badge_x1 + 18, badge_y1 + 25), cv2.FONT_HERSHEY_DUPLEX, 0.6, (71, 85, 105), 1)
    
    score_color = COLOR_CORRECT if score_10 >= 5.0 else COLOR_WRONG
    cv2.putText(annotated, f"{score}/{total} cau", (badge_x1 + 18, badge_y1 + 55), cv2.FONT_HERSHEY_DUPLEX, 0.85, (30, 41, 59), 2)
    cv2.putText(annotated, f"DIEM: {score_10:.2f} / 10", (badge_x1 + 18, badge_y1 + 80), cv2.FONT_HERSHEY_DUPLEX, 0.7, score_color, 2)

    # Encode to JPEG
    encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), 86]
    _, buffer = cv2.imencode('.jpg', annotated, encode_params)
    b64_str = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/jpeg;base64,{b64_str}"


def process_omr_sheet(image_base64: str, key_answers: list[str]) -> dict:
    """
    Full pipeline to process an answer sheet image.
    1. Load image (with EXIF rotation handling).
    2. Detect 4 registration markers.
    3. Rectify perspective to 1000x1414.
    4. Read bubbles & detect uncertainty.
    5. Calculate score & generate annotated image overlay.
    """
    image = load_image_from_base64(image_base64)
    h, w = image.shape[:2]
    
    # Prevent extremely distorted aspect ratio
    if w < h * 0.45 or w > h * 1.5:
        raise ValueError("Ảnh cần chụp trọn phiếu theo chiều dọc.")
        
    src_points, success = detect_four_corners(image)
    warped = rectify_sheet(image, src_points)
    
    detected, uncertain, details = analyze_bubble_marks(warped, len(key_answers))
    correct = sum(got == exp for got, exp in zip(detected, key_answers) if got != '')
    
    annotated_overlay = generate_annotated_overlay(
        warped_color=warped,
        key_answers=key_answers,
        detected_answers=detected,
        bubble_details=details,
        score=correct,
        total=len(key_answers)
    )
    
    return {
        'answers': detected,
        'score': correct,
        'total': len(key_answers),
        'uncertain_questions': uncertain,
        'annotated_image': annotated_overlay
    }
