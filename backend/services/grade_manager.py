"""
Grade Manager Service:
Handles Excel Answer Key importing (TNMaker 2025 format),
Sample Excel Template generation,
Exporting Gradebooks to Excel,
and Supabase cloud synchronization for multi-exam management.
"""

from io import BytesIO
import json
import os
from typing import Any, Dict, List, Optional
import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
import requests


def get_supabase_config():
    url = os.getenv('SUPABASE_URL', '').strip().rstrip('/')
    secret = (
        os.getenv('SUPABASE_SECRET_KEY', '').strip()
        or os.getenv('SUPABASE_SERVICE_ROLE_KEY', '').strip()
    )
    return url, secret


def parse_tnmaker_excel(file_bytes: bytes) -> Dict[str, Dict[str, Any]]:
    """
    Parse Dap_an_TNMaker_2025.xlsx into structured answer keys per exam code.
    Correctly indexes:
    - Part I: questions 1..N
    - Part II: questions 1..M (reset counter to 1 for Part II)
    - Part III: questions 1..K (reset counter to 1 for Part III)
    """
    wb = openpyxl.load_workbook(BytesIO(file_bytes), data_only=True)
    sheet = wb.active

    rows = list(sheet.iter_rows(values_only=True))
    if not rows or len(rows) < 2:
        raise ValueError("File Excel đáp án rỗng hoặc không đúng định dạng.")

    header = rows[0]
    exam_codes = [str(c).strip() for c in header[1:] if c is not None]

    keys_by_code: Dict[str, Dict[str, Any]] = {
        code: {"part1": {}, "part2": {}, "part3": {}} for code in exam_codes
    }

    p1_counter = 0
    p2_counter = 0
    p3_counter = 0

    for row in rows[1:]:
        if not row or row[0] is None:
            continue

        # Look at the first valid cell in the row to determine row part type
        row_type = None
        for col_idx in range(len(exam_codes)):
            val = row[col_idx + 1] if col_idx + 1 < len(row) else None
            if val is not None:
                val_s = str(val).strip()
                if len(val_s) == 1 and val_s.upper() in ['A', 'B', 'C', 'D']:
                    row_type = 'p1'
                    break
                elif len(val_s) == 4 and all(c.upper() in ['Đ', 'S', 'D', 'T', '1', '0'] for c in val_s):
                    row_type = 'p2'
                    break
                else:
                    row_type = 'p3'
                    break

        if row_type == 'p1':
            p1_counter += 1
            q_num = p1_counter
            for col_idx, code in enumerate(exam_codes):
                val = row[col_idx + 1] if col_idx + 1 < len(row) else None
                if val is not None:
                    keys_by_code[code]["part1"][q_num] = str(val).strip().upper()

        elif row_type == 'p2':
            p2_counter += 1
            q_num = p2_counter
            for col_idx, code in enumerate(exam_codes):
                val = row[col_idx + 1] if col_idx + 1 < len(row) else None
                if val is not None:
                    val_s = str(val).strip()
                    norm_p2 = "".join(['Đ' if c.upper() in ['Đ', 'D', 'T', '1'] else 'S' for c in val_s])
                    keys_by_code[code]["part2"][q_num] = norm_p2

        elif row_type == 'p3':
            p3_counter += 1
            q_num = p3_counter
            for col_idx, code in enumerate(exam_codes):
                val = row[col_idx + 1] if col_idx + 1 < len(row) else None
                if val is not None:
                    keys_by_code[code]["part3"][q_num] = str(val).strip().replace('.', ',')

    return keys_by_code


