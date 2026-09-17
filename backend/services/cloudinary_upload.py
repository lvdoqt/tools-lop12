"""Signed SVG uploads; credentials never leave the backend."""

import hashlib
import os
from pathlib import Path
import re
import time
import xml.etree.ElementTree as ET

from dotenv import load_dotenv
import requests

load_dotenv(Path(__file__).resolve().parents[2] / '.env')


def cloudinary_config():
    cloud = os.getenv('CLOUDINARY_CLOUD_NAME', '').strip()
    configured = bool(re.fullmatch(r'[\w-]+', cloud) and os.getenv('CLOUDINARY_API_KEY') and os.getenv('CLOUDINARY_API_SECRET'))
    return {'signed_upload': configured, 'cloud_name': cloud, 'folder': os.getenv('CLOUDINARY_FOLDER', '').strip()}


def upload_svg(svg, prefix='quiz'):
    config = cloudinary_config()
    if not config['signed_upload']:
        raise RuntimeError('Backend chưa cấu hình Cloudinary.')
    if len(svg.encode('utf-8')) > 2 * 1024 * 1024:
        raise ValueError('SVG vượt quá 2 MB.')
    try:
        if '<!DOCTYPE' in svg.upper() or '<!ENTITY' in svg.upper():
            raise ValueError('SVG chứa khai báo không hỗ trợ.')
        root = ET.fromstring(svg)
        if root.tag != '{http://www.w3.org/2000/svg}svg':
            raise ValueError('Nội dung phải là SVG hợp lệ.')
        for element in root.iter():
            if element.tag.rsplit('}', 1)[-1].lower() in {'script', 'foreignobject'}:
                raise ValueError('SVG chứa nội dung không hỗ trợ.')
            if any(name.lower().startswith('on') for name in element.attrib):
                raise ValueError('SVG chứa nội dung không hỗ trợ.')
    except ET.ParseError as exc:
        raise ValueError('Không đọc được XML của SVG.') from exc
    content = svg.encode('utf-8')
    params = {
        'timestamp': str(int(time.time())),
        'public_id': prefix + '-' + hashlib.sha256(content).hexdigest()[:32],
        'overwrite': 'false',
    }
    if config['folder']:
        params['folder'] = config['folder']
    to_sign = '&'.join(f'{key}={params[key]}' for key in sorted(params))
    params['signature'] = hashlib.sha256((to_sign + os.environ['CLOUDINARY_API_SECRET']).encode('utf-8')).hexdigest()
    params['api_key'] = os.environ['CLOUDINARY_API_KEY']
    try:
        response = requests.post(f"https://api.cloudinary.com/v1_1/{config['cloud_name']}/image/upload", data=params,
                                 files={'file': ('diagram.svg', content, 'image/svg+xml')}, timeout=35)
        result = response.json()
    except (requests.RequestException, ValueError) as exc:
        raise RuntimeError('Không kết nối được Cloudinary. Hãy thử lại.') from exc
    if not response.ok:
        # Do not echo upstream signature/debug details or credentials to clients.
        raise RuntimeError(f'Cloudinary từ chối upload (HTTP {response.status_code}). Kiểm tra cấu hình tài khoản và quyền upload SVG.')
    url = result.get('secure_url', '')
    if not isinstance(url, str) or not url.startswith('https://'):
        raise RuntimeError('Cloudinary chưa trả về link HTTPS.')
    return {'url': url, 'public_id': result.get('public_id', '/'.join(filter(None, [config['folder'], params['public_id']])))}
