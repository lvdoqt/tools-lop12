# Công cụ cho Toán

Bộ tiện ích hỗ trợ chuẩn bị bài giảng, đề thi và tài liệu học tập.

## Công cụ

- `/word-shuffle`: đọc đề Word Toán 3 phần, nhận diện đáp án, trộn câu trong từng phần, tải ZIP đề và Excel TNmaker 2025.
- `/edit-html`: mở/dán HTML, sửa mã hoặc văn bản trực quan bên trái, xem trước HTML/CSS và LaTeX bên phải; tải mã HTML về máy.
- `/tex-to-pdf`: biên dịch mã LaTeX hoặc JSON chứa mã TeX thành PDF.
- `/tikz-editor`: vẽ hình TikZ, xem trước và tải PNG, PDF hoặc TEX.
- `/json-formatter`: định dạng, nén và kiểm tra JSON trên trình duyệt.
- `/pdf-tools`: gộp PDF, chia theo khoảng trang và xuất ảnh PNG.
- `/latex-to-json`: đọc đề thi `.tex`, chuyển câu hỏi sang schema Quiz Bank, tạo SVG và gắn link Cloudinary bằng HTML `<img>`.

## Edit HTML

Mở `/edit-html`, chọn **Mở HTML** (tệp `.html`/`.htm` UTF-8, tối đa 2 MB), kéo thả vào vùng mã hoặc dán mã trực tiếp. Chế độ **Văn bản** cho phép sửa nội dung và định dạng bằng thanh công cụ: tiêu đề, phông/cỡ/màu chữ, đậm/nghiêng/gạch chân/gạch ngang, chỉ số, căn lề, danh sách, thụt lề, trích dẫn, liên kết, ảnh qua URL, bảng, đường kẻ, mã và LaTeX. Có hoàn tác/làm lại, sao chép, đổi tên tệp, tải HTML và xem trước điện thoại.

Công thức hỗ trợ `$…$`, `$$…$$`, `\(…\)`, `\[…\]`, hiển thị bằng KaTeX đóng gói cùng frontend. Công thức trong vùng Văn bản giữ mã LaTeX để chỉnh trực tiếp. **Tải HTML** xuất mã nguồn, giữ nguyên LaTeX; nếu mở tệp độc lập cần trình hiển thị toán của trang đó. Xem trước và soạn văn bản lọc HTML bằng DOMPurify, cô lập trong iframe và không chạy JavaScript. Ảnh/CSS bên ngoài cần URL đầy đủ và kết nối mạng; không tải thư mục tài nguyên đi kèm tệp. Chế độ Văn bản chuẩn hóa phần thân HTML khi sửa; dùng Mã HTML nếu cần giữ cấu trúc nguồn nguyên vẹn. Nội dung chỉ giữ trong phiên trang đang mở; tải tệp trước khi rời trang.

## Trộn đề Word

Mở `/word-shuffle`, tải một file `.docx` tối đa 4 MB rồi bấm **Phân tích đề**. Đề cần đủ tiêu đề **PHẦN I**, **PHẦN II**, **PHẦN III** và các câu bắt đầu bằng `Câu 1:` hoặc `Câu 1.`, kể cả nhãn in đậm hoặc chia thành nhiều đoạn định dạng trong Word. Phần I dùng nhãn A/B/C/D, gạch chân nhãn đáp án đúng. Phần II dùng a)/b)/c)/d), nhận nhãn ý đúng được gạch chân hoặc kết luận `a) ĐÚNG`, `b) SAI`… trong Lời giải (cùng dòng hoặc khác dòng, không phân biệt hoa/thường). Kết luận tường minh được dùng cho từng ý; nếu không có gạch chân thì cần đủ bốn kết luận. Ý gạch chân nhưng lời giải ghi SAI, hoặc lời giải tự mâu thuẫn, sẽ báo lỗi. Bản giáo viên gạch chân các ý đúng đã nhận diện. Phần III lấy số từ dòng `Đáp án: …`, `Đáp số: …` hoặc `Trả lời: …` dưới `Lời giải`, nhận số âm và cả dấu chấm/phẩy thập phân; bỏ dấu chấm cuối câu khi lấy đáp án (`Đáp số: 446.` → `446`, `Đáp số: 5.19.` → `5,19`). Câu thiếu hoặc có nhiều đáp án Phần I, thiếu đáp án số, thiếu nhãn phương án sẽ chặn xuất và nêu vị trí cần sửa.

