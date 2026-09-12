import base64
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import json
from pathlib import Path
import unittest
from unittest.mock import patch
import zipfile

import pymupdf
from fastapi.testclient import TestClient

from api.index import app
from backend import main


def sample_pdf(pages=3):
    with pymupdf.open() as document:
        for number in range(pages):
            page = document.new_page(width=200, height=200)
            page.insert_text((20, 40), f"Page {number + 1}")
        return document.tobytes()


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.pdf = sample_pdf()

    def upload(self, endpoint, data=None, content=None):
        return self.client.post(f"/api/pdf-tools/{endpoint}", data=data or {},
                                files={"file": ("input.pdf", self.pdf if content is None else content, "application/pdf")})

    def test_health_and_info(self):
        self.assertEqual(self.client.get("/api/health").json()["status"], "ok")
        self.assertEqual(self.upload("info").json(), {"pages": 3})

    def test_merge_returns_downloadable_pdf_in_same_request(self):
        response = self.client.post("/api/pdf-tools/merge", files=[
            ("files", ("a.pdf", self.pdf, "application/pdf")),
            ("files", ("b.pdf", self.pdf, "application/pdf")),
        ])
        self.assertEqual(response.status_code, 200, response.text[:200])
        self.assertEqual(response.headers["X-PDF-Pages"], "6")
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        with pymupdf.open(stream=response.content, filetype="pdf") as document:
            self.assertEqual(document.page_count, 6)
            self.assertIn("Page 1", document[3].get_text())

    def test_upload_boundary_and_combined_merge_limit(self):
        # Trailing PDF whitespace keeps the document valid at the exact limit.
        at_limit = self.pdf + b" " * (main.MAX_PDF_BYTES - len(self.pdf))
        self.assertEqual(self.upload("info", content=at_limit).status_code, 200)
        self.assertEqual(self.upload("info", content=at_limit + b" ").status_code, 413)
        part = at_limit[:main.MAX_PDF_BYTES // 2 + 1]
        response = self.client.post("/api/pdf-tools/merge", files=[
            ("files", ("a.pdf", part, "application/pdf")),
            ("files", ("b.pdf", part, "application/pdf")),
        ])
        self.assertEqual(response.status_code, 413)

    def test_invalid_pdf_and_ranges(self):
        self.assertEqual(self.upload("info", content=b"").status_code, 400)
        self.assertEqual(self.upload("info", content=b"not pdf").status_code, 400)
        for ranges in ["bad json", "[]", "[null]", '[{"start":true}]', '[{"start":0}]', '[{"start":1,"end":4}]']:
            with self.subTest(ranges=ranges):
                self.assertEqual(self.upload("split-ranges", {"ranges": ranges}).status_code, 400)

    def test_single_range_preserves_requested_pages(self):
        response = self.upload("split-ranges", {"ranges": json.dumps([{"start": 2, "end": 3}])})
        self.assertEqual(response.status_code, 200)
        with pymupdf.open(stream=response.content, filetype="pdf") as document:
            self.assertEqual(document.page_count, 2)
            self.assertIn("Page 2", document[0].get_text())
        legacy = self.upload("split", {"start_page": 2, "end_page": 2})
        self.assertEqual(legacy.headers["X-PDF-Pages"], "1")

    def test_zip_ranges_and_individual_pages(self):
        response = self.upload("split-ranges", {"ranges": '[{"start":1,"end":1},{"start":2,"end":3}]'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["X-PDF-Files"], "2")
        with zipfile.ZipFile(BytesIO(response.content)) as archive:
            self.assertEqual(archive.namelist(), ["part-1_pages-1-1.pdf", "part-2_pages-2-3.pdf"])
            with pymupdf.open(stream=archive.read(archive.namelist()[1]), filetype="pdf") as document:
                self.assertEqual(document.page_count, 2)
        response = self.upload("split")
        with zipfile.ZipFile(BytesIO(response.content)) as archive:
            self.assertEqual(len(archive.namelist()), 3)

    def test_png_archive_and_output_limit(self):
        response = self.upload("png", {"dpi": 72})
        self.assertEqual(response.status_code, 200)
        with zipfile.ZipFile(BytesIO(response.content)) as archive:
            self.assertEqual(len(archive.namelist()), 3)
            self.assertTrue(archive.read("page-1.png").startswith(b"\x89PNG"))
        with patch.object(main, "MAX_RESPONSE_BYTES", 100):
            self.assertEqual(self.upload("png", {"dpi": 72}).status_code, 413)
            self.assertEqual(self.upload("split", {"start_page": 1}).status_code, 413)

    def test_tikz_assets_survive_cleanup_and_concurrent_requests(self):
        directories = []

        def renderer(source, directory, output_id, dpi):
            directories.append(directory)
            for ext, content in {"pdf": self.pdf, "png": b"png-preview", "tex": source.encode()}.items():
                (directory / f"{output_id}.{ext}").write_bytes(content)
            return {"output_id": output_id, "source": source}

        with patch.object(main, "render_tikz", renderer):
            with ThreadPoolExecutor(max_workers=2) as pool:
                responses = list(pool.map(lambda source: self.client.post("/api/tikz/render", json={"source": source}), ["first", "second"]))
        self.assertEqual(len(set(directories)), 2)
        self.assertTrue(all(not Path(directory).exists() for directory in directories))
        for response, source in zip(responses, ["first", "second"]):
            self.assertEqual(response.status_code, 200)
            assets = response.json()["assets"]
            self.assertEqual(base64.b64decode(assets["pdf"]), self.pdf)
            self.assertEqual(base64.b64decode(assets["tex"]), source.encode())

    def test_tikz_counts_base64_response_size(self):
        directories = []

        def renderer(source, directory, output_id, dpi):
            directories.append(directory)
            for ext in ("pdf", "png", "tex"):
                (directory / f"{output_id}.{ext}").write_bytes(b"x" * 270)
            return {"output_id": output_id}

        with patch.object(main, "render_tikz", renderer), patch.object(main, "MAX_RESPONSE_BYTES", 1000):
            response = self.client.post("/api/tikz/render", json={"source": "test"})
        self.assertEqual(response.status_code, 413)
        self.assertTrue(all(not directory.exists() for directory in directories))

    def test_tikz_validation_and_failure_cleanup(self):
        self.assertEqual(self.client.post("/api/tikz/render", json={"source": "x" * 20001}).status_code, 422)
        directories = []

        def renderer(source, directory, output_id, dpi):
            directories.append(directory)
            raise ValueError("Invalid TeX")

        with patch.object(main, "render_tikz", renderer):
            response = self.client.post("/api/tikz/render", json={"source": "test"})
        self.assertEqual(response.status_code, 400)
        self.assertTrue(all(not directory.exists() for directory in directories))


if __name__ == "__main__":
    unittest.main()
