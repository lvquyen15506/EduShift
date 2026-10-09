# EduShift — kế hoạch thực hiện

Nguồn: [lộ trình triển khai](docs/Ke_Hoach_Trien_Khai.md). Cập nhật: 2026-10-09.

## Hiện trạng

- Giai đoạn 1 và 2 đã triển khai: xác thực, lịch học từ NoteClass, matching theo lịch và landing page.
- Web doanh nghiệp có dashboard, form đăng ca, danh sách ca và danh sách ứng viên theo từng ca.

## Giai đoạn 2 — lịch học và matching

1. [x] Rà soát schema, API hiện tại và nơi sử dụng Match Score.
2. [x] Thêm API sinh viên xem, thêm, nhập hàng loạt và xóa lịch học/lịch rảnh. Kiểm tra thời gian, loại lịch và quyền sở hữu.
3. [x] Viết hàm matching độc lập: loại ca trùng lịch bận, xác nhận khung giờ rảnh khi sinh viên đã khai báo, tính điểm theo kỹ năng và đánh giá. Không tiết lộ lịch cá nhân cho doanh nghiệp.
4. [x] Tính điểm khi tạo ca, trả danh sách ứng viên phù hợp theo ca; dùng cùng thuật toán cho ứng tuyển và gợi ý ca cho sinh viên.
5. [x] Cập nhật tài liệu API và kiểm thử các ca giao nhau, ranh giới thời gian, phân quyền và điểm khớp.
6. [x] Ánh xạ dữ liệu `date`/`timelearn`/`title`/`desc` từ NoteClass, bổ sung đồng bộ lịch trường và giữ lịch nhập tay. Không lưu mật khẩu cổng trường.
7. [x] Thay trang `/` bằng landing page responsive với lời giới thiệu, lợi ích, quy trình và nút đăng ký/đăng nhập.

## Giai đoạn 3 — web doanh nghiệp

1. [x] Setup Next.js 16, Tailwind CSS 4 và giao diện dashboard, form đăng ca, danh sách ứng viên.
2. [x] Form gửi `POST /api/shifts`, kiểm tra thời gian/lương/số lượng và chuyển sang ứng viên của ca vừa tạo.
3. [x] Danh sách ứng viên chọn ca, gọi API theo `shift_id` và lọc Match Score từ 90%.
4. [x] Dashboard tính Match Score thực tế cho ca đang tuyển, liên kết ca và ứng viên; bỏ thao tác chưa có API.
5. [x] Đọc trực tiếp các frame Figma cho dashboard (`1:2951`) và ứng viên (`1:811`) bằng kết nối tích hợp; đưa web doanh nghiệp về sidebar, vùng nội dung 944px và trang ứng viên có danh sách kèm ô chi tiết.
6. [x] Bổ sung dữ liệu dashboard từ API: số đơn ứng tuyển theo 7 ngày UTC và 5 ca sắp tới của doanh nghiệp, rồi hiển thị hai khối này trên web.
7. [ ] So sánh từng thành phần và hoàn thiện mức khớp pixel với Figma. Các hành động mời ứng viên và dữ liệu khoảng cách trong mẫu thiết kế chưa thuộc luồng API MVP hiện tại.

## Giai đoạn 4 — ứng dụng sinh viên

1. [x] Dùng Expo Router, màn đăng ký và đăng nhập sinh viên; lưu phiên bằng SecureStore.
2. [x] Hiển thị ca gợi ý từ API, Match Score, chi tiết ca và gửi đơn ứng tuyển.
3. [x] Xem, thêm, xóa lịch học/lịch rảnh và đồng bộ lịch trường theo phiên nhập thông tin.
4. [x] Xem thông báo, đánh dấu tất cả đã đọc và đăng xuất.
5. [x] Kiểm tra lint, typecheck, Expo Doctor, bundle Android và luồng API; CI kiểm tra mã nguồn, chưa tự gửi build cloud.
6. [x] Doanh nghiệp duyệt đơn ứng tuyển; ca đã nhận tự xuất hiện trong lịch sinh viên và chặn ca trùng giờ. Có test tích hợp cho quyền, sức chứa, lịch rảnh và tự xếp ca.

## Giai đoạn 5 — build, test và phân phối

