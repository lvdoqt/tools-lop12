"""
Công cụ cho Toán — FastAPI Backend Server
Handles LaTeX/TikZ rendering and PDF tools.
"""

import uuid
import base64
from io import BytesIO
import tempfile
import logging
import zipfile
import json
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
import pymupdf

if __package__:
    from .services.tikz_renderer import render_tikz
    from .services.latex_quiz import parse_quiz
    from .services.quiz_svg import render_compat_svg
    from .services.cloudinary_upload import cloudinary_config, upload_svg
    from .services.quiz_word import validate_quiz, export_quiz
    from .services.word_shuffle import Exam, export_shuffle, MAX_UPLOAD
else:
    from services.tikz_renderer import render_tikz
    from services.latex_quiz import parse_quiz
    from services.quiz_svg import render_compat_svg
    from services.cloudinary_upload import cloudinary_config, upload_svg
    from services.quiz_word import validate_quiz, export_quiz
    from services.word_shuffle import Exam, export_shuffle, MAX_UPLOAD

MAX_PDF_BYTES = 4 * 1024 * 1024
MAX_RESPONSE_BYTES = 4 * 1024 * 1024
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def check_output_size(size: int):
    if size > MAX_RESPONSE_BYTES:
        raise HTTPException(413, "Kết quả vượt quá 4 MB. Hãy giảm số trang, giảm DPI hoặc chia thành nhiều lần xử lý.")


def pdf_response(content: bytes, file_format: str, pages: int, files: int = 1):
    check_output_size(len(content))
    media_type = "application/pdf" if file_format == "pdf" else "application/zip"
    return Response(content, media_type=media_type, headers={
        "Content-Disposition": f'attachment; filename="pdf-output.{file_format}"',
        "Cache-Control": "no-store",
        "X-PDF-Pages": str(pages),
        "X-PDF-Files": str(files),
    })


app = FastAPI(
    title="Công cụ cho Toán API",
    description="Backend API biên dịch LaTeX/TikZ và xử lý tài liệu PDF",
    version="2.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS — allow all local origins
if __package__:
    from .services.tikz_library import router as tikz_library_router
else:
    from services.tikz_library import router as tikz_library_router
app.include_router(tikz_library_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-PDF-Pages", "X-PDF-Files", "Content-Disposition"],
)


# ===== Health Check =====
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "Công cụ cho Toán API 2.1 đang hoạt động 🚀"}


# ===================================================
#   TIKZ RENDERER ENDPOINTS
# ===================================================

class TikzRenderRequest(BaseModel):
    source: str = Field(min_length=1, max_length=20_000)
    dpi: int = Field(default=180, ge=72, le=300)


@app.post("/api/tikz/render")
async def tikz_render(request: TikzRenderRequest):
    output_id = str(uuid.uuid4())
    try:
        # Each request owns its files. Nothing must survive a later invocation.
        with tempfile.TemporaryDirectory(prefix="tools-tikz-") as directory:
            output_dir = Path(directory)
            result = await run_in_threadpool(render_tikz, request.source, output_dir, output_id, request.dpi)
            assets = {}
            for file_format in ("png", "pdf", "tex", "svg"):
                path = output_dir / f"{output_id}.{file_format}"
                check_output_size(path.stat().st_size)
                assets[file_format] = base64.b64encode(path.read_bytes()).decode("ascii")
            response = JSONResponse({**result, "assets": assets}, headers={"Cache-Control": "no-store"})
            # Count the encoded response, including base64 expansion and JSON.
            check_output_size(len(response.body))
            return response
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except Exception as exc:
        logger.exception("TikZ render failed")
        raise HTTPException(502, str(exc))


# ===================================================
#   LATEX TO QUIZ JSON ENDPOINTS
# ===================================================

class LatexQuizRequest(BaseModel):
    source: str = Field(min_length=1, max_length=1_000_000)
    title: str = Field(default="Toán 12", max_length=200)
    difficulty: str = Field(default="easy", pattern="^(easy|medium|hard)$")


