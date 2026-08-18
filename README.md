# Tools All — Bộ công cụ xử lý file đa năng

## 🚀 Kiến trúc

```
d:\tools\
├── start.bat              ← Double-click để chạy cả 2 server
├── backend/               ← Python FastAPI Server
│   ├── main.py            ← API endpoints
│   ├── requirements.txt
│   └── services/
│       ├── pdf_converter.py    ← pdf2docx + PyMuPDF
│       └── drive_downloader.py ← Google Drive bypass
└── frontend/              ← React (Vite)
    └── src/
        ├── api.js              ← API client
        ├── App.jsx             ← Router setup
        ├── index.css           ← Design system
        ├── components/         ← Navbar, Background, Toast
        └── pages/
            ├── HomePage.jsx
            ├── PdfToWordPage.jsx
            └── DriveDownloaderPage.jsx
```

## ⚡ Cách chạy

### Cách 1: Chạy tự động
```
Double-click file start.bat
```

### Cách 2: Chạy thủ công

**Terminal 1 — Backend:**
```bash
cd d:\tools\backend
pip install -r requirements.txt
python main.py
```

**Terminal 2 — Frontend:**
```bash
cd d:\tools\frontend
npm install
npm run dev
```

## 🌐 Truy cập
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs (Swagger)**: http://localhost:8000/docs

## 🛠️ Công cụ

### 1. PDF → Word
- **Backend**: Python `pdf2docx` + `PyMuPDF`
- 2 chế độ: Trích xuất văn bản (giữ layout) hoặc chuyển thành hình ảnh HD
- Hỗ trợ đề toán, công thức, bảng biểu

### 2. Google Drive Downloader
- Tải file bị giới hạn "chỉ cho xem"
- Nhiều phương thức: Direct, API v3, Export, Proxy Python
- Server proxy bypass CORS & restrictions

### 🔜 Sắp ra mắt
- Word → PDF
- TeX → PDF
- JSON Formatter
- Merge PDF
