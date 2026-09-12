# Công cụ cho Toán

Bộ tiện ích hỗ trợ chuẩn bị bài giảng, đề thi và tài liệu học tập.

## Công cụ

- `/tex-to-pdf`: biên dịch mã LaTeX hoặc JSON chứa mã TeX thành PDF.
- `/tikz-editor`: vẽ hình TikZ, xem trước và tải PNG, PDF hoặc TEX.
- `/json-formatter`: định dạng, nén và kiểm tra JSON trên trình duyệt.
- `/pdf-tools`: gộp PDF, chia theo khoảng trang và xuất ảnh PNG.

## Kiến trúc

- `frontend/`: React + Vite, giao diện và điều hướng.
- `backend/main.py`: FastAPI, API xử lý PDF và trả file trong cùng request.
- `api/index.py`: entrypoint Python cho Vercel Functions.
- `backend/services/tikz_renderer.py`: gửi mã đến LaTeX.Online để biên dịch, tạo ảnh xem trước bằng PyMuPDF.

TikZ và TeX cần backend cùng kết nối Internet đến LaTeX.Online. Công cụ PDF xử lý bằng backend; JSON Formatter chạy trên trình duyệt. PDF/ZIP được trả trực tiếp; kết quả TikZ được trả dưới dạng JSON chứa các file mã hóa base64. Frontend tạo Blob URL để xem trước và tải xuống, thu hồi URL khi thay kết quả hoặc rời trang. File tạm TikZ có thư mục riêng cho mỗi request và được dọn ngay khi xử lý xong, kể cả khi có lỗi. Không cần Blob Storage, database hoặc lưu file giữa các lần gọi function.

## Deploy cả frontend và backend lên Vercel

1. Đẩy repository lên GitHub rồi import vào Vercel.
2. Đặt **Root Directory là thư mục gốc repository (`.`)**, không chọn `frontend` hoặc `backend`.
3. Chọn preset **Vite**. `vercel.json` đã cấu hình cài frontend bằng `npm --prefix frontend ci`, build bằng `npm --prefix frontend run build`, output là `frontend/dist`.
4. Deploy. Node.js được ghim ở 22.x trong `package.json`, Python ở 3.12 trong `.python-version`. Thư viện Python được cài từ `requirements.txt` ở thư mục gốc.

Frontend và API dùng chung domain: `/api/*` chuyển đến Python function; các trang giao diện chuyển đến `index.html`. API mặc định dùng đường dẫn tương đối `/api`, không cần biến môi trường hay khóa dịch vụ. Nếu từng đặt `VITE_API_BASE_URL` trỏ đến localhost, hãy xóa biến đó trước khi deploy.

Giới hạn:

- Tổng PDF tải lên mỗi lần tối đa **4 MB (4 × 1024 × 1024 byte)**; khi gộp, tính tổng tất cả file, tối đa 30 file.
- PDF/ZIP kết quả tối đa 4 MB. PNG có thể lớn hơn PDF đầu vào, khi đó cần giảm DPI hoặc số trang.
- Toàn bộ response TikZ sau mã hóa base64 cũng tối đa 4 MB, nên tổng file gốc có thể chỉ khoảng 3 MB. Backend báo lỗi rõ ràng nếu vượt giới hạn.
- Function có thời gian xử lý tối đa 60 giây; yêu cầu đến LaTeX.Online có timeout 45 giây.
- Kết quả chỉ giữ trên trang đang mở. Tải file trước khi tải lại hoặc chuyển trang.

Sau deploy, kiểm tra `/api/health`, `/api/docs`, mở trực tiếp `/pdf-tools` và `/tikz-editor`, rồi thử gộp PDF và biên dịch mẫu TikZ.

Tham khảo: [Python Functions](https://vercel.com/docs/functions/runtimes/python/api-directory), [Vite trên Vercel](https://vercel.com/docs/frameworks/frontend/vite), [giới hạn payload Vercel Functions](https://vercel.com/docs/functions/limitations).

## Cách chạy

Chạy `start.bat` sau khi cài các thư viện, hoặc mở hai terminal:

Backend:

```powershell
cd D:\tools\backend
pip install -r requirements.txt
python main.py
```

Frontend:

```powershell
cd D:\tools\frontend
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/api/docs

Vite dev server chuyển `/api` đến `http://127.0.0.1:8000`, nên code frontend dùng cùng đường dẫn khi chạy local và trên Vercel.

## Kiểm tra frontend

```powershell
cd D:\tools\frontend
npm run lint
npm run build
```

## Kiểm tra API và file trả về

Chạy từ thư mục gốc:

```powershell
python -m pip install -r tests/requirements.txt
python -B -m unittest discover -s tests -v
node --test tests/frontend-api.test.mjs
```

Các bài kiểm tra backend bao gồm nội dung PDF/ZIP, giới hạn upload tổng 4 MB, giới hạn response, cô lập file giữa các request và dọn thư mục tạm. Kiểm tra TikZ tự động giả lập dịch vụ biên dịch bên ngoài.