1. [x] Cấu hình EAS `preview` tạo APK/IPA nội bộ và `production` cho TestFlight; GitHub Actions kiểm tra mã, build và lưu bản thử vào Artifacts khi đã cấu hình Expo/Apple.
2. [x] Test tích hợp API luồng doanh nghiệp đăng ca → sinh viên nhận thông báo, thấy ca gợi ý và ứng tuyển → doanh nghiệp nhận thông báo ứng viên.
3. [x] Thêm liên kết từ thông báo mobile tới chi tiết ca; dữ liệu thông báo có `shift_id`.
4. [ ] Chạy build cloud, cài APK và thử TestFlight trên thiết bị thật sau khi có Expo project, token, API HTTPS và chứng chỉ Apple.

## Giai đoạn 6 — hồ sơ và nhập lịch trên mobile

1. [x] Thêm màn hồ sơ sinh viên trong app để xem/sửa tên, email, trường, ngành, kỹ năng và ảnh đại diện bằng API hiện có.
2. [x] Cho sinh viên chọn file lịch học, xem trước số mục hợp lệ và nhập vào lịch mà không làm mất ca đã nhận. Ghi rõ định dạng file hỗ trợ.
3. [x] Kiểm thử quyền, dữ liệu file lỗi/trùng, lịch đã nhận, mobile lint/typecheck/Expo Doctor và luồng API. Chỉ chuyển phase khi đạt.

Kết quả phase 6: 11 test API đạt trên PostgreSQL; parser CSV kiểm tra file mẫu, múi giờ, trùng và ngày lỗi; mobile typecheck, lint, Expo Doctor 21/21 và export Android đạt. Thử thao tác native trên máy thật thuộc phase 10.

## Giai đoạn 7 — vận hành tuyển dụng và xác minh

1. [x] Quản trị viên xác minh doanh nghiệp; doanh nghiệp được xác minh mới có thể đăng ca mới.
2. [x] Doanh nghiệp quản lý trạng thái ca, mời sinh viên phù hợp, duyệt/từ chối đơn và sinh viên trả lời lời mời.
3. [x] Kiểm thử phân quyền, giới hạn số người, xung đột lịch, thông báo và UI web/mobile. Sửa đến khi đạt.

Kết quả phase 7: 12 test API đạt trên PostgreSQL; web lint/build, mobile typecheck/lint và export Android đạt. Thử thao tác trực tiếp trên thiết bị thuộc phase 10.

## Giai đoạn 8 — thực hiện ca, đánh giá và vị trí

1. [x] Sinh viên check-in/check-out ca đã nhận; doanh nghiệp xác nhận hoàn thành và xem chấm công.
2. [x] Hai phía đánh giá sau ca; điểm đánh giá sinh viên lấy từ review thật, không dùng điểm giả.
3. [x] Bổ sung tọa độ tự nguyện và khoảng cách theo mức vào Match Score khi có dữ liệu; không trả tọa độ sinh viên cho doanh nghiệp.
4. [x] Kiểm thử trạng thái ca, quyền, review, khoảng cách và hiệu năng hàm matching.

Kết quả phase 8: 14 test API đạt trên PostgreSQL; web lint/build, mobile typecheck/lint, Expo Doctor 21/21 và export Android đạt. 1.000 phép tính matching với dữ liệu mẫu mất 0,0073 giây trên máy phát triển; đây không phải phép đo API dưới tải đồng thời. Thử thiết bị thật và tải đồng thời thuộc phase 9–10.

## Giai đoạn 9 — thông báo push và phát hành

1. [x] Đăng ký Expo push token, gửi push khi có ca phù hợp hoặc thay đổi trạng thái đơn, xử lý lỗi/retry và vẫn lưu thông báo trong app. Đã kiểm thử bằng Expo Push Service giả lập; cần thử máy thật khi có EAS project.
2. [ ] Chạy kiểm thử hồi quy API/web/mobile, kiểm tra responsive và đo hiệu năng theo yêu cầu tài liệu.
3. [ ] Build APK/IPA bằng EAS, thử APK và TestFlight trên thiết bị thật; hoàn thiện hướng dẫn vận hành và CI/CD. Phụ thuộc Expo project/token, chứng chỉ Apple, API HTTPS và thiết bị.

Kết quả cục bộ phase 9: 15 test API đạt trên PostgreSQL; web lint/build, mobile typecheck/lint, Expo Doctor 21/21 và export Android đạt. Test worker bao gồm gửi thành công, retry và nội dung push không chứa chi tiết riêng tư. Chưa có bằng chứng EAS cloud build, TestFlight, push trên máy thật hoặc tải 1.000 người dùng đồng thời; phase 9 chưa thể đánh dấu hoàn thành.

