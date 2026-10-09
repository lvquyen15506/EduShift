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

    subject = 'Xác nhận đăng ký EduShift' if purpose == 'REGISTER' else 'Đặt lại mật khẩu EduShift'
    action = 'xác nhận đăng ký' if purpose == 'REGISTER' else 'đặt lại mật khẩu'
    message = EmailMessage()
    message['From'] = os.getenv('SMTP_FROM', 'no-reply@edushift.local')
    message['To'] = recipient
    message['Subject'] = subject
    message.set_content(f"""Mã OTP để {action} của bạn là: {code}

Mã có hiệu lực trong 10 phút và chỉ dùng một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này.""")

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
