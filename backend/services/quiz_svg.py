"""Compatibility renderer for TeX packages unavailable in TikZJax."""

import requests
import pymupdf
from io import BytesIO
import tarfile
from urllib.parse import urlencode

from .tikz_renderer import LATEX_ONLINE_URL, build_document


def render_compat_svg(source):
    document = build_document(source)
    try:
        params = {"text": document, "command": "pdflatex"}
        if len(urlencode(params)) < 7000:
            response = requests.get(LATEX_ONLINE_URL, params=params, timeout=45)
        else:
            # The service's /data API accepts a tarball, avoiding URL length limits.
            archive = BytesIO()
            encoded = document.encode('utf-8')
            with tarfile.open(fileobj=archive, mode='w:gz') as tar:
                entry = tarfile.TarInfo('diagram.tex')
                entry.size = len(encoded)
                tar.addfile(entry, BytesIO(encoded))
            response = requests.post(LATEX_ONLINE_URL.removesuffix('/compile') + '/data',
                                     params={'target': 'diagram.tex', 'command': 'pdflatex'},
                                     files={'file': ('source.tar.gz', archive.getvalue(), 'application/gzip')}, timeout=45)
    except requests.RequestException as exc:
        raise RuntimeError("Không kết nối được dịch vụ biên dịch SVG bổ sung.") from exc
    if response.status_code != 200 or not response.content.startswith(b"%PDF"):
        raise ValueError("Biên dịch SVG thất bại: " + response.text[:1000])
    with pymupdf.open(stream=response.content, filetype="pdf") as pdf:
        if len(pdf) != 1:
            raise ValueError("Mỗi hình phải tạo đúng một trang.")
        # Paths keep Vietnamese labels independent of installed/browser fonts.
        return pdf[0].get_svg_image(text_as_path=True)
