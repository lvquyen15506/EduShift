# KẾ HOẠCH TRIỂN KHAI DỰ ÁN EDUSHIFT (PHASE 1 - MVP)

## 1. MỤC TIÊU CỐT LÕI (MVP)
- **Web App (Doanh nghiệp):** Đăng nhập, đăng tải ca làm, quản lý ứng viên. **Yêu cầu UI:** Code Web bằng Next.js + TailwindCSS khớp chính xác 100% với file thiết kế Figma.
- **Mobile App (Sinh viên):** Đăng ký tài khoản, đồng bộ/nhập lịch học, nhận thông báo ca làm phù hợp. **Yêu cầu UI:** React Native + Expo, có thể linh hoạt điều chỉnh thiết kế Figma sao cho phù hợp nhất với trải nghiệm trên màn hình điện thoại thực tế. Cấu hình CI/CD để build APK/IPA tự động.
- **Backend (Python/FastAPI):** API cung cấp cho cả Web và Mobile. Kế thừa logic đồng bộ lịch và quản lý hồ sơ sinh viên từ dự án `NoteClass` (mô-đun `sync_calendar` và `profile`).

---

## 2. LỘ TRÌNH THỰC HIỆN (ROADMAP)

### Giai đoạn 1: Khởi tạo Kiến trúc & Cơ sở dữ liệu (Tuần 1)
1. Khởi tạo 3 thư mục dự án độc lập trong Monorepo: `web-app`, `mobile-app`, `backend`.
2. Khởi tạo Git & Cấu hình CI Github Actions cho Mobile App (Đã hoàn thành `git init` và tạo file `mobile-build.yml`).
3. Dựng Database Schema bằng SQLAlchemy/PostgreSQL trên thư mục `backend`.
4. Viết API Đăng ký / Đăng nhập (Authentication) cho Sinh viên và Doanh nghiệp.

### Giai đoạn 2: Tích hợp Lịch học & Thuật toán Matching (Tuần 2)
1. Trích xuất logic và tham khảo cấu trúc code của thư mục `/lib/features/sync_calendar` từ dự án `NoteClass`.
2. Xây dựng API cho phép sinh viên import lịch học hoặc chọn lịch rảnh.
3. Viết API tính điểm **Match Score** khi doanh nghiệp tạo ca làm mới.

### Giai đoạn 3: Cắt HTML/CSS Web App (Tuần 3)
1. Setup Next.js và TailwindCSS cho thư mục `web-app`.
2. Đọc các thông số (Mã màu, Typography, Khoảng cách) từ Figma Token.
3. Code các trang chính:
   - Dashboard (Trang tổng quan).
   - Form Đăng ca làm mới.
   - Bảng danh sách ứng viên (hiển thị Match Score).

### Giai đoạn 4: Phát triển Mobile App (Tuần 4)
1. Setup React Native Expo cho `mobile-app`.
2. Tạo các màn hình cơ bản:
   - Màn hình Lịch học.
   - Danh sách Việc làm gợi ý.
   - Chi tiết công việc & Nút "Ứng tuyển".
3. Lấy API từ Backend gắn vào App.

### Giai đoạn 5: Build, Test & Phân phối (Tuần 5)
1. Chạy CI Action trên Github để xuất ra file `.apk` (Android) và `.ipa` (iOS).
2. Kiểm tra Test Flight / Cài file APK nội bộ để test luồng: "Doanh nghiệp đăng việc (Web) -> Sinh viên nhận thông báo và ứng tuyển (App)".
3. Chỉnh sửa bug và hoàn thiện UI Mobile.
