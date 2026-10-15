"""
PDF Header Service
Adds custom text headers (with Vietnamese UTF-8 font support, alignment, 
page number variables, and separator lines) to PDF documents.
"""

from io import BytesIO
from pathlib import Path
import re
import pymupdf

_CACHED_FONT_BYTES: bytes | None = None


def get_font_bytes() -> bytes | None:
    """Load and cache a TrueType font that supports Vietnamese Unicode."""
    global _CACHED_FONT_BYTES
    if _CACHED_FONT_BYTES is not None:
        return _CACHED_FONT_BYTES

    # Check bundled font first
    bundled = Path(__file__).resolve().parent.parent / "assets" / "fonts" / "arial.ttf"
    if bundled.exists():
        try:
            _CACHED_FONT_BYTES = bundled.read_bytes()
            return _CACHED_FONT_BYTES
        except Exception:
            pass

    # Windows fonts
    for name in ["arial.ttf", "tahoma.ttf", "calibri.ttf", "times.ttf", "segoeui.ttf"]:
        win_path = Path("C:/Windows/Fonts") / name
        if win_path.exists():
            try:
                _CACHED_FONT_BYTES = win_path.read_bytes()
                return _CACHED_FONT_BYTES
            except Exception:
                continue

    # Linux fonts
    linux_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
        "/usr/share/fonts/truetype/msttcorefonts/Arial.ttf",
    ]
    for lp in linux_paths:
        p = Path(lp)
        if p.exists():
            try:
                _CACHED_FONT_BYTES = p.read_bytes()
                return _CACHED_FONT_BYTES
            except Exception:
                continue

    return None


def parse_hex_color(hex_str: str, default: tuple[float, float, float] = (0.2, 0.2, 0.2)) -> tuple[float, float, float]:
    """Convert hex string (e.g. #333333 or #1d4ed8) to PyMuPDF RGB float tuple (0.0 - 1.0)."""
    if not hex_str:
        return default
    clean = hex_str.strip().lstrip("#")
    if len(clean) == 3:
        clean = "".join(c * 2 for c in clean)
    if len(clean) == 6:
        try:
            r = int(clean[0:2], 16) / 255.0
            g = int(clean[2:4], 16) / 255.0
            b = int(clean[4:6], 16) / 255.0
            return (r, g, b)
        except ValueError:
            pass
    return default


def parse_page_selection(mode: str, total_pages: int, custom_str: str | None = None) -> set[int]:
    """Compute 1-based page numbers that should receive the header."""
    if mode == "skip_first":
        return set(range(2, total_pages + 1))
    if mode == "first_only":
        return {1} if total_pages >= 1 else set()
    if mode == "custom" and custom_str:
        pages: set[int] = set()
        for token in re.split(r"[,;]+", custom_str):
            token = token.strip()
            if not token:
                continue
            if "-" in token:
                parts = token.split("-", 1)
                try:
                    start_page = int(parts[0].strip())
                    end_page = int(parts[1].strip())
                    for p in range(max(1, start_page), min(total_pages, end_page) + 1):
                        pages.add(p)
                except ValueError:
                    continue
            else:
                try:
                    p = int(token)
                    if 1 <= p <= total_pages:
                        pages.add(p)
                except ValueError:
                    continue
        return pages or set(range(1, total_pages + 1))
    return set(range(1, total_pages + 1))


