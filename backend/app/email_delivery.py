"""SMTP delivery for account verification and password reset codes."""

import os
import smtplib
from email.message import EmailMessage


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
<body style="margin:0;padding:0;background:#f8f1f5;font-family:Arial,Helvetica,sans-serif;color:#29202b;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Mã xác nhận EduShift của bạn có hiệu lực trong 10 phút.</div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8f1f5;padding:36px 16px;"><tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:540px;background:#ffffff;border:1px solid #eadce4;border-radius:20px;overflow:hidden;">
      <tr><td style="height:7px;background:#a10d61;"></td></tr>
      <tr><td style="padding:34px 36px 38px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="width:36px;height:36px;border-radius:10px;background:#a10d61;color:#ffffff;text-align:center;font-size:22px;font-weight:800;">E</td>
          <td style="padding-left:10px;font-size:20px;font-weight:800;letter-spacing:-0.5px;color:#29202b;">Edu<span style="color:#a10d61;">Shift</span></td>
        </tr></table>
        <p style="margin:32px 0 9px;color:#a10d61;font-size:11px;font-weight:800;letter-spacing:2px;">BẢO MẬT TÀI KHOẢN</p>
        <h1 style="margin:0 0 12px;color:#29202b;font-size:27px;line-height:1.25;">{title}</h1>
        <p style="margin:0 0 26px;color:#655663;font-size:15px;line-height:1.65;">Dùng mã bên dưới để {action}. Mã chỉ dành cho yêu cầu này.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding:22px 12px;background:#fdf0f6;border:1px solid #f1d3e2;border-radius:14px;">
          <p style="margin:0 0 8px;color:#765064;font-size:11px;font-weight:700;letter-spacing:2px;">MÃ XÁC NHẬN CỦA BẠN</p>
          <span style="color:#901052;font-size:34px;font-weight:800;letter-spacing:8px;font-variant-numeric:tabular-nums;">{code}</span>
        </td></tr></table>
        <p style="margin:22px 0 0;color:#655663;font-size:13px;line-height:1.65;">Mã có hiệu lực trong <strong style="color:#29202b;">10 phút</strong> và chỉ dùng một lần. Không chia sẻ mã này với bất kỳ ai.</p>
        <div style="height:1px;background:#eee2e8;margin:26px 0 19px;"></div>
        <p style="margin:0;color:#8b7b86;font-size:12px;line-height:1.6;">Bạn không yêu cầu thao tác này? Hãy bỏ qua email. Tài khoản của bạn sẽ không thay đổi.</p>
      </td></tr>
    </table>
    <p style="margin:20px 0 0;color:#998995;font-size:12px;">EduShift · edushift.site</p>
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
