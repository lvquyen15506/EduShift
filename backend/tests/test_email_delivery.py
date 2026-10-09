"""Both email clients and plain-text readers can use EduShift OTP mail."""

from app.email_delivery import send_otp_email


def test_otp_email_has_branded_html_and_plain_text(monkeypatch):
    delivered = []

    class SMTPStub:
        def __init__(self, host, port, timeout):
            assert (host, port, timeout) == ('smtp.example.com', 587, 10)

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def starttls(self):
            pass

        def login(self, username, password):
            assert (username, password) == ('resend', 'example-key')

        def send_message(self, message):
            delivered.append(message)

    monkeypatch.setenv('SMTP_HOST', 'smtp.example.com')
    monkeypatch.setenv('SMTP_PORT', '587')
    monkeypatch.setenv('SMTP_USERNAME', 'resend')
    monkeypatch.setenv('SMTP_PASSWORD', 'example-key')
    monkeypatch.setenv('SMTP_STARTTLS', 'true')
    monkeypatch.setattr('app.email_delivery.smtplib.SMTP', SMTPStub)

    send_otp_email('student@example.com', '012345', 'REGISTER')
    send_otp_email('student@example.com', '654321', 'RESET')

    assert len(delivered) == 2
    for message, code in zip(delivered, ('012345', '654321')):
        assert message['To'] == 'student@example.com'
        assert message.is_multipart()
        plain = message.get_body(preferencelist=('plain',)).get_content()
        html = message.get_body(preferencelist=('html',)).get_content()
        assert code in plain and code in html
        assert '10 phút' in plain and '10 phút' in html
        assert 'EduShift' in html
    assert delivered[0]['Subject'] != delivered[1]['Subject']