def add_pdf_header(
    pdf_bytes: bytes,
    text: str = "",
    align: str = "center",
    left_text: str | None = None,
    right_text: str | None = None,
    font_size: float = 10.0,
    color: str = "#333333",
    margin_top: float = 24.0,
    margin_x: float = 36.0,
    draw_line: bool = True,
    line_color: str = "#D1D5DB",
    pages_mode: str = "all",
    custom_pages: str | None = None,
    fill_white_bg: bool = False,
) -> tuple[bytes, int]:
    """
    Stamp header text onto PDF pages.
    Returns (result_pdf_bytes, modified_page_count).
    """
    text = (text or "").strip()
    left_text = (left_text or "").strip() or None
    right_text = (right_text or "").strip() or None

    if not text and not left_text and not right_text:
        raise ValueError("Vui lòng nhập nội dung văn bản header.")

    font_size = max(6.0, min(36.0, float(font_size)))
    margin_top = max(5.0, min(150.0, float(margin_top)))
    margin_x = max(5.0, min(200.0, float(margin_x)))

    text_rgb = parse_hex_color(color, (0.2, 0.2, 0.2))
    line_rgb = parse_hex_color(line_color, (0.8, 0.8, 0.8))

    align = align.lower().strip()
    if align not in ("left", "center", "right"):
        align = "center"

    font_bytes = get_font_bytes()
    font_name = "custom_header_font" if font_bytes else "helv"

    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    try:
        total_pages = doc.page_count
        if total_pages == 0:
            raise ValueError("File PDF không có trang nào.")

        target_pages = parse_page_selection(pages_mode, total_pages, custom_pages)
        if not target_pages:
            target_pages = set(range(1, total_pages + 1))

        box_height = max(font_size * 1.6, 18.0)

        for page_num in target_pages:
            if page_num < 1 or page_num > total_pages:
                continue
            page = doc[page_num - 1]
            page_w = page.rect.width
            page_h = page.rect.height

            # Avoid placing outside bounds if page is unexpectedly small
            effective_margin_x = min(margin_x, page_w * 0.4)
            effective_margin_top = min(margin_top, page_h * 0.3)

            # Register font on page if font_bytes present
            if font_bytes:
                try:
                    page.insert_font(fontname=font_name, fontbuffer=font_bytes)
                except Exception:
                    font_name = "helv"

            # Optional white background banner to mask existing underlying elements
            if fill_white_bg:
                banner_bottom = effective_margin_top + box_height + (6.0 if draw_line else 2.0)
                page.draw_rect(
                    pymupdf.Rect(0, 0, page_w, banner_bottom),
                    color=None,
                    fill=(1.0, 1.0, 1.0),
                )

            rect = pymupdf.Rect(
                effective_margin_x,
                effective_margin_top,
                page_w - effective_margin_x,
                effective_margin_top + box_height,
            )

            # Insert left text if any
            if left_text:
                l_formatted = left_text.replace("{page}", str(page_num)).replace("{total}", str(total_pages))
                page.insert_textbox(
                    rect,
                    l_formatted,
                    fontname=font_name,
                    fontsize=font_size,
                    color=text_rgb,
                    align=pymupdf.TEXT_ALIGN_LEFT,
                )

            # Insert right text if any
            if right_text:
                r_formatted = right_text.replace("{page}", str(page_num)).replace("{total}", str(total_pages))
                page.insert_textbox(
                    rect,
                    r_formatted,
                    fontname=font_name,
                    fontsize=font_size,
                    color=text_rgb,
                    align=pymupdf.TEXT_ALIGN_RIGHT,
                )

            # Insert main text
            if text:
                m_formatted = text.replace("{page}", str(page_num)).replace("{total}", str(total_pages))
                align_code = (
                    pymupdf.TEXT_ALIGN_CENTER
                    if align == "center"
                    else (pymupdf.TEXT_ALIGN_RIGHT if align == "right" else pymupdf.TEXT_ALIGN_LEFT)
                )
                page.insert_textbox(
                    rect,
                    m_formatted,
                    fontname=font_name,
                    fontsize=font_size,
                    color=text_rgb,
                    align=align_code,
                )

            # Draw separator line
            if draw_line:
                line_y = effective_margin_top + box_height + 3.0
                page.draw_line(
                    (effective_margin_x, line_y),
                    (page_w - effective_margin_x, line_y),
                    color=line_rgb,
                    width=0.65,
                )

        output_bytes = doc.tobytes(garbage=4, deflate=True)
        return output_bytes, len(target_pages)
    finally:
        doc.close()
