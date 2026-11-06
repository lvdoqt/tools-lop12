"""
Registry and Geometry Provider for Multiple Answer Sheet Templates:
1. phieu_2025: Official MoET 2025 Standard Template (2328x3381) - phieu-cham-2025.pdf
2. tndo_a20: TN-DO A4 20-Question MCQ Template (1200x1697) - TNDO-A20-v2
3. tndo_a40: TN-DO A4 40-Question MCQ Template (1200x1697) - TNDO-A40-v2
4. tndo_3p_2026: TN-DO 2026 3-Part Template (1200x1697) - TNDO-3P-2026-v3
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    from .sheet_2025_template import (
        CANONICAL_HEIGHT as MOET_HEIGHT,
        CANONICAL_WIDTH as MOET_WIDTH,
        TARGET_BL as MOET_BL,
        TARGET_BR as MOET_BR,
        TARGET_TL as MOET_TL,
        TARGET_TR as MOET_TR,
        get_mdt_grid as moet_get_mdt_grid,
        get_part1_grid as moet_get_part1_grid,
        get_part2_grid as moet_get_part2_grid,
        get_part3_grid as moet_get_part3_grid,
        get_sbd_grid as moet_get_sbd_grid,
    )
except ImportError:
    from services.sheet_2025_template import (
        CANONICAL_HEIGHT as MOET_HEIGHT,
        CANONICAL_WIDTH as MOET_WIDTH,
        TARGET_BL as MOET_BL,
        TARGET_BR as MOET_BR,
        TARGET_TL as MOET_TL,
        TARGET_TR as MOET_TR,
        get_mdt_grid as moet_get_mdt_grid,
        get_part1_grid as moet_get_part1_grid,
        get_part2_grid as moet_get_part2_grid,
        get_part3_grid as moet_get_part3_grid,
        get_sbd_grid as moet_get_sbd_grid,
    )

# Locate templates directory
BASE_DIR = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = BASE_DIR / "assets" / "templates"
EXT_TEMPLATES_DIR = Path("D:/tools/phieu-cham")


class SheetTemplate:
    def __init__(
        self,
        template_id: str,
        name: str,
        short_name: str,
        description: str,
        canonical_width: int,
        canonical_height: int,
        target_anchors: List[Tuple[float, float]],
        sbd_cols: int,
        mdt_cols: int,
        default_config: Dict[str, int],
        pdf_path: str,
        bubble_radius: float = 14.0,
        json_file: Optional[str] = None,
    ):
        self.id = template_id
        self.name = name
        self.short_name = short_name
        self.description = description
        self.canonical_width = canonical_width
        self.canonical_height = canonical_height
        self.target_anchors = target_anchors  # [TL, TR, BR, BL]
        self.sbd_cols = sbd_cols
        self.mdt_cols = mdt_cols
        self.default_config = default_config
        self.pdf_path = pdf_path
        self.bubble_radius = bubble_radius
        self.json_file = json_file
        self._cached_data: Optional[Dict[str, Any]] = None

    def _get_json_data(self) -> Optional[Dict[str, Any]]:
        if self._cached_data is not None:
            return self._cached_data
        if not self.json_file:
            return None

        # Search candidates
        candidates = [
            TEMPLATES_DIR / self.json_file,
            EXT_TEMPLATES_DIR / self.json_file,
            Path("D:/tools") / self.json_file,
        ]
        for p in candidates:
            if p.exists():
                with open(p, "r", encoding="utf-8") as f:
                    self._cached_data = json.load(f)
                    return self._cached_data
        return None

    def get_sbd_grid(self) -> Dict[int, List[Tuple[int, float, float, float]]]:
        raise NotImplementedError

    def get_mdt_grid(self) -> Dict[int, List[Tuple[int, float, float, float]]]:
        raise NotImplementedError

    def get_part1_grid(self) -> Dict[int, Dict[str, Tuple[float, float, float]]]:
        raise NotImplementedError

    def get_part2_grid(self) -> Dict[int, Dict[str, Dict[str, Tuple[float, float, float]]]]:
        raise NotImplementedError

    def get_part3_grid(self) -> Dict[int, Dict[str, Any]]:
        raise NotImplementedError


# -------------------------------------------------------------------------
# 1. MoET 2025 Standard Template Implementation
# -------------------------------------------------------------------------
class MoET2025Template(SheetTemplate):
    def __init__(self):
        pdf_candidate = TEMPLATES_DIR / "phieu-cham-2025.pdf"
        if not pdf_candidate.exists():
            pdf_candidate = Path("D:/tools/phieu-cham-2025.pdf")

        super().__init__(
            template_id="2025_standard",
            name="Phiếu chuẩn Bộ GD&ĐT 2025 (3 phần)",
            short_name="Bộ GD&ĐT 2025",
            description="Phiếu trả lời trắc nghiệm chuẩn kỳ thi tốt nghiệp THPT từ năm 2025 (40 câu MCQ + 8 câu Đ/S + 6 câu Trả lời ngắn)",
            canonical_width=MOET_WIDTH,
            canonical_height=MOET_HEIGHT,
            target_anchors=[MOET_TL, MOET_TR, MOET_BR, MOET_BL],
            sbd_cols=8,
            mdt_cols=4,
            default_config={"maxP1": 12, "maxP2": 4, "maxP3": 6},
            pdf_path=str(pdf_candidate),
            bubble_radius=18.0,
        )

    def get_sbd_grid(self):
        return moet_get_sbd_grid()

    def get_mdt_grid(self):
        return moet_get_mdt_grid()

    def get_part1_grid(self):
        return moet_get_part1_grid()

    def get_part2_grid(self):
        return moet_get_part2_grid()

    def get_part3_grid(self):
        return moet_get_part3_grid()


# -------------------------------------------------------------------------
# 2, 3, 4. JSON-Based TNDO Template Implementation
# -------------------------------------------------------------------------
class JsonDrivenTemplate(SheetTemplate):
    def __init__(
        self,
        template_id: str,
        name: str,
        short_name: str,
        description: str,
        json_filename: str,
        pdf_filename: str,
        sbd_cols: int,
        mdt_cols: int,
        default_config: Dict[str, int],
    ):
        pdf_candidate = TEMPLATES_DIR / pdf_filename
        if not pdf_candidate.exists():
            pdf_candidate = EXT_TEMPLATES_DIR / pdf_filename

        # TNDO canonical size is 1200x1697
        anchors = [
            (157.857, 157.844),  # TL
            (1042.143, 157.844), # TR
            (1042.143, 1539.156),# BR
            (157.857, 1539.156), # BL
        ]

        super().__init__(
            template_id=template_id,
            name=name,
            short_name=short_name,
            description=description,
            canonical_width=1200,
            canonical_height=1697,
            target_anchors=anchors,
            sbd_cols=sbd_cols,
            mdt_cols=mdt_cols,
            default_config=default_config,
            pdf_path=str(pdf_candidate),
            bubble_radius=11.0,
            json_file=json_filename,
        )

    def get_sbd_grid(self) -> Dict[int, List[Tuple[int, float, float, float]]]:
        data = self._get_json_data() or {}
        w, h = self.canonical_width, self.canonical_height
        grid = {}
        for col_idx, col in enumerate(data.get("student_region", [])):
            grid[col_idx] = []
            for b in col:
                grid[col_idx].append((
                    int(b["label"]),
                    float(b["x"] * w),
                    float(b["y"] * h),
                    float(b["radius"] * w),
                ))
        return grid

    def get_mdt_grid(self) -> Dict[int, List[Tuple[int, float, float, float]]]:
        data = self._get_json_data() or {}
        w, h = self.canonical_width, self.canonical_height
        grid = {}
        for col_idx, col in enumerate(data.get("code_region", [])):
            grid[col_idx] = []
            for b in col:
                grid[col_idx].append((
                    int(b["label"]),
                    float(b["x"] * w),
                    float(b["y"] * h),
                    float(b["radius"] * w),
                ))
        return grid

    def get_part1_grid(self) -> Dict[int, Dict[str, Tuple[float, float, float]]]:
        data = self._get_json_data() or {}
        w, h = self.canonical_width, self.canonical_height
        grid = {}
        for q in data.get("questions", []):
            if q.get("section") == "mcq":
                q_num = q["number"]
                grid[q_num] = {}
                for b in q.get("bubbles", []):
                    grid[q_num][b["label"]] = (
                        float(b["x"] * w),
                        float(b["y"] * h),
                        float(b["radius"] * w),
                    )
        return grid

    def get_part2_grid(self) -> Dict[int, Dict[str, Dict[str, Tuple[float, float, float]]]]:
        data = self._get_json_data() or {}
        w, h = self.canonical_width, self.canonical_height
        grid = {}
        for q in data.get("questions", []):
            if q.get("section") == "true_false":
                # Normalize question number to relative 1..8
                rel_num = q["number"] - 40 if q["number"] > 40 else q["number"]
                grid[rel_num] = {}
                for item in q.get("true_false_items", []):
                    lbl = item["label"]
                    grid[rel_num][lbl] = {
                        "Đ": (
                            float(item["true"]["x"] * w),
                            float(item["true"]["y"] * h),
                            float(item["true"]["radius"] * w),
                        ),
                        "S": (
                            float(item["false"]["x"] * w),
                            float(item["false"]["y"] * h),
                            float(item["false"]["radius"] * w),
                        ),
                    }
        return grid

    def get_part3_grid(self) -> Dict[int, Dict[str, Any]]:
        data = self._get_json_data() or {}
        w, h = self.canonical_width, self.canonical_height
        grid = {}
        for q in data.get("questions", []):
            if q.get("section") == "short_answer":
                rel_num = q["number"] - 48 if q["number"] > 48 else q["number"]
                sa = q.get("short_answer", {})
                cols = []
                for col in sa.get("columns", []):
                    col_digits = []
                    for b in col:
                        col_digits.append((
                            int(b["label"]),
                            float(b["x"] * w),
                            float(b["y"] * h),
                            float(b["radius"] * w),
                        ))
                    cols.append(col_digits)

                neg = sa.get("negative", {})
                decimals = sa.get("decimal", [])
                c1 = decimals[0] if len(decimals) > 0 else None
                c2 = decimals[1] if len(decimals) > 1 else None

                grid[rel_num] = {
                    "minus": (
                        float(neg.get("x", 0) * w),
                        float(neg.get("y", 0) * h),
                        float(neg.get("radius", 0.0055) * w),
                    ),
                    "comma_1": (
                        float(c1["x"] * w) if c1 else 0.0,
                        float(c1["y"] * h) if c1 else 0.0,
                        float(c1["radius"] * w) if c1 else 0.0,
                    ),
                    "comma_2": (
                        float(c2["x"] * w) if c2 else 0.0,
                        float(c2["y"] * h) if c2 else 0.0,
                        float(c2["radius"] * w) if c2 else 0.0,
                    ),
                    "columns": cols,
                }
        return grid


# -------------------------------------------------------------------------
# Template Registry Instances
# -------------------------------------------------------------------------
TEMPLATES: Dict[str, SheetTemplate] = {
    # 1. MoET 2025 Official Standard
    "2025_standard": MoET2025Template(),

    # 2. TN-DO A4 20 questions
    "tndo_a20": JsonDrivenTemplate(
        template_id="tndo_a20",
        name="Phiếu TN - DO · A4 20 câu",
        short_name="TN-DO A4 20 câu",
        description="Phiếu A4 chuẩn 20 câu trắc nghiệm (A, B, C, D) với SBD 6 số và Mã đề 3 số",
        json_filename="TNDO-A20-v2.json",
        pdf_filename="TNDO-A20-v2.pdf",
        sbd_cols=6,
        mdt_cols=3,
        default_config={"maxP1": 20, "maxP2": 0, "maxP3": 0},
    ),

    # 3. TN-DO A4 40 questions
    "tndo_a40": JsonDrivenTemplate(
        template_id="tndo_a40",
        name="Phiếu TN - DO · A4 40 câu",
        short_name="TN-DO A4 40 câu",
        description="Phiếu A4 chuẩn 40 câu trắc nghiệm (A, B, C, D) với SBD 6 số và Mã đề 3 số",
        json_filename="TNDO-A40-v2.json",
        pdf_filename="TNDO-A40-v2.pdf",
        sbd_cols=6,
        mdt_cols=3,
        default_config={"maxP1": 40, "maxP2": 0, "maxP3": 0},
    ),

    # 4. TN-DO 2026 3 Parts
    "tndo_3p_2026": JsonDrivenTemplate(
        template_id="tndo_3p_2026",
        name="Phiếu TN - DO 2026 (3 phần)",
        short_name="TN-DO 2026 3 phần",
        description="Phiếu chuẩn cấu trúc 3 phần mới: 40 câu MCQ + 8 câu Đúng/Sai + 6 câu Trả lời ngắn, SBD 8 số, Mã đề 4 số",
        json_filename="TNDO-3P-2026-v3.json",
        pdf_filename="TNDO-3P-2026-v3.pdf",
        sbd_cols=8,
        mdt_cols=4,
        default_config={"maxP1": 40, "maxP2": 8, "maxP3": 6},
    ),
}

# Aliases for backward compatibility and UX flexibility
ALIASES: Dict[str, str] = {
    "2025_math": "2025_standard",
    "2025_full": "2025_standard",
    "2025_custom": "2025_standard",
    "phieu_2025": "2025_standard",
    "moet_2025": "2025_standard",
    "tndo-a20": "tndo_a20",
    "a20": "tndo_a20",
    "tndo-a40": "tndo_a40",
    "a40": "tndo_a40",
    "tndo-3p-2026": "tndo_3p_2026",
    "3p_2026": "tndo_3p_2026",
}


def get_sheet_template(sheet_type: Optional[str] = None) -> SheetTemplate:
    """Resolve and return a SheetTemplate by key or alias, defaulting to 2025_standard."""
    if not sheet_type:
        return TEMPLATES["2025_standard"]

    norm = str(sheet_type).strip().lower().replace(" ", "_")
    resolved_id = ALIASES.get(norm, norm)
    if resolved_id in TEMPLATES:
        return TEMPLATES[resolved_id]

    # Partial match fallback
    for key, tmpl in TEMPLATES.items():
        if key in norm or norm in key:
            return tmpl

    return TEMPLATES["2025_standard"]


def list_sheet_templates() -> List[Dict[str, Any]]:
    """Return serialized list of all supported templates for frontend dropdown."""
    result = []
    # Ordering: 2025_math first, then 3 new TNDO sheets, then full
    custom_order = ["2025_standard", "tndo_a20", "tndo_a40", "tndo_3p_2026"]
    for tid in custom_order:
        t = TEMPLATES[tid]
        result.append({
            "id": t.id,
            "name": t.name,
            "short_name": t.short_name,
            "description": t.description,
            "canonical_width": t.canonical_width,
            "canonical_height": t.canonical_height,
            "sbd_cols": t.sbd_cols,
            "mdt_cols": t.mdt_cols,
            "default_config": t.default_config,
            "has_part2": len(t.get_part2_grid()) > 0,
            "has_part3": len(t.get_part3_grid()) > 0,
        })
    return result