Kiểm tra đáp án được đánh dấu trong bản phân tích, nhập **số đề (1–50)** và **mã bắt đầu (3–4 chữ số)**. Đảo thứ tự câu trong cùng phần, đánh số lại từ 1 ở mỗi phần; đồng thời đảo A–D ở Phần I và cập nhật đáp án trong Word/Excel. Giữ thứ tự a–d ở Phần II. Các mã trong một lần xuất khác nhau về thứ tự câu hoặc phương án. Bảng đối chiếu ghi thêm nhãn phương án mới tương ứng nhãn gốc; các tham chiếu rõ ràng như “Chọn B” trong lời giải được cập nhật theo nhãn mới. Không tự giải hoặc sửa đáp án toán học.

Nhập tên **Sở GDĐT** và **Trường THPT** trên trang. Đầu đề có Sở/Trường bên trái, “ĐỀ THI THỬ TN THPT 2027”, “MÔN: TOÁN”, thời gian 90 phút ở khối giữa; dòng dưới là mã đề màu đỏ, đậm, cỡ 18 pt. Đầu đề mới thay phần tiêu đề cũ trước PHẦN I.

ZIP gồm `De_<mã>.docx` dành cho học sinh (bỏ lời giải, dấu gạch chân phương án và màu highlight), tùy chọn `loi_giai-<mã>.docx` gạch chân đáp án đúng và giữ lời giải (không chèn dòng “Đáp án:” ở Phần I, II), `Dap_an_TNMaker_2025.xlsx`, `Doi_chieu_cau_goc.json` và hướng dẫn. Sao chép các khối OOXML và tài nguyên gốc để giữ MathType/OLE, Equation, hình và bảng trong câu. Phương án cùng dòng được tách theo nội dung XML rồi ghép lại theo số phương án mỗi dòng của bản gốc; phương án nhiều đoạn được di chuyển cùng nhau. Phương án trong bảng được xuất thành đoạn văn để đảo vị trí. Bản xem nhanh chỉ hiển thị phần chữ, không dựng hình/MathType; câu hỏi nằm hoàn toàn trong bảng, content control và tài liệu chưa chấp nhận Track Changes sẽ báo lỗi.

