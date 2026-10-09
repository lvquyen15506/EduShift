# EduShift API

Base URL: `http://localhost:8000` · OpenAPI: `/docs` · ReDoc: `/redoc`.

## Authentication

`POST /api/auth/register` tạo tài khoản `STUDENT` hoặc `EMPLOYER`. `POST /api/auth/login` nhận `identifier` và password, trả `access_token`. Gửi token bằng `Authorization: Bearer <token>`.

Tài khoản seed: `employer@edushift.vn / EduShift123!`, `sv001 / EduShift123!`.

## Endpoints

| Method | Path | Auth | Mục đích |
|---|---|---|---|
| GET | `/api/health` | Không | Kiểm tra API |
| POST | `/api/auth/register` | Không | Đăng ký |
| POST | `/api/auth/login` | Không | Đăng nhập |
| GET | `/api/auth/me` | Có | Hồ sơ hiện tại |
| GET | `/api/dashboard` | Employer | KPI, ca gần đây, ứng viên phù hợp, số đơn 7 ngày và 5 ca sắp tới |
| GET | `/api/student/dashboard` | Student | KPI và ca được gợi ý kèm Match Score |
| GET | `/api/schedules` | Student | Danh sách lịch của mình |
| POST | `/api/schedules` | Student | Thêm một khoảng `STUDY`, `BUSY` hoặc `FREE` |
| POST | `/api/schedules/import` | Student | Nhập hàng loạt lịch; `replace=true` thay lịch cũ |
| POST | `/api/schedules/sync-school` | Student | Đồng bộ lịch học từ cổng lịch dùng trong NoteClass |
| DELETE | `/api/schedules/{id}` | Student | Xóa một mục lịch của mình |
| GET | `/api/shifts` | Có | Danh sách ca; `?status=OPEN` |
| POST | `/api/shifts` | Employer | Tạo ca |
| GET | `/api/shifts/{id}` | Có | Chi tiết ca; sinh viên nhận thêm Match Score và trạng thái chấm công nếu đã nhận ca |
| GET | `/api/candidates` | Employer | Ứng viên phù hợp với `?shift_id=<UUID>`; mặc định ca mở mới nhất của mình |
| POST | `/api/applications` | Student | Ứng tuyển `{shift_id}` |
| GET | `/api/shifts/{id}/applications` | Employer | Danh sách đơn ứng tuyển của ca do mình đăng |
| PATCH | `/api/applications/{id}/accept` | Employer | Chấp nhận đơn đang chờ và tự xếp ca vào lịch sinh viên |
| GET | `/api/student/applications` | Student | Danh sách đơn ứng tuyển của mình |
| PUT | `/api/student/location` | Student | Lưu/xóa tọa độ tự nguyện bằng `{latitude, longitude}`; cả hai là `null` để xóa |
| PATCH | `/api/applications/{id}/check-in` | Student | Check-in ca đã nhận từ 30 phút trước đến giờ kết thúc |
| PATCH | `/api/applications/{id}/check-out` | Student | Check-out sau giờ kết thúc khi đã check-in |
| PATCH | `/api/applications/{id}/complete` | Employer | Xác nhận chấm công sau check-out |
| POST | `/api/applications/{id}/reviews` | Student/Employer | Đánh giá sau khi hoàn thành: `{rating: 1..5, comment?: string}` |
| GET | `/api/notifications` | Có | Notification của user, có `shift_id` khi liên quan đến ca để mở chi tiết |
| PATCH | `/api/notifications/read-all` | Có | Đánh dấu đã đọc |
| POST | `/api/push-tokens` | Student | Đăng ký Expo push token của thiết bị: `{token, platform}` |
| DELETE | `/api/push-tokens` | Student | Hủy token của chính thiết bị với cùng body |

Thông báo luôn được lưu trong database để xem tại `/api/notifications`. Worker `python -m app.push_worker` gửi push chung chung qua Expo Push Service cho token sinh viên đăng ký trong 30 ngày gần nhất; không đưa tên ca hoặc nội dung riêng tư lên màn hình khóa. Worker thử lại tối đa 5 lần với thời gian chờ tăng dần khi Expo trả lỗi tạm thời, và xóa token khi Expo báo `DeviceNotRegistered`. Token chỉ dùng cho một tài khoản tại một thời điểm. Cần EAS project ID và bản build native trên thiết bị thật để kiểm tra push đầu cuối.

## Xác minh và vận hành tuyển dụng

Quản trị viên dùng PATCH /api/admin/employers/{id}/verify với is_verified để xác minh hoặc thu hồi xác minh doanh nghiệp. Doanh nghiệp mới đăng ký cần được xác minh trước khi đăng ca.

Chủ ca dùng PATCH /api/shifts/{id}/status với status OPEN hoặc CLOSED để mở hay đóng tuyển. Ca tự chuyển FULL khi đã nhận đủ người và không thể mở lại khi hết chỗ.

