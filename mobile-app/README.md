# EduShift mobile

Ứng dụng sinh viên dùng Expo SDK 57 và Expo Router. Từ thư mục này:

```bash
npm ci
npx expo start
```

Chạy API bằng `docker compose up -d` tại thư mục gốc. Android Emulator dùng mặc định `http://10.0.2.2:8000`; iOS Simulator dùng `http://localhost:8000`. Với điện thoại thật, đặt `EXPO_PUBLIC_API_URL` thành địa chỉ LAN hoặc HTTPS của API trước khi chạy Expo, ví dụ:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.10:8000 npx expo start
```

Máy thật và máy chạy API phải cùng mạng khi dùng địa chỉ LAN. Thông tin đăng nhập cổng trường chỉ được gửi khi người dùng chọn đồng bộ, không lưu trong ứng dụng. Khi triển khai công khai, dùng HTTPS cho API.

Kiểm tra trước khi gửi thay đổi:

```bash
npm run typecheck
npm run lint
npx expo-doctor
npx expo export --platform android --output-dir dist
```

## Build thử trên máy thật (phase 5)

App dùng `eas.json` profile `preview`: Android tạo APK, iOS tạo IPA ký kiểu ad hoc để cài trên các thiết bị đã đăng ký. Trước lần chạy CI đầu tiên:

1. Đăng nhập Expo và chạy `npx eas-cli@latest init` trong `mobile-app` để tạo project EAS. Lưu project ID vào GitHub Actions variable `EXPO_PROJECT_ID` và Expo access token vào GitHub Actions secret `EXPO_TOKEN`.
2. Trong EAS environment `preview`, tạo biến `EXPO_PUBLIC_API_URL` trỏ tới API HTTPS có thể truy cập từ điện thoại. Địa chỉ `localhost` hoặc `10.0.2.2` chỉ dùng cho simulator/emulator. Tạo biến tương tự ở environment `production` trước khi gửi TestFlight.
3. Chạy lần đầu `npx eas-cli@latest build --platform android --profile preview` và `npx eas-cli@latest build --platform ios --profile preview` trên máy đã đăng nhập để tạo Android keystore và chứng chỉ/provisioning iOS. iOS cần Apple Developer account; đăng ký UDID của thiết bị thử bằng `npx eas-cli@latest device:create` trước khi build lại.
4. Mở GitHub Actions → **Check and Build Mobile App** → **Run workflow** → chọn `preview`. Sau khi hai job hoàn thành, tải `edushift-android-*` (APK) và `edushift-ios-*` (IPA) trong mục Artifacts của workflow run. Đặt variable `EXPO_BUILD_READY=true` khi muốn tự build bản preview mỗi lần push lên `main`.

Để thử iOS bằng TestFlight, cấu hình Apple signing và App Store Connect API key trong EAS, tạo build `production` đầu tiên bằng lệnh tương tác, rồi chạy workflow với lựa chọn `testflight`. Lựa chọn này build iOS profile `production` và gửi lên TestFlight; bản IPA `preview` chỉ dùng cho phân phối ad hoc, không gửi được lên TestFlight.

Luồng kiểm tra trên máy thật: doanh nghiệp đăng ca trên web với giờ nằm trong lịch rảnh của sinh viên → sinh viên mở tab **Thông báo** và chạm **Xem ca làm** → xem điểm phù hợp và ứng tuyển → doanh nghiệp thấy thông báo ứng viên mới và đơn trong trang ứng viên. Test API tự động của luồng này nằm ở `backend/tests/test_phase5_flow.py`.
