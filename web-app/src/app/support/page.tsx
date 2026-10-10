import Link from 'next/link';
export default function Support() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  return <main className="info-page"><Link href="/">← Trang chủ</Link><h1>Hỗ trợ EduShift</h1><p>Nếu bạn không đăng nhập được, hãy dùng chức năng đặt lại mật khẩu. Nếu gặp vấn đề với ca làm hoặc tài khoản, hãy ghi lại mã ca, thời điểm và mô tả ngắn để bộ phận hỗ trợ kiểm tra.</p><p><Link href="/forgot-password">Đặt lại mật khẩu</Link> · <Link href="/pricing">Xem bảng giá</Link></p>{email ? <p>Liên hệ: <a href={'mailto:' + email}>{email}</a></p> : <p>Kênh liên hệ chính thức sẽ được hiển thị tại đây khi được cấu hình.</p>}</main>;
}
