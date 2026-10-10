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

Mặc định local gửi OTP vào Mailpit, xem thư tại http://localhost:8025. Nếu muốn
thử gửi email thật từ máy local, tạo `.env` ở thư mục gốc repo (cùng cấp với
`docker-compose.yml`) với các biến `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`,
`SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_STARTTLS` và `SMTP_SSL`. File này đã
được Git bỏ qua. Chạy `docker compose up -d --build --force-recreate api` để
API nhận cấu hình mới. Đừng sao chép `.env` của VPS về máy local.

Khi triển khai thật, cấu hình `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`,
`SMTP_USERNAME`, `SMTP_PASSWORD` và `SMTP_STARTTLS` hoặc `SMTP_SSL` trên API,
cùng `JWT_SECRET` riêng. Không dùng Mailpit làm SMTP sản xuất.

Build mobile và cấu hình EAS được mô tả trong [mobile-app/README.md](mobile-app/README.md).

## Gói đăng ca và thanh toán

Doanh nghiệp đã được duyệt có 5 lượt đăng ca Free tổng cộng. Ca tạo thành công mới
trừ lượt; lượt đã dùng không được hoàn khi đóng hoặc xóa ca. `GET /api/employer/plan`
trả gói hiện tại, lượt đã dùng/còn lại và hạn dùng. `GET /api/plans` trả các gói
đang bán; admin quản lý gói tại `/admin/plans` và API `/api/admin/plans`. Gói đã
mua giữ giá, hạn mức và thời hạn tại lúc tạo đơn.

`PAYMENTS_MODE` mặc định là `disabled`. Để thử luồng mua trên máy local, đặt
`PAYMENTS_MODE=sandbox` trong `.env` của Docker Compose rồi khởi động lại API.
Checkout sandbox tại `/checkout/<payment-id>` cho phép mô phỏng thành công hoặc
hủy; webhook thử nghiệm `POST /api/payments/webhook` cần header
`x-edushift-signature` là HMAC-SHA256 của nguyên body với
`PAYMENT_WEBHOOK_SECRET`. Chỉ phản hồi thành công hợp lệ mới kích hoạt gói;
gửi lại cùng sự kiện không cộng thêm lượt. Sandbox không xử lý tiền thật.

Các API mới: `GET /api/public/shifts`, `GET /api/employer/plan`,
`GET /api/plans`, `GET /api/payments/config`, `POST /api/employer/checkout`,
`GET /api/employer/payments`, `GET /api/employer/payments/{id}`,
`POST /api/payments/sandbox/{id}`, `POST /api/payments/webhook`,
`/api/admin/plans`, `/api/admin/users` và `/api/admin/notification-policies`.
Chi tiết payload và quyền truy cập có tại `/docs` của API.

Trang `/pricing`, `/support`, `/terms` và `/privacy` mở công khai. Điều khoản và
chính sách riêng tư hiện là bản nháp; kênh hỗ trợ chính thức sẽ hiển thị sau khi
cấu hình `NEXT_PUBLIC_SUPPORT_EMAIL` lúc build image web. Trước khi mở thanh
toán thật cần chọn nhà cung cấp, tài khoản merchant, khóa và webhook HTTPS,
đồng thời duyệt nội dung pháp lý và thông tin hỗ trợ.
