"""Bounded image downloads with public-IP pinning, including redirects."""

import base64
from concurrent.futures import ThreadPoolExecutor
from http.client import HTTPSConnection
from io import BytesIO
import ipaddress
import re
import os
import socket
import ssl
from urllib.parse import urlsplit, urljoin, unquote_to_bytes

from lxml import etree
from PIL import Image
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
import pymupdf
import requests

MAX_IMAGE = 3 * 1024 * 1024


def outline_embedded_fonts(root):
    """Keep TikZJax's TeX glyphs: MuPDF does not load CSS data-font faces."""
    fonts = {}
    for style in root.xpath('.//*[local-name()="style"]'):
        css = style.text or ''
        for face in re.findall(r'@font-face\s*\{([^}]+)\}', css):
            family = re.search(r'font-family\s*:\s*[\'"]?([^;\'"}]+)', face)
            source = re.search(r'url\([\'"]?data:font/(?:ttf|otf|woff2?);base64,([A-Za-z0-9+/=]+)[\'"]?\)', face)
            if not family or not source:
                raise ValueError('SVG có font ngoài chưa được nhúng.')
            fonts[family[1].strip()] = TTFont(BytesIO(base64.b64decode(source[1], validate=True)))
        css = re.sub(r'@font-face\s*\{[^}]+\}', '', css)
        if '@import' in css.lower() or re.search(r'url\(\s*[\'"]?(?!#)', css, re.I):
            raise ValueError('SVG có CSS tham chiếu tài nguyên ngoài.')
        style.text = css
    for node in list(root.xpath('.//*[local-name()="text"]')):
        family = node.get('font-family', '').strip('\'"')
        if family not in fonts:
            continue
        if len(node):
            raise ValueError('SVG có chữ với font nhúng và tspan chưa hỗ trợ; hãy dùng ảnh PNG.')
        font = fonts[family]
        glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
        size = float(node.get('font-size', '12').removesuffix('px'))
        scale = size / font['head'].unitsPerEm
        x, y = float(node.get('x', '0')), float(node.get('y', '0'))
        group = etree.Element('{http://www.w3.org/2000/svg}g')
        for key, value in node.attrib.items():
            if key not in ('x', 'y', 'font-size', 'font-family', 'alignment-baseline'): group.set(key, value)
        for char in node.text or '':
            name = cmap.get(ord(char))
            if name is None:
                raise ValueError('SVG chứa ký tự thiếu trong font nhúng.')
            pen = SVGPathPen(glyphs); glyphs[name].draw(pen)
            path = etree.SubElement(group, '{http://www.w3.org/2000/svg}path')
            path.set('d', pen.getCommands())
            path.set('transform', f'translate({x},{y}) scale({scale},{-scale})')
            x += font['hmtx'][name][0] * scale
        group.tail = node.tail
        node.getparent().replace(node, group)
    for font in fonts.values(): font.close()


def public_address(host):
    addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    ips = [entry[4][0] for entry in addresses]
    if not ips or any(not ipaddress.ip_address(ip).is_global for ip in ips):
        raise ValueError('URL ảnh phải trỏ đến địa chỉ Internet công khai.')
    return ips[0]


class PinnedHTTPS(HTTPSConnection):
    def connect(self):
        address = public_address(self.host)
        raw = socket.create_connection((address, self.port), self.timeout)
        try:
            self.sock = self._context.wrap_socket(raw, server_hostname=self.host)
        except Exception:
            raw.close()
            raise


def download_image(url):
    if url.startswith('data:image/'):
        header, sep, body = url.partition(',')
        if not sep or len(body) > MAX_IMAGE * 2:
            raise ValueError('Ảnh data URL không hợp lệ hoặc quá lớn.')
        return base64.b64decode(body, validate=True) if ';base64' in header else unquote_to_bytes(body)
    for _ in range(4):
        parsed = urlsplit(url)
        if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.port not in (None, 443):
            raise ValueError('Ảnh cần URL HTTPS công khai hoặc data:image.')
        context = ssl.create_default_context()
        context.load_verify_locations(os.environ.get('REQUESTS_CA_BUNDLE') or requests.certs.where())
        connection = PinnedHTTPS(parsed.hostname, timeout=8, context=context)
        try:
            connection.request('GET', (parsed.path or '/') + ('?' + parsed.query if parsed.query else ''), headers={'User-Agent': 'MathTools-WordExport/1.0', 'Accept': 'image/*'})
            response = connection.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                location = response.getheader('Location')
                if not location:
                    raise ValueError('Chuyển hướng ảnh không hợp lệ.')
                url = urljoin(url, location)
                continue
            if response.status != 200:
                raise ValueError(f'Máy chủ ảnh trả HTTP {response.status}.')
            data = response.read(MAX_IMAGE + 1)
            if len(data) > MAX_IMAGE:
                raise ValueError('Mỗi ảnh tối đa 3 MB.')
            return data
        finally:
            connection.close()
    raise ValueError('URL ảnh chuyển hướng quá nhiều lần.')


def svg_png(data, scale=2):
    parser = etree.XMLParser(resolve_entities=False, no_network=True)
    root = etree.fromstring(data, parser)
    if etree.QName(root).localname != 'svg' or root.getroottree().docinfo.doctype:
        raise ValueError('SVG không hợp lệ.')
    outline_embedded_fonts(root)
    for node in root.iter():
        if not isinstance(node.tag, str):
            raise ValueError('SVG chứa nội dung không hỗ trợ.')
        if etree.QName(node).localname in ('script', 'foreignObject', 'image', 'iframe'):
            raise ValueError('SVG phải chứa hình và font độc lập, không có tài nguyên ngoài.')
        for name, value in node.attrib.items():
            if etree.QName(name).localname.lower().startswith('on') or ('href' in name and not value.startswith('#')) or re.search(r'url\(\s*[\'"]?(?!#)', value, re.I):
                raise ValueError('SVG chứa tài nguyên ngoài hoặc nội dung không hỗ trợ.')
    with pymupdf.open(stream=etree.tostring(root), filetype='svg') as document:
        page = document[0]
        if page.rect.width <= 0 or page.rect.height <= 0 or page.rect.width * page.rect.height * scale * scale > 16_000_000:
            raise ValueError('Kích thước SVG quá lớn hoặc không hợp lệ.')
        pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=True)
        return pix.tobytes('png'), page.rect.width, page.rect.height


def normalize_image(data):
    if len(data) > MAX_IMAGE:
        raise ValueError('Mỗi ảnh tối đa 3 MB.')
    if b'<svg' in data[:1000]:
        return svg_png(data)
    with Image.open(BytesIO(data)) as image:
        if image.width * image.height > 16_000_000:
            raise ValueError('Ảnh vượt quá 16 triệu điểm ảnh.')
        image.load()
        image = image.convert('RGBA')
        output = BytesIO()
        image.save(output, format='PNG')
        return output.getvalue(), image.width * 0.75, image.height * 0.75


def load_images(urls):
    def load(url):
        try:
            return url, normalize_image(download_image(url))
        except Exception as exc:
            label = url[:160] if not url.startswith('data:') else 'data:image'
            raise ValueError(f'Không nhúng được ảnh {label}: {exc}') from exc
    with ThreadPoolExecutor(max_workers=6) as pool:
        images = dict(pool.map(load, urls))
    if sum(len(value[0]) for value in images.values()) > 12 * 1024 * 1024:
        raise ValueError('Tổng ảnh sau xử lý quá lớn. Hãy giảm kích thước ảnh.')
    return images
