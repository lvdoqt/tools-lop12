"""
Grade Manager Service:
Handles Excel Answer Key importing (TNMaker 2025 format),
Exporting Gradebooks to Excel, and Session Management.
"""

from io import BytesIO
import json
from typing import Any, Dict, List, Optional
import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side


def parse_tnmaker_excel(file_bytes: bytes) -> Dict[str, Dict[str, Any]]:
    """
    Parse Dap_an_TNMaker_2025.xlsx into structured answer keys per exam code.
    Returns:
    {
      "101": {
         "part1": { 1: "A", 2: "B", ... },
         "part2": { 1: "ĐSĐS", 2: "SĐĐS", ... }, # or sub-dict
         "part3": { 1: "446", 2: "-12,5", ... }
      },
      ...
    }
    """
    wb = openpyxl.load_workbook(BytesIO(file_bytes), data_only=True)
    sheet = wb.active

    rows = list(sheet.iter_rows(values_only=True))
    if not rows or len(rows) < 2:
        raise ValueError("File Excel đáp án rỗng hoặc không đúng định dạng.")

    header = rows[0]
    # Header format: ['Câu\\Mã đề', '101', '102', ...]
    exam_codes = [str(c).strip() for c in header[1:] if c is not None]

    keys_by_code: Dict[str, Dict[str, Any]] = {
        code: {"part1": {}, "part2": {}, "part3": {}} for code in exam_codes
    }

    # Iterate rows for questions
    p1_idx = 1
    p2_idx = 1
    p3_idx = 1

    for row in rows[1:]:
        if not row or row[0] is None:
            continue
        q_label = str(row[0]).strip()

        # Check answers across exam codes
        for col_idx, code in enumerate(exam_codes):
            val = row[col_idx + 1]
            if val is None:
                continue
            val_str = str(val).strip()

            # Classify answer type:
            # If 1 char in ABCD -> Part I
            # If 4 chars composed of Đ, S, D, T, 0, 1 -> Part II
            # Else (digits, commas, minuses) -> Part III
            is_p1 = len(val_str) == 1 and val_str.upper() in ['A', 'B', 'C', 'D']
            is_p2 = len(val_str) == 4 and all(c.upper() in ['Đ', 'S', 'D', 'T', '1', '0'] for c in val_str)

            if is_p1:
                # Part I
                # Use sequential index or parse from q_label if integer
                q_num = int(q_label) if q_label.isdigit() else p1_idx
                keys_by_code[code]["part1"][q_num] = val_str.upper()
            elif is_p2:
                # Part II
                q_num = int(q_label) if q_label.isdigit() else p2_idx
                # Normalize to 'Đ' / 'S'
                norm_p2 = "".join(['Đ' if c.upper() in ['Đ', 'D', 'T', '1'] else 'S' for c in val_str])
                keys_by_code[code]["part2"][q_num] = norm_p2
            else:
                # Part III (numerical answer)
                q_num = int(q_label) if q_label.isdigit() else p3_idx
                keys_by_code[code]["part3"][q_num] = val_str.replace('.', ',')

    return keys_by_code


def export_gradebook_excel(
    exam_title: str,
    submissions: List[Dict[str, Any]],
) -> bytes:
    """
    Export graded submissions into a clean, formatted Excel file (Bang_diem.xlsx).
    Columns: STT, Số báo danh, Mã đề, Điểm Phần I, Điểm Phần II, Điểm Phần III, Tổng điểm, Ghi chú.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Bảng Điểm"

    # Styling
    font_title = Font(name="Arial", size=14, bold=True, color="1B365D")
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

    # Title Banner
    ws.merge_cells("A1:H1")
    ws["A1"] = f"BẢNG ĐIỂM CHẤM TRẮC NGHIỆM - {exam_title.upper() if exam_title else 'KỲ THI 2025'}"
    ws["A1"].font = font_title
    ws["A1"].alignment = align_center
    ws.row_dimensions[1].height = 35

    # Headers
    headers = [
        "STT", "Số báo danh", "Mã đề",
        "Điểm Phần I", "Điểm Phần II", "Điểm Phần III",
        "Tổng điểm", "Ghi chú"
    ]
    ws.append([]) # Row 2 empty
    ws.append(headers) # Row 3
    ws.row_dimensions[3].height = 26

    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=3, column=col_num)
        cell.font = font_header
        cell.fill = fill_header
        cell.alignment = align_center
        cell.border = thin_border

    # Sort submissions by SBD if present
    sorted_subs = sorted(submissions, key=lambda s: str(s.get('sbd', '')))

    row_idx = 4
    for idx, sub in enumerate(sorted_subs, 1):
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
            idx, sbd, exam_code,
            p1, p2, p3, total, note
        ])
        ws.row_dimensions[row_idx].height = 20

        # Style row cells
        is_even = (idx % 2 == 0)
        for col_num in range(1, 9):
            c = ws.cell(row=row_idx, column=col_num)
            c.font = font_bold if col_num == 7 else font_data
            c.border = thin_border
            if col_num in [1, 2, 3]:
                c.alignment = align_center
            elif col_num in [4, 5, 6, 7]:
                c.alignment = align_right
                c.number_format = '0.00'
            else:
                c.alignment = align_left

            if uncertain:
                c.fill = fill_highlight
            elif is_even:
                c.fill = fill_even

        row_idx += 1

    # Auto-fit column widths
    col_widths = [8, 16, 12, 14, 14, 14, 14, 25]
    for col_idx, width in enumerate(col_widths, 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = width

    out = BytesIO()
    wb.save(out)
    return out.getvalue()

