# Thiết lập thư viện TikZ

1. Tạo project Supabase. Trong SQL Editor, chạy toàn bộ `tikz_library.sql` trong thư mục này.
2. Thêm các biến sau vào `.env` ở thư mục gốc dự án:

   ```dotenv
   SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   SUPABASE_SECRET_KEY=sb_secret_YOUR_SERVER_KEY
   TIKZ_LIBRARY_KEY=YOUR_PRIVATE_LIBRARY_PASSWORD
   ```

   Lấy Project URL và Secret key trong cấu hình Supabase. Nếu dùng khóa JWT `service_role` cũ, đặt `SUPABASE_SERVICE_ROLE_KEY` thay cho `SUPABASE_SECRET_KEY`. Không dùng khóa `anon` / `publishable`. Backend hỗ trợ cả hai loại khóa quản trị; khóa mới chỉ gửi qua header `apikey` theo [tài liệu Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

3. Giữ cấu hình Cloudinary hiện có: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`.
4. Khởi động lại backend. Khi triển khai Vercel, thêm các biến tương tự vào Environment Variables của project và redeploy; `.env` trên máy không tự được đưa lên Vercel.
5. Mở `/tikz-editor`, nhập giá trị `TIKZ_LIBRARY_KEY` vào ô **Mã truy cập thư viện**. Đây là mật khẩu tự đặt, không phải khóa API Supabase. Vẽ hình để tự lưu, hoặc mở thư viện sau khi vẽ để lưu kết quả vừa tạo.

Mỗi bản ghi lưu nguyên mã người dùng nhập, tên, DPI, link SVG/PNG và ID Cloudinary. SVG được tạo từ cùng PDF với PNG, chữ chuyển thành đường nét. Link PNG dùng chuyển đổi Cloudinary `f_png,dn_<dpi>`. Mở một hình cũ không gọi lại trình biên dịch. Nút tải TEX trong thư viện xuất mã gốc; TEX của lần biên dịch mới là tài liệu LaTeX đã được bọc để biên dịch.

Thư viện dùng chung một mã truy cập, chưa phải hệ thống tài khoản riêng cho từng người. Mã truy cập chỉ giữ trong bộ nhớ của trang; tải lại trang cần nhập lại. Các API thư viện đều kiểm tra mã này. SQL bật RLS và không cấp quyền cho `anon` hay `authenticated`; khóa Supabase quản trị chỉ nằm ở backend, không đặt tiền tố `VITE_` cho khóa này.

Link ảnh Cloudinary là link công khai có thể chia sẻ. Mã truy cập bảo vệ danh mục và mã TikZ, không biến các link ảnh thành riêng tư. **Xóa khỏi thư viện** chỉ xóa bản ghi Supabase; giữ ảnh Cloudinary để các tài liệu đã dùng link không bị hỏng. Khi Supabase lỗi sau khi upload, ảnh có thể đã tồn tại trên Cloudinary: nút thử lại dùng ID ảnh ổn định, không upload thành nhiều file khác nhau. Chỉ báo lưu thành công khi bản ghi Supabase đã được lưu.

Giới hạn hiện tại: mỗi hình lưu trang đầu của PDF (giống phần xem trước trước đây); danh sách tải 25 hình mỗi đợt; SVG tối đa 2 MB; tổng phản hồi biên dịch tối đa 4 MB. PDF chỉ tải ở lần biên dịch mới, không lưu lâu dài vào thư viện. Nên định kỳ sao lưu bảng Supabase và tài nguyên Cloudinary.