@app.get("/api/latex-to-json/config")
async def latex_quiz_config():
    return JSONResponse(cloudinary_config(), headers={"Cache-Control": "no-store"})


class SvgUploadRequest(BaseModel):
    svg: str = Field(min_length=1, max_length=2_000_000)


@app.post("/api/latex-to-json/upload-svg")
async def latex_quiz_upload(request: SvgUploadRequest):
    try:
        return JSONResponse(await run_in_threadpool(upload_svg, request.svg), headers={"Cache-Control": "no-store"})
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except RuntimeError as exc:
        raise HTTPException(502, str(exc))


@app.post("/api/latex-to-json/parse")
async def latex_quiz_parse(request: LatexQuizRequest):
    try:
        result = await run_in_threadpool(parse_quiz, request.source, request.title, request.difficulty)
        response = JSONResponse(result, headers={"Cache-Control": "no-store"})
        check_output_size(len(response.body))
        return response
    except ValueError as exc:
        raise HTTPException(400, str(exc))


@app.post("/api/latex-to-json/compat-svg")
async def latex_quiz_compat_svg(request: TikzRenderRequest):
    try:
        svg = await run_in_threadpool(render_compat_svg, request.source)
        check_output_size(len(svg.encode("utf-8")))
        return Response(svg, media_type="image/svg+xml", headers={"Cache-Control": "no-store"})
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except RuntimeError as exc:
        raise HTTPException(502, str(exc))

class WordSettings(BaseModel):
    organization: str = Field(default='TRƯỜNG THPT', max_length=120)
    exam_title: str = Field(default='KỲ THI TỐT NGHIỆP THPT', min_length=1, max_length=160)
    code: str = Field(default='101', min_length=1, max_length=20, pattern=r'^[\w-]+$')
    minutes: int = Field(default=90, ge=1, le=300)
    include_answers: bool = True


class WordCheckRequest(BaseModel):
    source: str = Field(min_length=1, max_length=2_097_152)
    settings: WordSettings = Field(default_factory=WordSettings)


class FormulaPreview(BaseModel):
    svg: str = Field(min_length=1, max_length=300_000)
    width: float = Field(gt=0, le=3000, allow_inf_nan=False)
    height: float = Field(gt=0, le=1000, allow_inf_nan=False)
    baseline: float = Field(default=0, ge=0, le=1000, allow_inf_nan=False)


class WordExportRequest(WordCheckRequest):
    previews: dict[str, FormulaPreview] = Field(default_factory=dict, max_length=1500)


@app.post('/api/json-to-word/validate')
async def word_validate(request: WordCheckRequest):
    try:
        result = await run_in_threadpool(validate_quiz, request.source, request.settings.include_answers)
        return JSONResponse(result['summary'], headers={'Cache-Control': 'no-store'})
    except ValueError as exc:
        raise HTTPException(400, str(exc))


@app.post('/api/json-to-word/export')
async def word_export(request: WordExportRequest):
    try:
        if sum(len(p.svg.encode()) for p in request.previews.values()) + len(request.source.encode()) > 4 * 1024 * 1024:
            raise HTTPException(413, 'Dữ liệu xuất vượt quá 4 MB. Hãy giảm số câu mỗi lần xuất.')
        content = await run_in_threadpool(export_quiz, request.source, request.settings.model_dump(), {key: value.model_dump() for key, value in request.previews.items()})
        return Response(content, media_type='application/zip', headers={
            'Content-Disposition': 'attachment; filename="De-Toan-Word.zip"', 'Cache-Control': 'no-store',
        })
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except Exception:
        logger.exception('Word export failed')
        raise HTTPException(500, 'Không tạo được Word. Hãy kiểm tra dữ liệu và thử lại.')


# ===================================================
#   WORD SHUFFLE ENDPOINTS
# ===================================================

async def read_shuffle_upload(file: UploadFile):
    if not file.filename or not file.filename.lower().endswith('.docx'):
        raise HTTPException(400, 'Chỉ hỗ trợ .docx. Hãy lưu file .doc thành .docx bằng Word.')
    content = await file.read(MAX_UPLOAD + 1)
    if not content:
        raise HTTPException(400, 'File Word không được rỗng.')
    if len(content) > MAX_UPLOAD:
        raise HTTPException(413, 'File Word tối đa 4 MB.')
    return content


