"""Private shared TikZ library via Supabase REST. Credentials stay on server."""
import hashlib
import hmac
import os
from uuid import UUID

import requests
from fastapi import APIRouter, Header, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from .cloudinary_upload import upload_svg

router = APIRouter(prefix='/api/tikz/library')


def supabase_key():
    return os.getenv('SUPABASE_SECRET_KEY', '').strip() or os.getenv('SUPABASE_SERVICE_ROLE_KEY', '').strip()


def authorize(x_library_key: str = Header(default='')):
    expected = os.getenv('TIKZ_LIBRARY_KEY', '').strip()
    if not expected or not os.getenv('SUPABASE_URL') or not supabase_key():
        raise HTTPException(503, 'Chưa cấu hình SUPABASE_URL, SUPABASE_SECRET_KEY (hoặc SUPABASE_SERVICE_ROLE_KEY) và TIKZ_LIBRARY_KEY trên backend.')
    if not hmac.compare_digest(x_library_key.encode(), expected.encode()):
        raise HTTPException(401, 'Mã truy cập thư viện không đúng.')


def database(method, params=None, body=None):
    url = os.environ['SUPABASE_URL'].rstrip('/') + '/rest/v1/tikz_drawings'
    key = supabase_key()
    headers = {'apikey': key, 'Prefer': 'return=representation,resolution=ignore-duplicates'}
    if not key.startswith('sb_secret_'):
        headers['Authorization'] = f'Bearer {key}'
    try:
        response = requests.request(method, url, params=params, json=body, headers=headers, timeout=15)
        if not response.ok:
            raise HTTPException(502, 'Không truy cập được bảng tikz_drawings. Kiểm tra cấu hình Supabase và chạy SQL tạo bảng.')
        return response.json() if response.content else []
    except (requests.RequestException, ValueError) as exc:
        raise HTTPException(502, 'Không kết nối được Supabase. Hãy thử lại.') from exc


class Drawing(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    source: str = Field(min_length=1, max_length=20000)
    svg: str = Field(min_length=1, max_length=2_000_000)
    dpi: int = Field(default=180, ge=72, le=300)


class Rename(BaseModel):
    title: str = Field(min_length=1, max_length=200)


@router.get('', dependencies=[Depends(authorize)])
def list_drawings(offset: int = Query(0, ge=0), q: str = Query('', max_length=200)):
    params = {'select': 'id,title,svg_url,png_url,created_at,dpi', 'order': 'created_at.desc,id.desc', 'limit': 25, 'offset': offset}
    if q.strip():
        query = q.strip().replace('*', ' ').replace('%', ' ').replace('_', ' ')
        params['title'] = f'ilike.*{query}*'
    return database('GET', params)


@router.get('/{identifier}', dependencies=[Depends(authorize)])
def get_drawing(identifier: UUID):
    rows = database('GET', {'id': f'eq.{identifier}', 'select': '*'})
    if not rows:
        raise HTTPException(404, 'Không tìm thấy hình.')
    return rows[0]


@router.post('', dependencies=[Depends(authorize)])
def save_drawing(drawing: Drawing):
    digest = hashlib.sha256((drawing.source + '\0' + str(drawing.dpi) + '\0' + drawing.svg).encode()).hexdigest()
    rows = database('GET', {'content_hash': f'eq.{digest}', 'select': '*'})
    if rows:
        return rows[0]
    try:
        asset = upload_svg(drawing.svg, prefix='tikz')
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(502, str(exc)) from exc
    svg_url = asset['url']
    png_url = svg_url.replace('/image/upload/', f'/image/upload/f_png,dn_{drawing.dpi}/', 1)
    rows = database('POST', {'on_conflict': 'content_hash'}, {
        'title': drawing.title.strip() or 'Hình TikZ', 'source': drawing.source,
        'dpi': drawing.dpi, 'svg_url': svg_url, 'png_url': png_url,
        'cloudinary_public_id': asset['public_id'], 'content_hash': digest,
    })
    return rows[0] if rows else database('GET', {'content_hash': f'eq.{digest}', 'select': '*'})[0]


@router.patch('/{identifier}', dependencies=[Depends(authorize)])
def rename_drawing(identifier: UUID, drawing: Rename):
    rows = database('PATCH', {'id': f'eq.{identifier}'}, {'title': drawing.title.strip() or 'Hình TikZ'})
    if not rows:
        raise HTTPException(404, 'Không tìm thấy hình.')
    return rows[0]


@router.delete('/{identifier}', dependencies=[Depends(authorize)])
def delete_drawing(identifier: UUID):
    database('DELETE', {'id': f'eq.{identifier}'})
    return {'deleted': True}