Chủ ca dùng POST /api/shifts/{id}/invitations với student_id để mời sinh viên phù hợp. Sinh viên trả lời qua PATCH /api/applications/{id}/respond với accept true hoặc false; khi nhận lời, ca được xếp vào lịch. Doanh nghiệp có thể dùng PATCH /api/applications/{id}/reject để từ chối đơn đang chờ.

## Chấm công và đánh giá

Sinh viên đã nhận ca có thể check-in trong khoảng từ 30 phút trước giờ bắt đầu đến giờ kết thúc. Check-out chỉ được phép sau giờ kết thúc. Doanh nghiệp xem mốc chấm công trong danh sách đơn và xác nhận hoàn thành sau check-out. Mỗi phía chỉ đánh giá một lần, từ 1 đến 5 sao, sau khi đơn thành `COMPLETED`. Trung bình sao của sinh viên và doanh nghiệp được tính từ review đã lưu.


## Lỗi

`400` dữ liệu sai, `401` thiếu/sai token, `403` sai role, `404` không tìm thấy, `409` trùng hoặc xung đột lịch, `422` lỗi validation. Body có dạng `{ "detail": "..." }`.

## Lịch và Match Score

```json
POST /api/schedules/import
{
  "replace": true,
  "items": [
    {"title": "Toán", "type": "STUDY", "start_time": "2026-10-12T08:00:00+07:00", "end_time": "2026-10-12T10:00:00+07:00"},
    {"title": "Rảnh buổi chiều", "type": "FREE", "start_time": "2026-10-12T13:00:00+07:00", "end_time": "2026-10-12T17:00:00+07:00"}
  ]
}
```

Thời gian có múi giờ được đổi sang UTC trước khi lưu. `STUDY` và `BUSY` chặn ca giao nhau; nếu có lịch `FREE`, ca phải nằm trọn trong thời gian rảnh. Điểm cơ bản gồm lịch 60, kỹ năng 25, đánh giá 15; xung đột thời gian được 0. Điểm đánh giá chỉ lấy từ review thật; sinh viên chưa có review không được gán sẵn 5 sao. Khi cả hai phía tự nhập tọa độ, điểm cơ bản chiếm 90% và khoảng cách theo bốn mức chiếm tối đa 10 điểm. API ứng viên không trả lịch hay tọa độ cá nhân.

`POST /api/shifts` trả thêm `matched_students` và tạo thông báo cho sinh viên có điểm từ 80. Điểm ở `/api/applications` được tính lại khi ứng tuyển để phản ánh lịch mới nhất.

`GET /api/dashboard` trả `activity_7_days: [{date, applications}]` cho 7 ngày UTC liên tiếp và `upcoming_schedule` gồm tối đa 5 ca chưa bắt đầu, không tính bản nháp. Mọi dữ liệu đều giới hạn theo doanh nghiệp đăng nhập. Thời gian của ca trong API có múi giờ UTC để trình duyệt hiển thị đúng giờ địa phương.

`GET /api/shifts/{id}` yêu cầu đăng nhập. Sinh viên chỉ xem được ca mở hoặc ca mình đã ứng tuyển. Với sinh viên, `available` cho biết lịch có cho phép ứng tuyển hay không, còn `applied` dùng để vô hiệu hóa nút ứng tuyển lại. Backend vẫn kiểm tra trạng thái ca, giờ bắt đầu, lịch và đơn trùng tại `POST /api/applications`. Thời gian lịch và thông báo cũng trả kèm múi giờ UTC.

Khi doanh nghiệp chấp nhận đơn đang `PENDING`, API kiểm tra quyền sở hữu ca, số chỗ còn lại và lịch mới nhất của sinh viên. Đơn chuyển sang `ACCEPTED`; `GET /api/schedules` tự có thêm mục `type: "WORK"`, `source: "SHIFT"`, `application_id` và `shift_id` tương ứng ca đã nhận. Mục này chặn các ca trùng giờ khi matching. Khung `FREE` gốc được giữ để thấy ca được xếp trong giờ rảnh; mục `WORK` không thể xóa thủ công và không bị xóa khi nhập lịch với `replace=true` hoặc đồng bộ trường. Sinh viên nhận thông báo ca đã được duyệt.

Đồng bộ cổng trường: `POST /api/schedules/sync-school` với body `{"username":"<mã sinh viên>","password":"<mật khẩu cổng trường>"}`. API đọc cấu trúc `date`/`timelearn`/`title`/`desc` của NoteClass, đổi giờ Việt Nam sang UTC, và thay riêng các mục có `source: "SCHOOL"`. Lịch nhập tay (`source: "MANUAL"`) được giữ lại. Thông tin đăng nhập cổng trường chỉ dùng trong lần gọi này, không lưu vào database; triển khai công khai cần HTTPS.
