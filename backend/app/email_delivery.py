"""SMTP delivery for account verification and password reset codes."""

import os
import smtplib
from email.message import EmailMessage
from html import escape


class EmailDeliveryError(RuntimeError):
    pass


def send_otp_email(recipient: str, code: str, purpose: str) -> None:
    host = os.getenv('SMTP_HOST')
    if not host:
        raise EmailDeliveryError('SMTP chưa được cấu hình')

    registering = purpose == 'REGISTER'
    subject = 'Xác nhận đăng ký EduShift' if registering else 'Đặt lại mật khẩu EduShift'
    title = 'Xác nhận email của bạn' if registering else 'Đặt lại mật khẩu'
    action = 'hoàn tất đăng ký' if registering else 'đặt lại mật khẩu'
    safe_code = escape(code)
    code_cells = ''.join(
        f'<td style="padding:0 3px;"><span style="display:block;width:36px;height:50px;line-height:50px;'
        f'border:1px solid #ebc9da;border-radius:8px;background:#fff;color:#7f174d;'
        f'text-align:center;font-size:25px;font-weight:700;">{digit}</span></td>'
        for digit in safe_code
    )
    message = EmailMessage()
    message['From'] = os.getenv('SMTP_FROM', 'no-reply@edushift.local')
    message['To'] = recipient
    message['Subject'] = subject
    message.set_content(f"""EDUSHIFT · {title}

Xin chào,

Dùng mã sau để {action} trên EduShift:

{code}

Mã có hiệu lực trong 10 phút và chỉ dùng một lần. Không chia sẻ mã này với bất kỳ ai.
Nếu bạn không yêu cầu, hãy bỏ qua email này.

EduShift · edushift.site""")
    message.add_alternative(f"""<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f3f6;font-family:Arial,Helvetica,sans-serif;color:#30232d;">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">Mã EduShift của bạn là {safe_code}. Mã có hiệu lực trong 10 phút.</span>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f7f3f6;"><tr><td align="center" style="padding:32px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:580px;border:1px solid #eadce4;border-radius:18px;background:#fff;overflow:hidden;">
      <tr><td style="padding:26px 32px;background:#4b1234;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="width:38px;height:38px;border-radius:10px;background:#ed579d;color:#fff;text-align:center;font-size:24px;font-weight:800;">E</td>
          <td style="padding-left:11px;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Edu<span style="color:#ff9ecb;">Shift</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:36px 32px 10px;">
        <p style="margin:0 0 10px;color:#a10d61;font-size:12px;font-weight:800;letter-spacing:1.6px;">BẢO MẬT TÀI KHOẢN</p>
        <h1 style="margin:0 0 16px;color:#30232d;font-size:28px;line-height:1.3;">{escape(title)}</h1>
        <p style="margin:0;color:#5f5360;font-size:16px;line-height:1.7;">Xin chào,</p>
        <p style="margin:12px 0 0;color:#5f5360;font-size:16px;line-height:1.7;">Bạn vừa yêu cầu {escape(action)} trên EduShift. Hãy quay lại màn hình đang mở và nhập mã xác nhận dưới đây.</p>
      </td></tr>
      <tr><td style="padding:24px 32px 10px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #efd0df;border-radius:14px;background:#fff3f8;"><tr><td align="center" style="padding:25px 8px;">
          <p style="margin:0 0 17px;color:#8f3262;font-size:12px;font-weight:800;letter-spacing:1.5px;">MÃ XÁC NHẬN CỦA BẠN</p>
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>{code_cells}</tr></table>
          <p style="margin:17px 0 0;color:#715e6b;font-size:13px;">Hiệu lực trong <strong style="color:#7f174d;">10 phút</strong> · Chỉ dùng một lần</p>
        </td></tr></table>
      </td></tr>
      <tr><td style="padding:16px 32px 34px;">
        <p style="margin:0;color:#5f5360;font-size:14px;line-height:1.7;">Vì lý do bảo mật, đừng chia sẻ mã này với bất kỳ ai, kể cả người tự xưng là nhân viên EduShift.</p>
      </td></tr>
      <tr><td style="padding:22px 32px;border-top:1px solid #f0e5eb;background:#fcf9fb;">
        <p style="margin:0 0 8px;color:#5f5360;font-size:13px;line-height:1.6;">Bạn không thực hiện yêu cầu này? Hãy bỏ qua email; tài khoản của bạn sẽ không thay đổi.</p>
        <p style="margin:0;color:#9a8491;font-size:12px;">EduShift · Kết nối việc làm với lịch học của bạn</p>
      </td></tr>
    </table>
    <p style="margin:18px 0 0;color:#a18e9a;font-size:12px;">© EduShift · edushift.site</p>
  </td></tr></table>
</body></html>""", subtype='html')

    port = int(os.getenv('SMTP_PORT', '25'))
    use_ssl = os.getenv('SMTP_SSL', 'false').lower() == 'true'
    use_starttls = os.getenv('SMTP_STARTTLS', 'false').lower() == 'true'
    username = os.getenv('SMTP_USERNAME')
    password = os.getenv('SMTP_PASSWORD')
    try:
        client_type = smtplib.SMTP_SSL if use_ssl else smtplib.SMTP
        with client_type(host, port, timeout=10) as smtp:
            if use_starttls:
                smtp.starttls()
            if username:
                smtp.login(username, password or '')
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise EmailDeliveryError('Không gửi được email OTP') from exc
