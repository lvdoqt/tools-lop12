"""
Google Drive file downloader service.
Handles restricted (view-only) files by using various download strategies.
"""

import re
import requests
import os
import logging
from urllib.parse import urlencode, urlparse, parse_qs

logger = logging.getLogger(__name__)

# Timeout for requests
TIMEOUT = 30
CHUNK_SIZE = 32768


def extract_file_id(url: str) -> str | None:
    """Extract Google Drive file ID from various URL formats."""
    if not url:
        return None

    patterns = [
        r'/file/d/([a-zA-Z0-9_-]+)',           # /file/d/FILE_ID/
        r'/document/d/([a-zA-Z0-9_-]+)',        # /document/d/FILE_ID/
        r'/spreadsheets/d/([a-zA-Z0-9_-]+)',    # /spreadsheets/d/FILE_ID/
        r'/presentation/d/([a-zA-Z0-9_-]+)',    # /presentation/d/FILE_ID/
        r'/drawings/d/([a-zA-Z0-9_-]+)',        # /drawings/d/FILE_ID/
        r'[?&]id=([a-zA-Z0-9_-]+)',             # ?id=FILE_ID
        r'^([a-zA-Z0-9_-]{20,})$',              # Just a file ID
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)

    return None


def detect_doc_type(url: str) -> str:
    """Detect Google document type from URL."""
    if '/document/' in url:
        return 'document'
    elif '/spreadsheets/' in url:
        return 'spreadsheet'
    elif '/presentation/' in url:
        return 'presentation'
    elif '/drawings/' in url:
        return 'drawing'
    return 'file'


def get_file_info(file_id: str) -> dict:
    """Try to get file metadata from Google Drive."""
    try:
        # Try the embed endpoint to get filename
        url = f"https://drive.google.com/file/d/{file_id}/view"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=TIMEOUT, allow_redirects=True)

        filename = None
        # Try to extract filename from page title
        title_match = re.search(r'<title>(.+?)(?:\s*-\s*Google Drive)?</title>', response.text)
        if title_match:
            filename = title_match.group(1).strip()

        return {
            "file_id": file_id,
            "filename": filename or f"file_{file_id[:8]}",
            "accessible": response.status_code == 200,
        }
    except Exception as e:
        logger.error(f"Failed to get file info: {e}")
        return {
            "file_id": file_id,
            "filename": f"file_{file_id[:8]}",
            "accessible": False,
        }


def generate_download_links(file_id: str, original_url: str = "") -> list[dict]:
    """Generate multiple download link options for a Drive file."""
    doc_type = detect_doc_type(original_url) if original_url else 'file'
    links = []

    # Method 1: Direct download
    links.append({
        "title": "Tải trực tiếp (Phương thức 1)",
        "desc": "Google Drive direct export — Phổ biến nhất",
        "icon": "⚡",
        "color": "blue",
        "url": f"https://drive.google.com/uc?export=download&id={file_id}",
        "method": "direct_v1",
    })

    # Method 2: Confirm bypass (large files)
    links.append({
        "title": "Tải trực tiếp (Phương thức 2)",
        "desc": "Bỏ qua cảnh báo virus scan — Cho file lớn",
        "icon": "🔓",
        "color": "purple",
        "url": f"https://drive.google.com/uc?export=download&confirm=t&id={file_id}",
        "method": "direct_v2",
    })

    # Method 3: Drive API
    links.append({
        "title": "Google Drive API v3",
        "desc": "Sử dụng API trực tiếp — Hiệu quả cao",
        "icon": "🔑",
        "color": "green",
        "url": f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media&source=downloadUrl",
        "method": "api_v3",
    })

    # Document-type specific exports
    if doc_type == 'document':
        links.extend([
            {
                "title": "Xuất dạng PDF",
                "desc": "Google Docs → PDF",
                "icon": "📄",
                "color": "red",
                "url": f"https://docs.google.com/document/d/{file_id}/export?format=pdf",
                "method": "export_pdf",
            },
            {
                "title": "Xuất dạng DOCX",
                "desc": "Google Docs → Word",
                "icon": "📝",
                "color": "blue",
                "url": f"https://docs.google.com/document/d/{file_id}/export?format=docx",
                "method": "export_docx",
            },
        ])
    elif doc_type == 'spreadsheet':
        links.extend([
            {
                "title": "Xuất dạng XLSX",
                "desc": "Google Sheets → Excel",
                "icon": "📊",
                "color": "green",
                "url": f"https://docs.google.com/spreadsheets/d/{file_id}/export?format=xlsx",
                "method": "export_xlsx",
            },
            {
                "title": "Xuất dạng PDF",
                "desc": "Google Sheets → PDF",
                "icon": "📄",
                "color": "red",
                "url": f"https://docs.google.com/spreadsheets/d/{file_id}/export?format=pdf",
                "method": "export_pdf",
            },
        ])
    elif doc_type == 'presentation':
        links.extend([
            {
                "title": "Xuất dạng PPTX",
                "desc": "Google Slides → PowerPoint",
                "icon": "📊",
                "color": "orange",
                "url": f"https://docs.google.com/presentation/d/{file_id}/export/pptx",
                "method": "export_pptx",
            },
            {
                "title": "Xuất dạng PDF",
                "desc": "Google Slides → PDF",
                "icon": "📄",
                "color": "red",
                "url": f"https://docs.google.com/presentation/d/{file_id}/export/pdf",
                "method": "export_pdf",
            },
        ])

    return links


def generate_export_link(file_id: str, doc_type: str, format: str) -> str:
    """Generate an export URL for Google Docs/Sheets/Slides."""
    base_urls = {
        'document': f"https://docs.google.com/document/d/{file_id}/export?format={format}",
        'spreadsheet': f"https://docs.google.com/spreadsheets/d/{file_id}/export?format={format}",
        'presentation': f"https://docs.google.com/presentation/d/{file_id}/export/{format}",
        'drawing': f"https://docs.google.com/drawings/d/{file_id}/export/{format}",
        'file': f"https://drive.google.com/uc?export=download&id={file_id}",
    }
    return base_urls.get(doc_type, base_urls['file'])


def download_file_proxy(file_id: str, method: str = "direct_v1") -> tuple[bytes, str, str]:
    """
    Download file through server proxy (bypasses CORS and some restrictions).
    Returns: (file_bytes, filename, content_type)
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
    }

    urls = {
        "direct_v1": f"https://drive.google.com/uc?export=download&id={file_id}",
        "direct_v2": f"https://drive.google.com/uc?export=download&confirm=t&id={file_id}",
        "api_v3": f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media",
    }

    url = urls.get(method, urls["direct_v1"])

    session = requests.Session()
    response = session.get(url, headers=headers, stream=True, timeout=TIMEOUT)

    # Handle Google's download confirmation page
    if response.status_code == 200 and b'download_warning' in response.content[:1000]:
        # Extract confirm token
        for key, value in response.cookies.items():
            if key.startswith('download_warning'):
                url = f"https://drive.google.com/uc?export=download&confirm={value}&id={file_id}"
                response = session.get(url, headers=headers, stream=True, timeout=TIMEOUT)
                break

    if response.status_code != 200:
        raise Exception(f"Tải thất bại. HTTP {response.status_code}")

    # Get filename from headers
    filename = f"file_{file_id[:8]}"
    content_disposition = response.headers.get('content-disposition', '')
    name_match = re.search(r'filename[*]?=["\']?(?:UTF-8\'\')?([^"\';\n]+)', content_disposition)
    if name_match:
        filename = name_match.group(1).strip()

    content_type = response.headers.get('content-type', 'application/octet-stream')

    return response.content, filename, content_type
