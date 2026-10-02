"""Teacher-only quiz and answer-sheet endpoints backed by Supabase."""
import os

import requests
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix='/api/teacher')


def config():
    url = os.getenv('SUPABASE_URL', '').strip().rstrip('/')
    secret = (os.getenv('SUPABASE_SECRET_KEY', '').strip() or
              os.getenv('SUPABASE_SERVICE_ROLE_KEY', '').strip())
    public = os.getenv('SUPABASE_ANON_KEY', '').strip()
    if not url or not secret or not public:
        raise HTTPException(503, 'Cần cấu hình SUPABASE_URL, SUPABASE_ANON_KEY và SUPABASE_SECRET_KEY ở backend.')
    return url, secret, public


def auth_request(path, body, public):
    url, _, _ = config()
    response = requests.post(f'{url}/auth/v1/{path}', json=body,
        headers={'apikey': public, 'Content-Type': 'application/json'}, timeout=20)
    try:
        payload = response.json()
    except ValueError:
        payload = {}
    if not response.ok:
        raise HTTPException(response.status_code, payload.get('msg') or payload.get('message') or payload.get('error_description') or 'Không thể xác thực tài khoản.')
    return payload


def db(method, table, params=None, body=None):
    url, key, _ = config()
    headers = {'apikey': key, 'Prefer': 'return=representation'}
    if not key.startswith('sb_secret_'):
        headers['Authorization'] = f'Bearer {key}'
    response = requests.request(method, f'{url}/rest/v1/{table}', params=params,
        json=body, headers=headers, timeout=20)
    try:
        payload = response.json() if response.content else []
    except ValueError:
        payload = []
    if not response.ok:
        raise HTTPException(502, 'Supabase từ chối thao tác. Kiểm tra SQL thiết lập công cụ chấm trắc nghiệm.')
    return payload