def generate_sample_answer_template(
    max_p1: int = 12,
    max_p2: int = 4,
    max_p3: int = 6,
    exam_codes: Optional[List[str]] = None,
) -> bytes:
    """
    Generate a clean, standardized Excel sample template for answer keys (TNMaker 2025 format).
    Teachers can download, modify answers, and upload back to the system.
    """
    if not exam_codes:
        exam_codes = ['101', '102', '103', '104']

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Dữ liệu"

    # Fonts & Styles
    font_header = Font(name="Arial", size=11, bold=True, color="FFFFFF")
    font_data = Font(name="Arial", size=10)
    font_bold = Font(name="Arial", size=10, bold=True)
    font_note = Font(name="Arial", size=9, italic=True, color="64748B")

    fill_header = PatternFill(start_color="1E40AF", end_color="1E40AF", fill_type="solid")
    fill_p1 = PatternFill(start_color="EFF6FF", end_color="EFF6FF", fill_type="solid")
    fill_p2 = PatternFill(start_color="F0FDF4", end_color="F0FDF4", fill_type="solid")
    fill_p3 = PatternFill(start_color="FFFBEB", end_color="FFFBEB", fill_type="solid")

    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    align_center = Alignment(horizontal='center', vertical='center')

    # Header Row
    header_vals = ['Câu\\Mã đề'] + exam_codes
    ws.append(header_vals)
    ws.row_dimensions[1].height = 28

    for col_idx in range(1, len(header_vals) + 1):
        c = ws.cell(row=1, column=col_idx)
        c.font = font_header
        c.fill = fill_header
        c.alignment = align_center
        c.border = thin_border

    current_row = 2
    row_count = 1

    # Part I: max_p1 questions (A, B, C, D)
    sample_opts = ['A', 'B', 'C', 'D']
    for i in range(1, max_p1 + 1):
        row_data = [row_count]
        for c_idx in range(len(exam_codes)):
            row_data.append(sample_opts[(i + c_idx - 1) % 4])
        ws.append(row_data)
        for col_idx in range(1, len(header_vals) + 1):
            cell = ws.cell(row=current_row, column=col_idx)
            cell.font = font_data
            cell.alignment = align_center
            cell.border = thin_border
            cell.fill = fill_p1
        current_row += 1
        row_count += 1

    # Part II: max_p2 questions (ĐSĐS, SĐĐS, ...)
    sample_p2 = ['ĐSĐS', 'SĐĐS', 'ĐĐSS', 'SĐSĐ', 'ĐSĐĐ', 'SĐSS', 'ĐĐĐS', 'SSSS']
    for i in range(1, max_p2 + 1):
        row_data = [row_count]
        for c_idx in range(len(exam_codes)):
            row_data.append(sample_p2[(i + c_idx - 1) % len(sample_p2)])
        ws.append(row_data)
        for col_idx in range(1, len(header_vals) + 1):
            cell = ws.cell(row=current_row, column=col_idx)
            cell.font = font_data
            cell.alignment = align_center
            cell.border = thin_border
            cell.fill = fill_p2
        current_row += 1
        row_count += 1

    # Part III: max_p3 questions (numbers)
    sample_p3 = ['446', '-12,5', '3,14', '0,25', '-1', '100']
    for i in range(1, max_p3 + 1):
        row_data = [row_count]
        for c_idx in range(len(exam_codes)):
            row_data.append(sample_p3[(i + c_idx - 1) % len(sample_p3)])
        ws.append(row_data)
        for col_idx in range(1, len(header_vals) + 1):
            cell = ws.cell(row=current_row, column=col_idx)
            cell.font = font_data
            cell.alignment = align_center
            cell.border = thin_border
            cell.fill = fill_p3
        current_row += 1
        row_count += 1

    # Instructions at the right
    ws.cell(row=2, column=len(header_vals) + 2, value="HƯỚNG DẪN NHẬP ĐÁP ÁN:").font = font_bold
    ws.cell(row=3, column=len(header_vals) + 2, value=f"- Phần I ({max_p1} câu đầu): Nhập 1 ký tự A, B, C hoặc D.").font = font_note
    ws.cell(row=4, column=len(header_vals) + 2, value=f"- Phần II ({max_p2} câu tiếp): Nhập chuỗi 4 ký tự Đ/S theo 4 ý a,b,c,d (VD: ĐSĐS).").font = font_note
    ws.cell(row=5, column=len(header_vals) + 2, value=f"- Phần III ({max_p3} câu cuối): Nhập số (dấu phẩy thập phân, VD: -12,5 hoặc 446).").font = font_note
    ws.cell(row=6, column=len(header_vals) + 2, value="- Có thể thêm/sửa/xóa các cột mã đề tùy ý.").font = font_note

    # Column widths
    ws.column_dimensions['A'].width = 14
    for c_idx in range(len(exam_codes)):
        col_letter = openpyxl.utils.get_column_letter(c_idx + 2)
        ws.column_dimensions[col_letter].width = 16

    out = BytesIO()
    wb.save(out)
    return out.getvalue()


