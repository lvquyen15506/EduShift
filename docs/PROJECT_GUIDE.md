# Sổ tay kỹ thuật EduShift

## 1. Cấu trúc repository

| Thư mục | Nội dung |
| --- | --- |
| `backend/` | FastAPI, models, migration chuyển tiếp, seed local, worker push và tests |
| `web-app/` | Next.js App Router, landing, dashboard, admin, chat và bản đồ |
| `mobile-app/` | Expo/React Native cho sinh viên |
| `deploy/` | Compose production, env mẫu, script deploy và hướng dẫn VPS |
| `docs/` | API, kế hoạch, acceptance và tài liệu vận hành |
| `.github/workflows/` | CI, publish GHCR và build mobile |

## 2. Khởi động

### Local

```bash
docker compose up -d --build
docker compose ps
curl -fsS http://localhost:8000/api/health
```

Compose local gọi `python -m seed` trước Uvicorn. `seed.py` chỉ dành cho dữ
liệu demo local. API gọi `migrate_schema()` khi import module; các câu lệnh có
`IF NOT EXISTS` để tiếp nhận database từ bản cũ.

### Production

Production dùng image GHCR trong `deploy/compose.prod.yml`, không mount source
và không gọi seed. Tạo admin bằng `python -m app.create_admin`. Chi tiết backup,
DNS, Nginx, SMTP và cập nhật VPS nằm trong [START_HERE.md](START_HERE.md).

## 3. Luồng dữ liệu chính

1. Đăng ký tạo `users` và profile sau khi OTP hợp lệ.
2. Admin xác minh employer.
3. Employer tạo `shifts`; quota được khóa và trừ trong transaction.
4. Student tạo `applications`; matching so lịch học và kỹ năng.
5. Employer accept tạo schedule nguồn `SHIFT` và notification cho hai bên.
6. Check-in/out và hoàn tất cập nhật application; review cập nhật điểm trung bình.
7. Cancellation/leave lưu lý do, người yêu cầu và trạng thái duyệt.
8. Worker xử lý email/push theo retry và policy admin.

## 4. API

API docs tự sinh tại `/docs` và `/redoc`. Nhóm endpoint gồm auth, profile,
schedule, public shifts, applications, notifications, plans/payments, admin và
chat. `POST /api/chat` nhận `message` cùng `history`, trả `answer`, `mode`,
`authenticated` và `sources`. Chi tiết payload nằm ở [API.md](API.md).

Không đưa API key Gemini vào frontend. Backend gọi Gemini bằng key server-side;
RAG chỉ đưa nội dung sản phẩm và ca public từ doanh nghiệp đã xác minh vào context.

## 5. Chat và RAG

Nguồn kiến thức tĩnh nằm trong `CHAT_KNOWLEDGE` ở `backend/app/main.py`.
`_chat_sources()` chấm điểm token, lấy tối đa tám tài liệu/ca phù hợp, sau đó
`_gemini_chat()` gửi context cùng lịch sử hội thoại. Khi Gemini thất bại,
`_local_chat_answer()` trả fallback và API đặt `mode=local`.

Khi bổ sung nội dung, viết thông tin có thể kiểm chứng, thêm từ khóa tiếng Việt,
kiểm tra bằng `curl /api/chat`, không đưa mật khẩu/OTP/dữ liệu riêng tư vào context.
Model phải còn xuất hiện trong danh sách model của key; model trả 404 thì sửa
`GEMINI_MODEL` trong `.env` và recreate API.

## 6. Database và migration

Models nằm ở `backend/app/models.py`. PostgreSQL production được tạo bằng
SQLAlchemy và migration chuyển tiếp ở đầu `main.py`; insert mặc định dùng
`ON CONFLICT DO NOTHING`.

Backup trước migration production:

```bash
docker compose --env-file .env -f compose.prod.yml exec -T db \
  pg_dump -U edushift -d edushift -Fc > backup-$(date +%Y%m%d-%H%M).dump
```

Không chạy seed production, không xóa volume và không sửa dữ liệu giao dịch thủ
công. Rollback image không rollback schema; cần kế hoạch migration ngược riêng.

## 7. Kiểm thử

```bash
cd backend && python -m pytest -q && python -m py_compile app/main.py
cd ../web-app && npm run lint && npm run build
cd ../mobile-app && npm run lint && npx tsc --noEmit
```

Test backend dùng database riêng trong fixture, không trỏ vào production. Khi
sửa quota, quyền, notification, migration hoặc payment phải chạy nhóm test liên
quan và toàn bộ backend trước khi merge.

## 8. Quy trình phát hành

1. Làm việc trên `dev`, cập nhật docs cùng thay đổi API/UI.
2. Chạy test backend, lint/build web và typecheck mobile.
3. Kiểm tra `git diff --check` và secret không nằm trong diff.
4. Push `dev`, mở PR vào `main`.
5. CI publish image GHCR theo `latest` và `sha-<commit>`.
6. Deploy VPS bằng tag SHA; health check API và web phải đạt.
7. Smoke test đăng nhập, OTP, admin, ca, ứng tuyển, chat, thông báo và mobile.

## 9. Xử lý lỗi nhanh

### API không lên

```bash
docker compose logs --tail=200 api
docker compose ps
curl -fsS http://127.0.0.1:8000/api/health
```

Kiểm tra database healthy, `DATABASE_URL`, `JWT_SECRET`, SMTP và port bị chiếm.

### Chat luôn local

Kiểm tra `GEMINI_API_KEY` có trong container, model có trong danh sách model,
recreate API và gửi request mới. `mode=local` là fallback; không phải lỗi giao
diện. Không log giá trị key.

### OTP không đến

Local đọc Mailpit. Production kiểm tra SMTP host/port, STARTTLS/SSL, SPF/DKIM,
log API và giới hạn gửi của nhà cung cấp.

### Web không gọi được API

Kiểm tra `API_PROXY_TARGET`, CORS, reverse proxy và HTTPS. Mobile phải dùng
`EXPO_PUBLIC_API_URL` trỏ tới API public, không dùng localhost.

### Deploy lỗi health check

Xem `docker compose ps`, log API/web, disk/RAM và tag trước. Script deploy có thể
khôi phục image trước nếu có `IMAGE_TAG` cũ; sau đó sửa lỗi rồi deploy lại.

## 10. Bảo mật vận hành

- `.env`, JWT secret, SMTP password, Gemini key và payment secret không commit.
- Chỉ mở 80/443/SSH; không mở 3000, 8000, 5432.
- Dùng admin password dài, riêng biệt; bật HTTPS cho web và API.
- Backup ra nơi khác VPS và thử restore định kỳ.
- Không dùng tài khoản seed ở production.
- Không đưa OTP hoặc mật khẩu vào log/chat/context.
- Chỉ bật payment production sau khi provider, webhook signature và đối soát
  đã được kiểm thử.