def current_teacher(authorization: str = Header(default='')):
    url, secret, public = config()
    if not authorization.lower().startswith('bearer '):
        raise HTTPException(401, 'Vui lòng đăng nhập tài khoản giáo viên.')
    token = authorization[7:].strip()
    response = requests.get(f'{url}/auth/v1/user', headers={'apikey': public,
        'Authorization': f'Bearer {token}'}, timeout=15)
    if not response.ok:
        raise HTTPException(401, 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.')
    user = response.json()
    teacher_id = user.get('id')
    rows = db('GET', 'teacher_profiles', {'user_id': f'eq.{teacher_id}', 'select': 'user_id'})
    if not rows:
        raise HTTPException(403, 'Tài khoản này chưa được đăng ký vai trò giáo viên.')
    return teacher_id


class Signup(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=120)


class Login(BaseModel):
    email: str
    password: str


class Exam(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    answers: list[str] = Field(min_length=1, max_length=120)


class Scan(BaseModel):
    image: str = Field(min_length=100, max_length=8_000_000)


@router.post('/signup')
def signup(data: Signup):
    _, _, public = config()
    result = auth_request('signup', {'email': data.email.strip().lower(), 'password': data.password,
        'data': {'full_name': data.full_name.strip()}}, public)
    user = result.get('user') or result
    if user.get('id'):
        db('POST', 'teacher_profiles', body={'user_id': user['id'], 'full_name': data.full_name.strip()})
    return {'message': 'Đã tạo tài khoản giáo viên. Nếu Supabase yêu cầu xác minh email, hãy xác minh trước khi đăng nhập.',
            'session': result.get('session')}


@router.post('/login')
def login(data: Login):
    _, _, public = config()
    result = auth_request('token?grant_type=password', {'email': data.email.strip().lower(), 'password': data.password}, public)
    if not result.get('access_token'):
        raise HTTPException(401, 'Hãy xác minh email trước khi đăng nhập.')
    return result


@router.get('/exams')
def exams(teacher_id: str = Depends(current_teacher)):
    return db('GET', 'teacher_exams', {'teacher_id': f'eq.{teacher_id}', 'select': '*', 'order': 'created_at.desc'})


@router.post('/exams')
def create_exam(exam: Exam, teacher_id: str = Depends(current_teacher)):
    if any(answer.upper() not in ('A', 'B', 'C', 'D') for answer in exam.answers):
        raise HTTPException(422, 'Mỗi câu cần có đáp án A, B, C hoặc D.')
    rows = db('POST', 'teacher_exams', body={'teacher_id': teacher_id, 'title': exam.title.strip(),
        'answers': [a.upper() for a in exam.answers]})
    return rows[0]


@router.post('/exams/{exam_id}/scan')
def scan_exam(exam_id: str, scan: Scan, teacher_id: str = Depends(current_teacher)):
    import base64, io, re
    from PIL import Image, ImageOps
    rows = db('GET', 'teacher_exams', {'id': f'eq.{exam_id}', 'teacher_id': f'eq.{teacher_id}', 'select': '*'})
    if not rows:
        raise HTTPException(404, 'Không tìm thấy đề thi.')
    match = re.search(r'^data:image/[^;]+;base64,(.+)$', scan.image)
    if not match:
        raise HTTPException(422, 'Ảnh không hợp lệ.')
    try:
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(base64.b64decode(match.group(1)))))
        image.thumbnail((1800, 2400))
        gray = ImageOps.grayscale(image)
    except Exception as exc:
        raise HTTPException(422, 'Không đọc được ảnh. Hãy chụp lại phiếu rõ nét.') from exc
    answers = rows[0]['answers']; width, height = gray.size
    if width < height * .55 or width > height * 1.2:
        raise HTTPException(422, 'Ảnh cần chụp trọn phiếu theo chiều dọc.')
    # Find the four printed registration blocks, then rectify mild camera perspective.
    def marker(x0, y0, x1, y1):
        left, top, right, bottom = int(width*x0), int(height*y0), int(width*x1), int(height*y1)
        crop = gray.crop((left, top, right, bottom))
        bbox = crop.point(lambda value: 255 if value < 90 else 0).getbbox()
        if not bbox or (bbox[2]-bbox[0]) < 15 or (bbox[3]-bbox[1]) < 15:
            raise HTTPException(422, 'Không nhận diện được bốn dấu góc. Hãy chụp trọn phiếu và thử lại.')
        return (left + (bbox[0]+bbox[2])/2, top + (bbox[1]+bbox[3])/2)
    tl = marker(.01, .01, .12, .11); tr = marker(.88, .01, .99, .11)
    bl = marker(.01, .89, .12, .99); br = marker(.88, .89, .99, .99)
    def add(*vectors):
        return (sum(v[0] for v in vectors), sum(v[1] for v in vectors))
    def scale(v, factor): return (v[0]*factor, v[1]*factor)
    horizontal, vertical = scale((tr[0]-tl[0], tr[1]-tl[1]), .0567/.8866), scale((bl[0]-tl[0], bl[1]-tl[1]), .0417/.9166)
    bottom_horizontal, right_vertical = scale((br[0]-bl[0], br[1]-bl[1]), .0567/.8866), scale((br[0]-tr[0], br[1]-tr[1]), .0417/.9166)
    p00 = add(tl, scale(horizontal,-1), scale(vertical,-1))
    p10 = add(tr, horizontal, scale(right_vertical,-1))
    p01 = add(bl, scale(bottom_horizontal,-1), vertical)
    p11 = add(br, bottom_horizontal, right_vertical)
    # Pillow QUAD order: top-left, bottom-left, bottom-right, top-right.
    quad = (p00[0],p00[1],p01[0],p01[1],p11[0],p11[1],p10[0],p10[1])
    gray = gray.transform((1000, 1414), Image.Transform.QUAD, quad, resample=Image.Resampling.BICUBIC)
    width, height = gray.size
    detected, uncertain = [], []
    # Answer bubbles occupy four fixed columns, with question rows below the heading.
    for index in range(len(answers)):
        row = index % 30
        col_group = index // 30
        y = int(height * (.245 + row * .0225))
        marks = []
        for option in range(4):
            x = int(width * (.12 + option * .04 + col_group * .22))
            box = (max(0,x-8), max(0,y-8), min(width,x+9), min(height,y+9))
            crop = gray.crop(box)
            marks.append(sum(255-p for p in crop.getdata()) / max(1, crop.width*crop.height*255))
        order = sorted(range(4), key=lambda i: marks[i], reverse=True)
        detected.append('ABCD'[order[0]] if marks[order[0]] > .20 else '')
        if marks[order[0]] <= .20 or marks[order[0]] - marks[order[1]] < .055:
            uncertain.append(index+1)
    correct = sum(got == expected for got, expected in zip(detected, answers))
    result = {'exam_id': exam_id, 'answers': detected, 'score': correct, 'total': len(answers),
              'uncertain_questions': uncertain}
    saved = db('POST', 'teacher_results', body={'teacher_id': teacher_id, **result})
    result['id'] = saved[0]['id'] if saved else None
    return result


@router.get('/results')
def results(teacher_id: str = Depends(current_teacher)):
    return db('GET', 'teacher_results', {'teacher_id': f'eq.{teacher_id}',
        'select': 'id,exam_id,score,total,created_at,uncertain_questions', 'order': 'created_at.desc', 'limit': 100})