def _populate_grade_sheet(
    ws,
    exam_title: str,
    submissions: List[Dict[str, Any]],
    teacher_name: Optional[str] = None,
    class_name: Optional[str] = None,
):
    font_title = Font(name="Arial", size=13, bold=True, color="1B365D")
    font_subinfo = Font(name="Arial", size=10, italic=True, color="475569")
    font_header = Font(name="Arial", size=10, bold=True, color="FFFFFF")
    font_data = Font(name="Arial", size=10)
    font_bold = Font(name="Arial", size=10, bold=True)

    fill_header = PatternFill(start_color="1E40AF", end_color="1E40AF", fill_type="solid")
    fill_even = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    fill_highlight = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")

    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    align_center = Alignment(horizontal='center', vertical='center')
    align_left = Alignment(horizontal='left', vertical='center')
    align_right = Alignment(horizontal='right', vertical='center')

    # Row 1: Title
    ws.merge_cells("A1:I1")
    ws["A1"] = f"BẢNG ĐIỂM CHẤM TRẮC NGHIỆM - {exam_title.upper() if exam_title else 'KỲ THI 2025'}"
    ws["A1"].font = font_title
    ws["A1"].alignment = align_center
    ws.row_dimensions[1].height = 32

    # Row 2: Sub-info (Teacher, Class, Total count)
    info_parts = []
    if teacher_name:
        info_parts.append(f"Giáo viên chấm: {teacher_name}")
    info_parts.append(f"Lớp: {class_name if class_name else 'Tất cả các lớp'}")
    info_parts.append(f"Sĩ số đã chấm: {len(submissions)} bài")

    ws.merge_cells("A2:I2")
    ws["A2"] = "   |   ".join(info_parts)
    ws["A2"].font = font_subinfo
    ws["A2"].alignment = align_center
    ws.row_dimensions[2].height = 20

    # Row 4: Column Headers
    headers = [
        "STT", "Lớp", "Số báo danh", "Mã đề",
        "Điểm Phần I", "Điểm Phần II", "Điểm Phần III",
        "Tổng điểm", "Ghi chú"
    ]
    ws.append([])
    ws.append(headers)
    ws.row_dimensions[4].height = 26

    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=4, column=col_num)
        cell.font = font_header
        cell.fill = fill_header
        cell.alignment = align_center
        cell.border = thin_border

    # Sort: class_name then sbd
    sorted_subs = sorted(
        submissions,
        key=lambda s: (str(s.get('class_name', '')), str(s.get('sbd', '')))
    )

    row_idx = 5
    for idx, sub in enumerate(sorted_subs, 1):
        c_name = sub.get('class_name', '') or ''
        sbd = sub.get('sbd', '')
        exam_code = sub.get('exam_code', '')
        grading = sub.get('grading', {})
        p1 = grading.get('part1_score', 0.0)
        p2 = grading.get('part2_score', 0.0)
        p3 = grading.get('part3_score', 0.0)
        total = grading.get('total_score', 0.0)
        uncertain = sub.get('uncertain_questions', [])
        note = f"Nghi ngờ: {', '.join(uncertain)}" if uncertain else ""

        ws.append([
            idx, c_name, sbd, exam_code,
            p1, p2, p3, total, note
        ])
        ws.row_dimensions[row_idx].height = 20

        is_even = (idx % 2 == 0)
        for col_num in range(1, 10):
            c = ws.cell(row=row_idx, column=col_num)
            c.font = font_bold if col_num == 8 else font_data
            c.border = thin_border
            if col_num in [1, 2, 3, 4]:
                c.alignment = align_center
            elif col_num in [5, 6, 7, 8]:
                c.alignment = align_right
                c.number_format = '0.00'
            else:
                c.alignment = align_left

            if uncertain:
                c.fill = fill_highlight
            elif is_even:
                c.fill = fill_even

        row_idx += 1

    col_widths = [7, 12, 16, 12, 14, 14, 14, 14, 25]
    for col_idx, width in enumerate(col_widths, 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = width


def export_gradebook_excel(
    exam_title: str,
    submissions: List[Dict[str, Any]],
    teacher_name: Optional[str] = None,
    class_name: Optional[str] = None,
) -> bytes:
    """
    Export graded submissions into a clean, formatted Excel file (Bang_diem.xlsx).
    Supports filtering by class, including teacher name, and creating separate tabs per class.
    """
    wb = openpyxl.Workbook()

    if class_name:
        # Filter submissions for specific class only
        target_subs = [
            s for s in submissions
            if str(s.get('class_name', '')).strip().lower() == str(class_name).strip().lower()
        ]
        ws = wb.active
        ws.title = f"Lớp {class_name}"[:31]
        _populate_grade_sheet(ws, exam_title, target_subs, teacher_name, class_name)
    else:
        # All classes
        ws_all = wb.active
        ws_all.title = "Tổng hợp"
        _populate_grade_sheet(ws_all, exam_title, submissions, teacher_name, "Tất cả các lớp")

        # Check if there are distinct classes
        distinct_classes = sorted(list({
            str(s.get('class_name', '')).strip()
            for s in submissions
            if str(s.get('class_name', '')).strip()
        }))

        if len(distinct_classes) > 1:
            for c_name in distinct_classes:
                class_subs = [
                    s for s in submissions
                    if str(s.get('class_name', '')).strip() == c_name
                ]
                safe_title = f"Lớp {c_name}"[:31]
                ws_class = wb.create_sheet(title=safe_title)
                _populate_grade_sheet(ws_class, exam_title, class_subs, teacher_name, c_name)

    out = BytesIO()
    wb.save(out)
    return out.getvalue()


# ==============================================================
# Supabase Cloud Sync Functions
# ==============================================================

def list_exams_supabase(teacher_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """List all saved exams from Supabase table grade_exams, optionally filtered by teacher_id."""
    url, key = get_supabase_config()
    if not url or not key:
        return []

    headers = {'apikey': key, 'Authorization': f'Bearer {key}'}
    try:
        r = requests.get(
            f'{url}/rest/v1/grade_exams?select=*&order=updated_at.desc',
            headers=headers,
            timeout=10
        )
        if r.status_code == 200:
            exams = r.json()
            if teacher_id:
                filtered = []
                for ex in exams:
                    cfg = ex.get('config') or {}
                    ex_tid = ex.get('teacher_id') or cfg.get('teacher_id')
                    # Include if teacher matches, or if exam is unassigned/public
                    if not ex_tid or ex_tid == teacher_id:
                        filtered.append(ex)
                return filtered
            return exams
        return []
    except Exception:
        return []


def save_exam_supabase(exam_data: Dict[str, Any]) -> Dict[str, Any]:
    """Upsert an exam to Supabase table grade_exams."""
    url, key = get_supabase_config()
    if not url or not key:
        raise ValueError("Chưa cấu hình SUPABASE_URL hoặc SUPABASE_SECRET_KEY.")

    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation,resolution=merge-duplicates'
    }

    config = dict(exam_data.get('config') or {'maxP1': 12, 'maxP2': 4, 'maxP3': 6})
    teacher_id = exam_data.get('teacher_id') or config.get('teacher_id')
    teacher_name = exam_data.get('teacher_name') or config.get('teacher_name')
    if teacher_id:
        config['teacher_id'] = teacher_id
    if teacher_name:
        config['teacher_name'] = teacher_name

    body = {
        'title': exam_data.get('title', 'Kỳ thi mới'),
        'sheet_type': exam_data.get('sheet_type', '2025_math'),
        'config': config,
        'answer_keys': exam_data.get('answer_keys', {}),
        'submissions': exam_data.get('submissions', []),
        'updated_at': 'now()',
    }
    if exam_data.get('id'):
        body['id'] = exam_data['id']

    body_with_cols = dict(body)
    if teacher_id:
        body_with_cols['teacher_id'] = teacher_id
    if teacher_name:
        body_with_cols['teacher_name'] = teacher_name

    r = requests.post(
        f'{url}/rest/v1/grade_exams',
        headers=headers,
        json=body_with_cols,
        timeout=15
    )
    if not r.ok:
        # If columns teacher_id or teacher_name don't exist in Supabase schema yet, retry without them
        if 'column' in r.text.lower() or r.status_code == 400:
            r = requests.post(
                f'{url}/rest/v1/grade_exams',
                headers=headers,
                json=body,
                timeout=15
            )
        if not r.ok:
            if r.status_code == 404:
                raise ValueError("Bảng `grade_exams` chưa được tạo trên Supabase. Vui lòng chạy file `supabase/grade_exams.sql` trong SQL Editor của Supabase.")
            raise ValueError(f"Không thể lưu lên Supabase (mã {r.status_code}): {r.text[:200]}")

    res = r.json()
    return res[0] if isinstance(res, list) and len(res) > 0 else res


def delete_exam_supabase(exam_id: str) -> bool:
    """Delete an exam from Supabase."""
    url, key = get_supabase_config()
    if not url or not key:
        raise ValueError("Chưa cấu hình SUPABASE_URL hoặc SUPABASE_SECRET_KEY.")

    headers = {'apikey': key, 'Authorization': f'Bearer {key}'}
    r = requests.delete(
        f'{url}/rest/v1/grade_exams?id=eq.{exam_id}',
        headers=headers,
        timeout=10
    )
    return r.ok
