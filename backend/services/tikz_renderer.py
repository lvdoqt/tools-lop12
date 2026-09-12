"""Render TikZ source through LaTeX.Online and create preview assets."""

from pathlib import Path
import re
from urllib.parse import urlencode

import pymupdf
import requests


LATEX_ONLINE_URL = "https://latexonline.cc/compile"
MAX_SOURCE_LENGTH = 20_000
PGFPLOTS_COMPAT_VERSION = (1, 14)


def normalize_source(source: str) -> str:
    """Make pasted TikZ suitable for the LaTeX.Online compiler."""
    # Code fences frequently arrive when a TikZ example is copied from Markdown.
    source = re.sub(r"(?m)^\s*```[\w+-]*\s*$", "", source)

    def cap_pgfplots_compat(match: re.Match) -> str:
        requested = (int(match.group(2)), int(match.group(3)))
        if requested > PGFPLOTS_COMPAT_VERSION:
            return f"{match.group(1)}{PGFPLOTS_COMPAT_VERSION[0]}.{PGFPLOTS_COMPAT_VERSION[1]}{match.group(4)}"
        return match.group(0)

    return re.sub(
        r"(\\pgfplotsset\s*\{\s*compat\s*=\s*)(\d+)\.(\d+)(\s*\})",
        cap_pgfplots_compat,
        source,
    )


def build_document(source: str) -> str:
    source = normalize_source(source).strip()
    if "\\documentclass" in source:
        return source
    return """\\documentclass[tikz,border=10pt]{standalone}
\\usepackage[T5]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage[vietnamese]{babel}
\\usepackage{amsmath,amssymb}
\\usetikzlibrary{arrows.meta,automata,backgrounds,calc,decorations.pathmorphing,intersections,matrix,patterns,positioning,shapes.geometric}
\\begin{document}
%s
\\end{document}
""" % source


def render_tikz(source: str, output_dir: Path, output_id: str, dpi: int = 180) -> dict:
    if not source.strip():
        raise ValueError("Mã TikZ không được để trống.")
    if len(source) > MAX_SOURCE_LENGTH:
        raise ValueError(f"Mã TikZ vượt quá giới hạn {MAX_SOURCE_LENGTH:,} ký tự.")

    document = build_document(source)
    params = urlencode({"text": document, "command": "pdflatex", "download": "diagram.pdf"})
    try:
        response = requests.get(f"{LATEX_ONLINE_URL}?{params}", timeout=45)
    except requests.RequestException as exc:
        raise RuntimeError("Không thể kết nối dịch vụ biên dịch TikZ.") from exc

    content_type = response.headers.get("content-type", "").lower()
    if response.status_code != 200 or "pdf" not in content_type:
        detail = response.text[:1200].strip() if "text" in content_type else ""
        raise ValueError(detail or "Biên dịch thất bại. Hãy kiểm tra cú pháp và các gói TikZ đang dùng.")

    pdf_path = output_dir / f"{output_id}.pdf"
    png_path = output_dir / f"{output_id}.png"
    tex_path = output_dir / f"{output_id}.tex"
    pdf_path.write_bytes(response.content)
    tex_path.write_text(document, encoding="utf-8")

    with pymupdf.open(pdf_path) as pdf:
        if not pdf.page_count:
            raise ValueError("Kết quả biên dịch không có trang nào.")
        page = pdf[0]
        pixmap = page.get_pixmap(matrix=pymupdf.Matrix(dpi / 72, dpi / 72), alpha=True)
        pixmap.save(png_path)

    return {
        "output_id": output_id,
        "pdf_size": pdf_path.stat().st_size,
        "png_size": png_path.stat().st_size,
        "source": document,
    }
