# Triển khai EduShift trên VPS với aaPanel và Nginx

Ứng dụng chạy bằng Docker Compose trong /opt/edushift. Giữ site root
/www/wwwroot/edushift.site cho aaPanel/Nginx; không đặt .env chứa mật khẩu
trong thư mục web. Nginx chuyển edushift.site tới web và
api.edushift.site tới API. Trình duyệt web vẫn gọi /api qua proxy nội bộ
của Next.js; mobile gọi https://api.edushift.site.

## 1. VPS và DNS

- Cài Docker Engine và Docker Compose plugin; kiểm tra bằng docker compose version. Không cần cài Node.js, Python hoặc PostgreSQL trên host.
- Với máy 2 GB RAM, bật swap 2 GB nếu chưa có, theo dõi free -h và df -h. Giữ vài GB trống cho image, log và backup.
- Tạo A record @ và api về IP VPS; thêm www nếu muốn dùng www.edushift.site.
- Chỉ mở 80/443 và SSH trong firewall; giới hạn cổng quản trị aaPanel theo IP của bạn. Không mở 3000, 8000 hay 5432 ra Internet.
- Tạo SSH user riêng để deploy, cấp quyền chạy Docker và cho user đó sở hữu /opt/edushift (ví dụ: sudo install -d -o deploy -g deploy -m 750 /opt/edushift). User thuộc nhóm docker có quyền tương đương root, nên chỉ cấp cho user tin cậy.

## 2. Biến môi trường và SMTP

Chép deploy/.env.example thành /opt/edushift/.env, sửa các giá trị
và đặt quyền chmod 600 /opt/edushift/.env. Dùng openssl rand -hex 24 cho
POSTGRES_PASSWORD và đặt đúng cùng mật khẩu trong DATABASE_URL. Dùng một
giá trị khác từ openssl rand -hex 32 cho JWT_SECRET. Không đổi mật khẩu
PostgreSQL trong .env sau khi volume đã tạo nếu chưa đổi mật khẩu trong DB.

OTP cần dịch vụ SMTP gửi thư thật. Xác minh domain gửi trên dịch vụ đó,
thêm DNS SPF/DKIM/DMARC theo hướng dẫn của họ, rồi điền SMTP_HOST,
SMTP_PORT, SMTP_FROM, SMTP_USERNAME, SMTP_PASSWORD và STARTTLS/SSL.
Mailpit chỉ dùng ở máy phát triển. Compose production yêu cầu SMTP để
tránh mở đăng ký khi thư OTP không thể được gửi.

Sau khi API chạy, tạo admin bằng lệnh dưới đây. Không chạy seed.py trên
production vì script đó tạo tài khoản demo có mật khẩu cố định.

~~~bash
cd /opt/edushift
docker compose --env-file .env -f compose.prod.yml exec api python -m app.create_admin admin@edushift.site
~~~

Lệnh hỏi mật khẩu trực tiếp, không ghi mật khẩu vào lịch sử shell.

## 3. aaPanel và Nginx

Tạo site edushift.site với root /www/wwwroot/edushift.site; tạo site thứ
hai api.edushift.site với một root rỗng riêng. Trong Reverse Proxy của
aaPanel, chuyển toàn bộ / của site web đến http://127.0.0.1:3000 và của
site API đến http://127.0.0.1:8000. Bật chuyển tiếp Host và các header
X-Forwarded-For, X-Forwarded-Proto. Cấp chứng chỉ Let's Encrypt cho cả
hai host, bật chuyển HTTP sang HTTPS và tự gia hạn.

~~~bash
curl -fsS https://api.edushift.site/api/health
curl -I https://edushift.site/
~~~

Web dùng /api cùng origin nên không cần URL API công khai cho web.
Trong EAS preview và production, đặt EXPO_PUBLIC_API_URL thành
https://api.edushift.site rồi build lại mobile; APK/IPA cũ đang trỏ
localhost/LAN sẽ không tự đổi URL.

## 4. CD khi merge vào main

Workflow CI and publish images chạy test, đẩy image lên GHCR rồi SSH vào
VPS để triển khai đúng tag sha-<commit>. Trước lần merge đầu tiên:

1. Tạo khóa SSH Ed25519 riêng cho CD. Thêm public key vào authorized_keys
   của SSH user trên VPS; lưu private key trong GitHub Actions secret
   VPS_SSH_KEY, không gửi khóa qua chat.
2. Tạo secrets VPS_HOST (IP hoặc hostname), VPS_USER (SSH user) và
   VPS_KNOWN_HOSTS (dòng host key của VPS). Lấy host key qua ssh-keyscan
   và đối chiếu fingerprint qua console VPS trước khi tin cậy.
3. Đảm bảo user có thể ghi /opt/edushift, chạy docker compose, và đã có
   .env như trên. Workflow sẽ chép compose.prod.yml và deploy.sh vào
   thư mục đó, đăng nhập GHCR bằng token của workflow rồi pull image.
4. Merge dev vào main sau khi secrets, DNS, SSL và SMTP sẵn sàng.

Sau mỗi deploy, script kiểm tra API và web qua loopback. Nếu bản mới
không khỏe và có tag trước đó trong .env, script thử khởi động lại tag
trước. Rollback image không tự khôi phục dữ liệu PostgreSQL.

Các gói đăng ca và dữ liệu thuê bao được tạo bằng migration khi API khởi động.
Trước lần phát hành này, sao lưu PostgreSQL và kiểm tra có thể khôi phục. Khi
rollback, xem log API và kiểm tra `/api/health`, `/api/plans`, đăng nhập và tạo
ca trên môi trường thử trước khi đổi tag. Không xóa bảng mới hoặc chỉnh ngược
schema khi chưa đối chiếu dữ liệu giao dịch. Trên production giữ
`PAYMENTS_MODE=disabled`: mã hiện tại chỉ có adapter sandbox, chưa kết nối cổng
thanh toán thật. Chỉ bật thanh toán thật sau khi tích hợp provider, cấu hình khóa
riêng trong secret, xác thực webhook HTTPS và kiểm thử đối soát.

## 5. Vận hành

~~~bash
cd /opt/edushift
docker compose --env-file .env -f compose.prod.yml ps
docker compose --env-file .env -f compose.prod.yml logs --tail=100 api web
~~~

Thiết lập backup PostgreSQL tự động ra nơi khác VPS và thử khôi phục
định kỳ. Theo dõi dung lượng đĩa vì máy có 30 GB; cấu hình log rotation
và dọn image cũ khi cần.
