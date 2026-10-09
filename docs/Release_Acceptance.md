# EduShift — checklist nghiệm thu phát hành

Cập nhật: 2026-10-09. Nhánh triển khai: `dev`. Chỉ merge vào `main` sau khi các mục bắt buộc bên dưới đạt trên môi trường phát hành.

| Yêu cầu | Bằng chứng hiện có | Còn cần xác nhận |
| --- | --- | --- |
| Đăng nhập, hồ sơ và phân quyền sinh viên/doanh nghiệp/quản trị | Test API trong `backend/tests`; web và mobile đã nối API | Thử lại các vai trò trên bản phát hành |
| Đồng bộ/nhập lịch, lịch rảnh và cảnh báo trùng ca | Test API lịch và nhận ca; file CSV mẫu trong `docs/sample-schedule.csv` | Thử file thật và đồng bộ cổng trường trên thiết bị |
| Matching theo lịch, kỹ năng, đánh giá và khoảng cách tự nguyện | Test matching và kiểm thử hiệu năng hàm thuần trong phase 8 | Đo thời gian API dưới tải đồng thời |
| Doanh nghiệp đăng ca, quản lý đơn, mời và duyệt ứng viên | Test API phase 5 và 7; CI web build đạt | Thử luồng web → app trên môi trường phát hành |
| Chấm công và đánh giá hai phía | Test API phase 8 | Thử check-in/out và đánh giá trên thiết bị thật |
| Thông báo trong app và Expo push | Test API/worker phase 9, gồm retry | Xác nhận push tới Android và iOS thật khi app ở foreground/background |
| Responsive, accessibility và mức khớp Figma | Web lint/build đạt; các trang dashboard đã từng kiểm tra ở 1280px | Kiểm tra lại màn 390px/768px/1280px, bàn phím, nhãn điều khiển và từng trang theo Figma |
| APK, IPA và TestFlight | CI mobile kiểm tra typecheck, lint, Expo Doctor và export Android; workflow EAS đã cấu hình | Tạo EAS project, credentials, build cloud, cài APK/IPA và gửi TestFlight |
| Hiệu năng 1.000 người dùng đồng thời và matching dưới 2 giây | Chỉ có phép đo hàm matching 1.000 lần, không đại diện cho tải API | Chạy load test trên môi trường có tài nguyên xác định; lưu p95, lỗi và cấu hình máy |
| CD lên VPS | Merge `main` sẽ publish image API/web lên GHCR | Cần VPS, domain và HTTPS để triển khai image và push worker |

## Cổng kiểm tra trước khi merge `main`

1. `dev` có CI API và web xanh; workflow mobile xanh ở commit chứa thay đổi mobile mới nhất.
2. Chạy lại toàn bộ test API, web lint/build, mobile typecheck/lint/Expo Doctor trên commit phát hành.
3. Thử luồng doanh nghiệp đăng ca → sinh viên nhận thông báo → ứng tuyển/nhận ca → lịch tự cập nhật → chấm công → hai phía đánh giá trên bản cài thật.
4. Rà quyền truy cập: doanh nghiệp không đọc được thời khóa biểu hoặc tọa độ chính xác của sinh viên; sinh viên không sửa được ca và đơn của người khác.
5. Kiểm tra giao diện ở 390px, 768px và 1280px; so sánh với Figma, ghi sai khác cần sửa trước khi nghiệm thu.
6. Đo API matching và tải 1.000 người dùng đồng thời trên môi trường phát hành, ghi điều kiện đo và kết quả.
7. Xác nhận build APK, IPA và TestFlight cài/mở được trên thiết bị thật; xác nhận push foreground/background.
8. Sau khi tất cả đạt, mở PR `dev` → `main`; merge sẽ publish image GHCR. Triển khai lên VPS khi đã có máy chủ và HTTPS.

## Điều kiện cần từ chủ dự án

- Expo account/project và quyền cấu hình `EXPO_PROJECT_ID`, `EXPO_TOKEN` trong GitHub Actions; không gửi token trong chat.
- Apple Developer account, signing và App Store Connect để phát hành iOS/TestFlight; ít nhất một thiết bị Android và một iPhone để thử.
- VPS và domain cho web/API, hoặc môi trường HTTPS tương đương để mobile kết nối và kiểm tra push.
- Quyền xem file Figma chuẩn để chốt sai khác giao diện nếu yêu cầu khớp 100% còn áp dụng.