## Giai đoạn 10 — nghiệm thu toàn hệ thống

1. [ ] Chạy lại toàn bộ test API, web, mobile và luồng đầu cuối trên môi trường phát hành.
2. [ ] Kiểm tra responsive, quyền riêng tư, accessibility, các trạng thái lỗi và mức khớp thiết kế Figma; sửa lỗi và chạy lại cho đến khi đạt.
3. [ ] Đối chiếu từng yêu cầu trong tài liệu với bản chạy thật, cập nhật tài liệu và checklist bàn giao để người dùng review toàn bộ.

Mỗi phase chỉ đánh dấu hoàn thành khi test liên quan đạt. Lỗi phát hiện trong phase phải sửa và chạy lại trước khi chuyển phase tiếp theo.

## Quy ước MVP

- API nhận thời gian ISO 8601; backend lưu UTC dạng `timestamp` không timezone như schema hiện tại.
- Lịch `STUDY` và `BUSY` chặn ca làm nếu giao nhau. Lịch `FREE` là khung giờ sẵn sàng; nếu đã khai báo lịch `FREE`, ca phải nằm trọn trong một hoặc nhiều khung giờ rảnh liên tiếp.
- Match Score từ 0 đến 100: lịch rảnh 60, kỹ năng 25, đánh giá thật 15; chưa có review thì không cộng điểm đánh giá. Khi có tọa độ tự nguyện của cả sinh viên và ca, điểm cơ bản chiếm 90% và khoảng cách theo mức cộng tối đa 10 điểm. Ca xung đột lịch hoặc ngoài khung giờ rảnh nhận 0 điểm.
- Tọa độ sinh viên chỉ thuộc hồ sơ cá nhân; API ứng viên chỉ trả mức khoảng cách gần đúng trong lý do khớp, không trả tọa độ.

## Kiểm chứng

- `PYTHONPATH=backend pytest -q backend/tests/test_matching.py`: 4 bài kiểm thử đạt.
- API đang chạy trên Docker: `GET /api/schedules` trả 200 cho sinh viên và 403 cho doanh nghiệp; thêm/xóa lịch trả 201/204; `GET /api/candidates` trả 200.
- Tài khoản cổng lịch mẫu trả dữ liệu hợp lệ; bộ đọc lịch chuyển được 43 mục, không ghi thông tin đăng nhập vào mã hoặc cơ sở dữ liệu.
- `docker compose exec -T web npm run build`: build Next.js thành công.
- Phase 3: `npm run build`, `npm run lint`, `PYTHONPATH=backend pytest -q backend/tests` đều đạt (6 test backend).
- Thử API bằng tài khoản tạm: tạo ca HTTP 201, lấy ứng viên theo ca và dashboard cùng trả Match Score 100 cho sinh viên thử; sau đó đã xóa dữ liệu thử.
- Landing, trang đăng ca và trang ứng viên trả HTTP 200.
- Chụp dashboard và trang ứng viên bằng Chrome headless sau khi đăng nhập tài khoản demo; không có tràn ngang ở 1280px.
- Phase 4: `npm ci`, `npm run typecheck`, `npm run lint`, `npx expo-doctor` (21/21), `npx expo export --platform android --output-dir dist` và `PYTHONPATH=backend pytest -q backend/tests` (6 test) đều đạt.
- Thử API bằng ba tài khoản tạm: lịch thêm/xem/xóa, phân quyền, chi tiết ca, gợi ý, thông báo, ứng tuyển và chặn đơn trùng đều đạt; đã xóa tài khoản cùng dữ liệu liên quan.
- Bổ sung trang lịch sinh viên trên web tại `/student/schedule`: xem theo tuần, danh sách, thêm/xóa và đồng bộ lịch trường. Web lint/build đạt; Chrome headless đã mở trang bằng phiên sinh viên.
- Luồng nhận ca: `docker compose exec -T api python -m pytest -q tests` đạt 7 bài; web build/lint và mobile typecheck/lint đạt. Tài khoản demo `sv001` có ca đã nhận ngày 11/10/2026, 14:00–17:00 (giờ Việt Nam), nằm trong khung rảnh 13:00–18:00 để xem UI.
- Đồng bộ trường: sửa header hai request tới cổng lịch theo NoteClass. Thử endpoint đang chạy với tài khoản mẫu trả HTTP 200, lưu 43 mục `SCHOOL` và giữ nguyên lịch `MANUAL`/`SHIFT`.