@app.post('/api/word-shuffle/analyze')
async def word_shuffle_analyze(file: UploadFile = File(...)):
    content = await read_shuffle_upload(file)
    try:
        result = await run_in_threadpool(lambda: Exam(content).summary())
        response = JSONResponse(result, headers={'Cache-Control': 'no-store'})
        check_output_size(len(response.body))
        return response
    except ValueError as exc:
        raise HTTPException(400, str(exc))


@app.post('/api/word-shuffle/export')
async def word_shuffle_export(file: UploadFile = File(...), count: int = Form(4, ge=1, le=50),
                              start_code: str = Form('0101', pattern=r'^\d{3,4}$'),
                              include_solutions: bool = Form(True),
                              seed: str | None = Form(None, max_length=80),
                              variant_index: int | None = Form(None, ge=0, le=49),
                              department: str = Form('SỞ GDĐT ................................', min_length=1, max_length=120),
                              school: str = Form('TRƯỜNG THPT ........................', min_length=1, max_length=120)):
    content = await read_shuffle_upload(file)
    try:
        output = await run_in_threadpool(export_shuffle, content, count, start_code, include_solutions, seed, variant_index, department, school)
        return Response(output, media_type='application/zip', headers={
            'Content-Disposition': 'attachment; filename="Tron-de-Word.zip"', 'Cache-Control': 'no-store',
        })
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except Exception:
        logger.exception('Word shuffle failed')
        raise HTTPException(500, 'Không tạo được đề Word. Hãy kiểm tra file và thử lại.')


# ===================================================
#   PDF TOOLS ENDPOINTS
# ===================================================

async def read_pdf_upload(file: UploadFile) -> bytes:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Chỉ hỗ trợ file PDF.")
    content = await file.read(MAX_PDF_BYTES + 1)
    if len(content) > MAX_PDF_BYTES:
        raise HTTPException(413, "Tổng dung lượng PDF mỗi lần tối đa 4 MB.")
    if not content:
        raise HTTPException(400, "File PDF không được rỗng.")
    try:
        with pymupdf.open(stream=content, filetype="pdf") as document:
            if not document.page_count:
                raise ValueError("empty")
    except Exception:
        raise HTTPException(400, f"File '{file.filename}' không phải PDF hợp lệ.")
    return content


@app.post("/api/pdf-tools/merge")
async def merge_pdfs(files: list[UploadFile] = File(...)):
    if len(files) < 2:
        raise HTTPException(400, "Hãy chọn ít nhất 2 file PDF để gộp.")
    if len(files) > 30:
        raise HTTPException(400, "Chỉ có thể gộp tối đa 30 file mỗi lần.")
    merged = pymupdf.open()
    try:
        total_bytes = 0
        for file in files:
            content = await read_pdf_upload(file)
            total_bytes += len(content)
            if total_bytes > MAX_PDF_BYTES:
                raise HTTPException(413, "Tổng dung lượng các file PDF để gộp tối đa 4 MB.")
            with pymupdf.open(stream=content, filetype="pdf") as source:
                merged.insert_pdf(source)
        return pdf_response(merged.tobytes(garbage=4, deflate=True), "pdf", merged.page_count)
    finally:
        merged.close()


@app.post("/api/pdf-tools/info")
async def pdf_tool_info(file: UploadFile = File(...)):
    """Read the total pages as soon as a PDF is selected."""
    content = await read_pdf_upload(file)
    with pymupdf.open(stream=content, filetype="pdf") as source:
        return {"pages": source.page_count}


