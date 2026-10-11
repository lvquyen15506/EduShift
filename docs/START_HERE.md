# EduShift — bắt đầu từ đâu

Tài liệu này là điểm bắt đầu duy nhất cho người phát triển, người vận hành VPS
và người tiếp nhận một máy chủ đã chạy EduShift. Đọc phần 1 trước, sau đó chọn
luồng local, VPS mới hoặc cập nhật VPS hiện có.

## 1. Mô hình hệ thống

EduShift gồm bốn service Docker Compose:

| Service | Vai trò | Local | Production |
| --- | --- | --- | --- |
| `db` | PostgreSQL, lưu toàn bộ tài khoản, ca, đơn ứng tuyển và cấu hình | cổng 5432 | volume `postgres_data`, không mở Internet |
| `api` | FastAPI, migration schema, xác thực, nghiệp vụ và `/api/*` | `:8000` | chỉ bind localhost, Nginx chuyển tiếp `api.edushift.site` |
| `web` | Next.js landing và ứng dụng web | `:3000` | chỉ bind localhost, Nginx chuyển tiếp domain chính |
| `push-worker` | gửi push đã xếp hàng qua Expo | chạy cùng Compose | chạy cùng Compose |

Mailpit chỉ có trong Compose phát triển để đọc OTP ở `http://localhost:8025`.
Production dùng SMTP thật.

## 2. Seed data có dùng không?

Có, nhưng chỉ dùng cho **local/dev**. `backend/seed.py` được Compose local gọi
trước khi chạy Uvicorn. Script tạo hoặc cập nhật ba tài khoản demo, một doanh
nghiệp đã xác minh, sinh viên Mai Anh, hai ca mẫu và thông báo mẫu. Script có thể
chạy lặp lại; nó không phải migration và không được chạy trên cơ sở dữ liệu thật.

Tài khoản demo local:

| Vai trò | Đăng nhập | Mật khẩu |
| --- | --- | --- |
| Admin | `admin@edushift.vn` | `EduShift123!` |
| Doanh nghiệp | `employer@edushift.vn` | `EduShift123!` |
| Sinh viên | `sv001` | `EduShift123!` |

Không đưa các tài khoản này lên VPS. Production không gọi `seed.py`; API chỉ
chạy migration schema idempotent khi khởi động. Tạo admin production bằng
`python -m app.create_admin`, lệnh hỏi mật khẩu trực tiếp và không sửa tài
khoản đã có. Dữ liệu doanh nghiệp, sinh viên và ca thật vì thế được giữ nguyên.

## 3. Chạy local lần đầu

```bash
git clone <repo-url> edushift
cd edushift
cp deploy/.env.example .env   # chỉ để tham khảo, không dùng nguyên mẫu production
docker compose up -d --build
```

Compose local có sẵn giá trị PostgreSQL và Mailpit. Mở:

- Web: `http://localhost:3000`
- API docs: `http://localhost:8000/docs`
- Mailpit/OTP: `http://localhost:8025`

Kiểm tra service:

```bash
docker compose ps
curl -fsS http://localhost:8000/api/health
docker compose logs --tail=100 api web
```

Nếu sửa `.env` (SMTP, Gemini hoặc payment), recreate service nhận biến mới:

```bash
docker compose up -d --build --force-recreate api web
```

File `.env` không được commit. Không đặt Gemini key vào `NEXT_PUBLIC_*`.

## 4. Biến môi trường quan trọng

### Local

`docker-compose.yml` cung cấp mặc định cho database, JWT, Mailpit và payment
sandbox. Có thể thêm vào `.env`:

```env
GEMINI_API_KEY=key_from_google_ai_studio
GEMINI_MODEL=gemini-3.8-flash
PAYMENTS_MODE=sandbox
PAYMENT_WEBHOOK_SECRET=local-secret
```

Chat sẽ trả `mode: gemini` khi Gemini trả thành công. Nếu key thiếu, model
không còn được Google cung cấp, hết quota hoặc request lỗi, API trả `mode: local`
với dữ liệu công khai đã lập chỉ mục; đây là fallback có chủ đích.

### Production

Tạo `/opt/edushift/.env` từ `deploy/.env.example`, thay toàn bộ giá trị mẫu:

```env
POSTGRES_PASSWORD=<random>
DATABASE_URL=postgresql+psycopg://edushift:<same-password>@db:5432/edushift
JWT_SECRET=<random-long-secret>
IMAGE_TAG=latest
GEMINI_API_KEY=<secret>
GEMINI_MODEL=gemini-3.8-flash
```

SMTP thật là bắt buộc cho OTP. Giữ `PAYMENTS_MODE=disabled` đến khi có provider,
merchant, webhook HTTPS và kiểm thử đối soát.

## 5. VPS mới

1. Cài Docker Engine và Compose plugin; chỉ mở SSH, 80 và 443.
2. Tạo `/opt/edushift`, chép `deploy/compose.prod.yml`, `deploy/deploy.sh` và
   `.env` production vào đó; đặt `.env` là `chmod 600`.
3. Cấu hình DNS `edushift.site` và `api.edushift.site`, reverse proxy Nginx/
   aaPanel lần lượt đến `127.0.0.1:3000` và `127.0.0.1:8000`, rồi bật HTTPS.
4. Khởi động image:

```bash
cd /opt/edushift
docker compose --env-file .env -f compose.prod.yml pull
docker compose --env-file .env -f compose.prod.yml up -d --remove-orphans
```

5. Tạo admin đầu tiên:

```bash
docker compose --env-file .env -f compose.prod.yml exec api \
  python -m app.create_admin admin@edushift.site --username admin
```

6. Kiểm tra `https://api.edushift.site/api/health`, web, đăng nhập, OTP và
   tạo thử một ca sau khi admin xác minh doanh nghiệp.

## 6. Cập nhật VPS đã có dữ liệu — không reset database

Không chạy `docker compose down -v`, không xóa volume `postgres_data`, không
chạy `backend/seed.py` và không tạo database mới. Quy trình an toàn:

```bash
cd /opt/edushift
docker compose --env-file .env -f compose.prod.yml exec -T db \
  pg_dump -U edushift -d edushift -Fc > backup-before-update-$(date +%Y%m%d-%H%M).dump

# cập nhật compose.prod.yml và deploy.sh từ bản phát hành mới
docker compose --env-file .env -f compose.prod.yml config --quiet
docker compose --env-file .env -f compose.prod.yml pull
docker compose --env-file .env -f compose.prod.yml up -d --remove-orphans
```

API tự chạy các câu lệnh `CREATE TABLE IF NOT EXISTS` và `ALTER TABLE ... ADD
COLUMN IF NOT EXISTS`. Đây là migration chuyển tiếp cho các bản hiện có; luôn
backup trước lần cập nhật đầu tiên và xem log sau khi API healthy. Dữ liệu cũ
không bị seed hoặc ghi đè. Nếu triển khai qua GitHub Actions, merge vào `main`
sẽ publish image và script `deploy/deploy.sh` health check rồi rollback image
trước nếu service không khỏe. Rollback image không rollback dữ liệu database.

## 7. Kiểm tra sau triển khai

```bash
docker compose --env-file .env -f compose.prod.yml ps
docker compose --env-file .env -f compose.prod.yml logs --tail=100 api web push-worker
curl -fsS https://api.edushift.site/api/health
curl -I https://edushift.site/
```

Smoke test tối thiểu: trang landing, đăng ký OTP, đăng nhập, admin xác minh
doanh nghiệp, đăng ca, sinh viên tìm ca/ứng tuyển, thông báo, chat, mobile gọi
được API HTTPS. Kiểm tra dung lượng disk, log rotation và backup khôi phục định
kỳ.

## 8. Mobile

Trong `mobile-app/.env` đặt:

```env
EXPO_PUBLIC_API_URL=https://api.edushift.site
```

Điện thoại thật không dùng `localhost`; Android emulator local dùng
`http://10.0.2.2:8000`, iOS simulator dùng `http://localhost:8000`. Sau khi
đổi API URL phải build lại Expo/EAS.

## 9. Các lệnh kiểm thử trước khi phát hành

```bash
cd backend && python -m pytest -q
cd ../web-app && npm run lint && npm run build
cd ../mobile-app && npm run lint && npx tsc --noEmit
```

Nếu test dùng database riêng, không trỏ test vào PostgreSQL production. Đọc
`deploy/README.md`, `docs/API.md` và `plan10-10.md` khi cần chi tiết vận hành,
API hoặc trạng thái phase.
