# EduShift

EduShift gồm web Next.js, ứng dụng sinh viên Expo và API FastAPI.

## Làm việc với Git

Phát triển trên `dev`. Tạo pull request từ `dev` vào `main` để phát hành.
Workflow CI kiểm tra API và web trên mỗi push lên `dev`/`main` và mỗi pull request vào `main`.
Sau khi merge vào `main` và CI đạt, workflow đẩy hai image lên GHCR:

- `ghcr.io/lvquyen15506/edushift-api:latest`
- `ghcr.io/lvquyen15506/edushift-web:latest`

Mỗi image cũng có tag `sha-<commit>` để có thể triển khai hoặc quay lại bản cụ thể.
VPS production dùng [hướng dẫn triển khai](deploy/README.md). Sau khi merge vào
`main`, workflow triển khai image đã qua kiểm tra lên VPS qua SSH.
Service `push-worker` gửi thông báo đã lưu qua Expo Push Service; VPS cần
truy cập ra `exp.host:443`.

## Chạy phát triển

`docker compose up --build` khởi động PostgreSQL, API, web và Mailpit.
Web: http://localhost:3000; tài liệu API: http://localhost:8000/docs;
hộp thư thử nghiệm: http://localhost:8025.

Đăng ký sinh viên hoặc doanh nghiệp yêu cầu mã OTP gửi tới email. Mã có hiệu lực
10 phút, tối đa 5 lần nhập sai, và có thể gửi lại sau 60 giây. Doanh nghiệp vẫn
cần quản trị viên duyệt trước khi đăng ca. Trang đăng nhập có liên kết “Quên mật
khẩu?” để đặt lại mật khẩu bằng OTP. Mailpit chỉ nhận thư trong môi trường phát
triển; không chuyển thư ra email thật.

Khi triển khai thật, cấu hình `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`,
`SMTP_USERNAME`, `SMTP_PASSWORD` và `SMTP_STARTTLS` hoặc `SMTP_SSL` trên API,
cùng `JWT_SECRET` riêng. Không dùng Mailpit làm SMTP sản xuất.

Build mobile và cấu hình EAS được mô tả trong [mobile-app/README.md](mobile-app/README.md).