@app.post("/api/pdf-tools/split")
async def split_pdf(
    file: UploadFile = File(...),
    start_page: int | None = Form(None),
    end_page: int | None = Form(None),
):
    content = await read_pdf_upload(file)
    # Khi người dùng nhập khoảng trang, tạo một PDF duy nhất từ khoảng đó.
    # Không nhập khoảng vẫn giữ hành vi cũ: tách từng trang thành ZIP.
    if start_page is not None or end_page is not None:
        with pymupdf.open(stream=content, filetype="pdf") as source:
            total_pages = source.page_count
            start = 1 if start_page is None else start_page
            end = total_pages if end_page is None else end_page
            if start < 1 or end < 1 or start > end or end > total_pages:
                raise HTTPException(400, f"Khoảng trang không hợp lệ. File có {total_pages} trang; hãy nhập từ 1 đến {total_pages}.")
            result = pymupdf.open()
            try:
                result.insert_pdf(source, from_page=start - 1, to_page=end - 1)
                return pdf_response(result.tobytes(garbage=4, deflate=True), "pdf", result.page_count)
            finally:
                result.close()
    output = BytesIO()
    with pymupdf.open(stream=content, filetype="pdf") as source, zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        pages = source.page_count
        for page_number in range(source.page_count):
            page_document = pymupdf.open()
            try:
                page_document.insert_pdf(source, from_page=page_number, to_page=page_number)
                archive.writestr(f"page-{page_number + 1}.pdf", page_document.tobytes(garbage=4, deflate=True))
                check_output_size(output.tell())
            finally:
                page_document.close()
    return pdf_response(output.getvalue(), "zip", pages)


@app.post("/api/pdf-tools/split-ranges")
async def split_pdf_ranges(file: UploadFile = File(...), ranges: str = Form(...)):
    content = await read_pdf_upload(file)
    try:
        requested = json.loads(ranges)
        if not isinstance(requested, list) or not requested or len(requested) > 1000:
            raise ValueError()
    except (json.JSONDecodeError, ValueError, TypeError):
        raise HTTPException(400, "Danh sách khoảng trang không hợp lệ.")

    with pymupdf.open(stream=content, filetype="pdf") as source:
        total_pages = source.page_count
        normalized = []
        for item in requested:
            if not isinstance(item, dict):
                raise HTTPException(400, "Mỗi khoảng trang phải có trang bắt đầu và kết thúc.")
            start, end = item.get("start"), item.get("end", total_pages)
            if type(start) is not int or type(end) is not int or start < 1 or end < start or end > total_pages:
                raise HTTPException(400, f"Khoảng trang không hợp lệ. File có {total_pages} trang.")
            normalized.append((start, end))

        total_output_pages = sum(end - start + 1 for start, end in normalized)
        if len(normalized) == 1:
            result = pymupdf.open()
            try:
                start, end = normalized[0]
                result.insert_pdf(source, from_page=start - 1, to_page=end - 1)
                return pdf_response(result.tobytes(garbage=4, deflate=True), "pdf", total_output_pages)
            finally:
                result.close()

        output = BytesIO()
        with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
            for index, (start, end) in enumerate(normalized, 1):
                result = pymupdf.open()
                try:
                    result.insert_pdf(source, from_page=start - 1, to_page=end - 1)
                    archive.writestr(f"part-{index}_pages-{start}-{end}.pdf", result.tobytes(garbage=4, deflate=True))
                    check_output_size(output.tell())
                finally:
                    result.close()
        return pdf_response(output.getvalue(), "zip", total_output_pages, len(normalized))


@app.post("/api/pdf-tools/png")
async def pdf_to_png(file: UploadFile = File(...), dpi: int = Form(180)):
    if dpi < 72 or dpi > 300:
        raise HTTPException(400, "DPI phải nằm trong khoảng 72–300.")
    content = await read_pdf_upload(file)
    output = BytesIO()
    with pymupdf.open(stream=content, filetype="pdf") as source, zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        pages = source.page_count
        for page_number, page in enumerate(source):
            pixmap = page.get_pixmap(matrix=pymupdf.Matrix(dpi / 72, dpi / 72), alpha=False)
            archive.writestr(f"page-{page_number + 1}.png", pixmap.tobytes("png"))
            check_output_size(output.tell())
    return pdf_response(output.getvalue(), "zip", pages)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