Excel đối chiếu với [mẫu nhập trực tiếp TNmaker 2025](https://tnmaker.net/nap-dap-an-phieu-tltn-2025/): một sheet `Dữ liệu`, ô A1 `Câu\Mã đề`, mã đề theo cột, số câu liên tục qua ba phần theo hàng. Phần II dùng chuỗi bốn ký tự `Đ`/`S`, Phần III lưu chuỗi số với dấu phẩy. Khi nhập TNmaker, chọn phiếu 2025 và đúng số câu mỗi phần. Đã kiểm tra cấu trúc theo file mẫu chính thức; chưa kiểm tra nhập trên ứng dụng TNmaker điện thoại.

Frontend tạo từng mã qua `/api/word-shuffle/export` với cùng phiên trộn rồi ghép ZIP bằng trình duyệt; mỗi response tối đa 4 MB, ZIP cuối có thể lớn hơn. Giữ trang mở đến khi xong; có nút hủy. Backend xử lý trong bộ nhớ, không lưu file sau request. API phân tích: `/api/word-shuffle/analyze`. Cài lại requirements để có `openpyxl`, chạy `npm --prefix frontend install` để có `fflate`.

Kiểm tra: `python -m unittest discover -s tests -p test_word_shuffle.py -v`; khi chạy local server, `python tests/browser_word_shuffle.py` thử đủ 4 mã bằng file `DE-TOAN-MAU-TRON.docx` nếu có.

## Kiến trúc ứng dụng

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

`requirements.txt` ở thư mục gốc khai báo trực tiếp các thư viện để bước phân tích dependency của Vercel không phải đọc file dẫn bằng `-r`. Khi cập nhật thư viện, giữ danh sách này đồng bộ với `backend/requirements.txt` dùng để chạy local.

Frontend và API dùng chung domain: `/api/*` chuyển đến Python function; các trang giao diện chuyển đến `index.html`. API mặc định dùng đường dẫn tương đối `/api`, không cần biến môi trường hay khóa dịch vụ. Nếu từng đặt `VITE_API_BASE_URL` trỏ đến localhost, hãy xóa biến đó trước khi deploy.

### API LaTeX → MathType

App khác có thể gọi `POST https://tool.lop12.com/api/json-to-word/latex-to-mathtype` với JSON `{"latex":"\\frac{x_1^2}{\\sqrt{2}}"}` (gửi biểu thức LaTeX thuần, không bọc `$...$`). Response có `mathtype_ole_base64`: giải mã Base64 thành tệp `.bin`, đặt vào `word/embeddings/` của DOCX và tạo quan hệ OLE với content type `application/vnd.openxmlformats-officedocument.oleObject`. Đây là đối tượng MathType chỉnh sửa được, không phải ảnh. Response cũng có `omml` cho Office Math và `mathml` để xem trước/chuyển đổi tiếp. CORS đã mở cho app trên domain khác.

Riêng chức năng upload hình của LaTeX → JSON cần cấu hình Cloudinary như hướng dẫn bên dưới.

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

## LaTeX → JSON Quiz Bank

1. Mở `/latex-to-json`, chọn file `.tex` UTF-8 (tối đa 1 MB) hoặc dán mã đề.
2. Nhập tên bộ câu hỏi, chọn độ khó mặc định và bấm **Đọc đề và kiểm tra**.
3. Kiểm tra số câu, đáp án và hình. Bấm **Tạo SVG và tải hình lên** nếu đề có hình.
4. Khi tất cả hình đã có link, tải `quiz-bank.json` hoặc sao chép JSON để import.

Hỗ trợ môi trường `ex`, `\choice` → `mcq`, `\choiceTF`/`\choiceTFt` → `msq`, `\shortans` → `sa`, `\True`, `\loigiai`, `\immini` (kể cả lựa chọn nằm trong đối số đầu), tùy chọn `[4]`/`[oly]`, comment và dấu ngoặc lồng nhau. Câu đúng/sai lưu các phương án đúng như `A,B,C`; trả lời ngắn bỏ dấu `$`, chuẩn hóa `26{,}9` thành `26,9`. Độ khó do người dùng chọn; chương trình giữ nguyên đáp án đã đánh dấu, không tự giải toán hoặc sửa đáp án.

Công thức LaTeX được giữ nguyên, riêng `\hoac{…}` và `\heva{…}` được thay bằng `\left[\begin{aligned}…\end{aligned}\right.` và `\left\{\begin{aligned}…\end{aligned}\right.` để hiển thị mà không cần khai báo macro. Hỗ trợ đối số lồng nhau trong câu hỏi, phương án, lời giải và ô bảng. Bảng `tabular` đơn giản chuyển thành HTML `<table border="1">`, có `border-collapse: collapse` và viền đen 1px trên bảng cùng từng ô để kẻ đầy đủ khung. Hình được thay bằng `<img src="https://...svg" alt="..." />` trong chính trường `question`, `option_a`… hoặc `explanation` chứa hình. Quiz Bank cần hỗ trợ HTML và công thức LaTeX. Ảnh `\includegraphics`, file `\input`, bảng gộp ô và cấu trúc chưa hỗ trợ sẽ báo lỗi; không âm thầm bỏ câu hoặc hình. Các macro riêng khác ngoài hình vẫn cần được trình hiển thị toán của Quiz Bank hỗ trợ.

### Cloudinary

Sao chép `.env.example` thành `.env` ở gốc repository, rồi điền:

```dotenv
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLOUDINARY_FOLDER=TDupsave
```

Backend đọc `.env` khi khởi động; khởi động lại sau khi đổi cấu hình. Khi deploy Vercel, thêm bốn biến trên vào **Environment Variables** của project. Không dùng tiền tố `VITE_` cho API secret. `.env` bị loại khỏi Git và Vercel upload. Frontend chỉ nhận trạng thái kết nối, cloud name và folder. Chữ ký SHA-256 và upload thực hiện trên backend; mỗi SVG dùng public ID theo hash nội dung, `overwrite=false` để thử lại mà không ghi đè hình khác.

Nếu backend chưa có tài khoản Cloudinary, trang cho nhập cloud name và **unsigned upload preset** (preset cần cho phép SVG), rồi upload trực tiếp từ trình duyệt. Các giá trị này chỉ giữ trong trang hiện tại; có thể đặt mặc định bằng `VITE_CLOUDINARY_CLOUD_NAME` và `VITE_CLOUDINARY_UPLOAD_PRESET`.

### Tạo SVG và xử lý lỗi

- Dùng API JavaScript của [TikZJax qua isomorphic-tikzjax](https://github.com/prinsss/isomorphic-tikzjax) trong Web Worker, xử lý tuần tự để giao diện không bị treo. Đây là thư viện chạy trong trình duyệt, không phụ thuộc một REST endpoint TikZJax công cộng.
- Tài nguyên TeX/WASM và font ghim phiên bản `0.1.1`, được bước `predev`/`prebuild` sao chép từ npm package để phục vụ cùng ứng dụng. Font được nhúng vào SVG để hình hiển thị độc lập qua `<img>`.
- `tkz-tab`, nhãn tiếng Việt hoặc hình TikZJax không biên dịch được dùng LaTeX.Online → PDF → SVG (chữ thành đường vector). Trang ghi rõ bộ biên dịch của mỗi hình.
- Mỗi lần gọi backend chỉ xử lý một hình: biên dịch bổ sung tối đa 45 giây, upload tối đa 35 giây, phù hợp function 60 giây. SVG upload tối đa 2 MB.
- Có thể hủy, kiểm tra lỗi từng hình và thử lại. SVG và link thành công được giữ trong trang, tránh upload lại; xuất JSON bị khóa khi còn hình chưa có link. Chỉnh sửa đề hoặc rời trang sẽ xóa kết quả đang giữ trên trình duyệt.

Tham khảo: [Cloudinary Upload API](https://cloudinary.com/documentation/image_upload_api_reference), [chữ ký xác thực](https://cloudinary.com/documentation/authentication_signatures).

### Kiểm tra

```powershell
python -m unittest discover -s tests -p 'test_*.py'
node --test tests/frontend-api.test.mjs tests/quiz-conversion.test.mjs
```

Kiểm tra trình duyệt tùy chọn (cần `pip install playwright`, Chrome và hai server đang chạy):

```powershell
python tests/browser_latex_smoke.py
# Thực sự upload hình của T.Do.tex lên Cloudinary:
python tests/browser_latex_smoke.py --upload
```

## Kiểm tra frontend

Kiểm tra Edit HTML trên Chrome (cần Playwright và frontend đang chạy): `python tests/browser_html_editor.py`. Bao gồm upload, định dạng, đồng bộ văn bản/mã, LaTeX, sao chép/tải HTML, cô lập script và bố cục điện thoại.

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

## Thư viện TikZ: Cloudinary + Supabase

Trang `/tikz-editor` có thư viện lưu ảnh SVG/PNG và mã TikZ gốc, tìm kiếm, mở lại, sao chép link/mã và tải file. Chạy [SQL tạo bảng](supabase/tikz_library.sql), thêm cấu hình trong `.env.example`, rồi làm theo [hướng dẫn thiết lập](supabase/README.md). Mở thư viện bằng `TIKZ_LIBRARY_KEY` để tự lưu các hình vẽ thành công. Khóa Supabase chỉ dùng ở backend.
