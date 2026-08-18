"""
Tools All — FastAPI Backend Server
Handles PDF conversion, Google Drive downloads, and more.
"""

import os
import uuid
import shutil
import tempfile
import logging
import urllib.parse
import unicodedata
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, JSONResponse
from pydantic import BaseModel

from services.pdf_converter import (
    get_pdf_info,
    generate_pdf_preview,
    run_conversion_async,
    run_save_text_async,
    extract_text_from_docx,
    extract_text_from_pdf,
)
from services.drive_downloader import (
    extract_file_id,
    detect_doc_type,
    get_file_info,
    generate_download_links,
    generate_export_link,
    download_file_proxy,
)

# ===== Config =====
UPLOAD_DIR = Path(tempfile.gettempdir()) / "tools_all_uploads"
OUTPUT_DIR = Path(tempfile.gettempdir()) / "tools_all_outputs"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create temp directories on startup, clean on shutdown."""
    UPLOAD_DIR.mkdir(exist_ok=True)
    OUTPUT_DIR.mkdir(exist_ok=True)
    logger.info(f"📁 Upload dir: {UPLOAD_DIR}")
    logger.info(f"📁 Output dir: {OUTPUT_DIR}")
    yield
    try:
        shutil.rmtree(UPLOAD_DIR, ignore_errors=True)
        shutil.rmtree(OUTPUT_DIR, ignore_errors=True)
    except Exception:
        pass


app = FastAPI(
    title="Tools All API",
    description="Backend API cho bộ công cụ xử lý file đa năng",
    version="2.1.0",
    lifespan=lifespan,
)

# CORS — allow all local origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===== Health Check =====
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "Tools All API 2.1 đang hoạt động 🚀"}


# ===================================================
#   PDF TO WORD ENDPOINTS
# ===================================================

@app.post("/api/pdf/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """Upload a PDF file and return file metadata & analysis."""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(400, "Chỉ hỗ trợ file PDF (.pdf)")

    # Save uploaded file
    file_id = str(uuid.uuid4())
    upload_path = UPLOAD_DIR / f"{file_id}.pdf"

    content = await file.read()
    if len(content) > 100 * 1024 * 1024:
        raise HTTPException(400, "File quá lớn (tối đa 100MB)")

    with open(upload_path, "wb") as f:
        f.write(content)

    # Get PDF metadata & structure analysis
    try:
        info = get_pdf_info(str(upload_path))
    except Exception as e:
        if upload_path.exists():
            os.remove(upload_path)
        raise HTTPException(400, f"Không thể phân tích PDF: {str(e)}")

    return {
        "file_id": file_id,
        "filename": file.filename,
        "size": len(content),
        "info": info,
    }


@app.get("/api/pdf/preview/{file_id}")
async def preview_pdf_page(
    file_id: str,
    page: int = Query(0, ge=0),
    dpi: int = Query(150, ge=72, le=300)
):
    """Get high-resolution preview image of any PDF page."""
    upload_path = UPLOAD_DIR / f"{file_id}.pdf"
    if not upload_path.exists():
        raise HTTPException(404, "File không tồn tại trên server")

    try:
        img_bytes = generate_pdf_preview(str(upload_path), page, dpi=dpi)
        return Response(
            content=img_bytes,
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=3600"}
        )
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/pdf/convert")
async def convert_pdf(
    file_id: str = Form(...),
    mode: str = Form("math_hd"),
    dpi: int = Form(250),
    page_range: str = Form("all"),
):
    """
    Convert PDF to Word document with specialized Math/Exam modes.
    Modes:
      - math_hd: Ultra-sharp math & geometry diagrams preservation (Recommended for Đề toán 12)
      - editable_text: Editable text & tables (pdf2docx)
      - hybrid: Editable text + extracted diagram pictures
    """
    upload_path = UPLOAD_DIR / f"{file_id}.pdf"
    if not upload_path.exists():
        raise HTTPException(404, "File PDF không tồn tại. Vui lòng upload lại.")

    output_id = str(uuid.uuid4())
    output_path = OUTPUT_DIR / f"{output_id}.docx"

    # Parse page range if specified
    pages_to_convert = None
    if page_range and page_range.lower() != "all":
        try:
            pages = []
            parts = page_range.split(",")
            for part in parts:
                part = part.strip()
                if "-" in part:
                    start_p, end_p = map(int, part.split("-"))
                    pages.extend(range(start_p - 1, end_p))
                elif part.isdigit():
                    pages.append(int(part) - 1)
            if pages:
                pages_to_convert = sorted(list(set(pages)))
        except Exception:
            pages_to_convert = None

    try:
        result = await run_conversion_async(
            pdf_path=str(upload_path),
            output_path=str(output_path),
            mode=mode,
            pages=pages_to_convert,
            dpi=dpi,
        )

        result["output_id"] = output_id
        result["file_id"] = file_id
        return result

    except Exception as e:
        if output_path.exists():
            os.remove(output_path)
        logger.error(f"Conversion error: {e}")
        raise HTTPException(500, f"Lỗi chuyển đổi: {str(e)}")


@app.get("/api/pdf/content/{output_id}")
async def get_word_content(output_id: str):
    """Get extracted text content of the converted Word document for preview/editing."""
    output_path = OUTPUT_DIR / f"{output_id}.docx"
    if not output_path.exists():
        raise HTTPException(404, "File Word không tồn tại hoặc đã hết hạn")

    text = extract_text_from_docx(str(output_path))
    return {
        "output_id": output_id,
        "text": text,
        "word_count": len(text.split()),
        "char_count": len(text),
    }


class SaveDocxRequest(BaseModel):
    text: str


@app.post("/api/pdf/save/{output_id}")
async def save_word_content(output_id: str, payload: SaveDocxRequest):
    """
    Save user-edited text back to the Word document (.docx) on server.
    """
    output_path = OUTPUT_DIR / f"{output_id}.docx"
    
    try:
        result = await run_save_text_async(str(output_path), payload.text)
        result["output_id"] = output_id
        return result
    except Exception as e:
        logger.error(f"Error saving edited docx: {e}")
        raise HTTPException(500, f"Lỗi lưu file Word: {str(e)}")


@app.get("/api/pdf/download/{output_id}")
async def download_word(output_id: str, filename: str = Query("document.docx")):
    """
    Download the converted/edited Word file with RFC 5987 safe filename encoding.
    Bypasses UnicodeEncodeError for Vietnamese names like 'Đề_thi_toán_12.docx'.
    """
    output_path = OUTPUT_DIR / f"{output_id}.docx"
    if not output_path.exists():
        raise HTTPException(404, "File không tồn tại hoặc đã hết hạn")

    # Encode filename safely for HTTP headers
    encoded_filename = urllib.parse.quote(filename.encode('utf-8'))
    # Strictly ascii fallback
    clean_ascii = unicodedata.normalize('NFKD', filename).encode('ascii', 'ignore').decode('ascii')
    safe_ascii_name = "".join(c for c in clean_ascii if c.isalnum() or c in "._- ") or "document.docx"

    return FileResponse(
        path=str(output_path),
        filename=safe_ascii_name,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f"attachment; filename=\"{safe_ascii_name}\"; filename*=UTF-8''{encoded_filename}"
        }
    )


# ===================================================
#   GOOGLE DRIVE DOWNLOADER ENDPOINTS
# ===================================================

@app.post("/api/drive/parse")
async def parse_drive_url(url: str = Form(...)):
    """Parse a Google Drive URL and return file ID + download links."""
    file_id = extract_file_id(url)
    if not file_id:
        raise HTTPException(400, "Link Google Drive không hợp lệ")

    doc_type = detect_doc_type(url)
    file_info = get_file_info(file_id)
    links = generate_download_links(file_id, url)

    return {
        "file_id": file_id,
        "doc_type": doc_type,
        "file_info": file_info,
        "download_links": links,
    }


@app.post("/api/drive/export-link")
async def get_export_link(
    url: str = Form(...),
    format: str = Form("pdf"),
):
    """Generate an export link for Google Docs/Sheets/Slides."""
    file_id = extract_file_id(url)
    if not file_id:
        raise HTTPException(400, "Link không hợp lệ")

    doc_type = detect_doc_type(url)
    export_url = generate_export_link(file_id, doc_type, format)

    return {
        "file_id": file_id,
        "doc_type": doc_type,
        "format": format,
        "export_url": export_url,
    }


@app.get("/api/drive/proxy-download/{file_id}")
async def proxy_download(file_id: str, method: str = Query("direct_v1")):
    """
    Proxy download a file from Google Drive through our server.
    Helps bypass CORS and some download restrictions.
    """
    try:
        file_bytes, filename, content_type = download_file_proxy(file_id, method)
        encoded_filename = urllib.parse.quote(filename.encode('utf-8'))
        clean_ascii = unicodedata.normalize('NFKD', filename).encode('ascii', 'ignore').decode('ascii')
        safe_ascii_name = "".join(c for c in clean_ascii if c.isalnum() or c in "._- ") or "file.bin"

        return Response(
            content=file_bytes,
            media_type=content_type,
            headers={
                "Content-Disposition": f"attachment; filename=\"{safe_ascii_name}\"; filename*=UTF-8''{encoded_filename}",
                "Content-Length": str(len(file_bytes)),
            }
        )
    except Exception as e:
        raise HTTPException(500, f"Tải thất bại: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
