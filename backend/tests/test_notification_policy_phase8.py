from datetime import datetime, timedelta
import uuid

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.email_delivery import EmailDeliveryError
from app.main import app, build_notification, create_token
from app.models import AdminAudit, NotificationPolicy, PushToken, User
from app.push_worker import deliver_email_once, deliver_once


def test_notification_version_channels_and_email_retry(monkeypatch):
    client = TestClient(app)
    marker = uuid.uuid4().hex[:10]
    db = SessionLocal()
    admin = User(username='admin_n_' + marker, email='admin_n_' + marker + '@example.com', password_hash='unused', role='ADMIN')
    student = User(username='student_n_' + marker, email='student_n_' + marker + '@example.com', password_hash='unused', role='STUDENT')
    db.add_all([admin, student]); db.commit(); db.refresh(admin); db.refresh(student)
    headers = {'Authorization': 'Bearer ' + create_token(admin)}
    student_headers = {'Authorization': 'Bearer ' + create_token(student)}
    policy = db.query(NotificationPolicy).filter_by(kind='MATCH').one()
    original = {key: getattr(policy, key) for key in ('title_template', 'body_template', 'in_app_enabled', 'email_enabled', 'push_enabled', 'version', 'updated_at')}
    try:
        changed = client.patch('/api/admin/notification-policies/MATCH', headers=headers, json={
            'title_template': 'Mới: {title}', 'body_template': '{body}',
            'in_app_enabled': False, 'email_enabled': True, 'push_enabled': False})
        assert changed.status_code == 200, changed.text
        assert client.patch('/api/admin/notification-policies/MATCH', headers=headers,
            json={'title_template': '{title.__class__}'}).status_code == 422
        assert client.get('/api/admin/notification-policies', headers=student_headers).status_code == 403
        db.expire_all()
        note = build_notification(db, user_id=student.id, title='Ca phù hợp', body='Thông tin ca', kind='MATCH')
        db.add(note)
        db.add(PushToken(user_id=student.id, token='ExponentPushToken[' + marker + ']', platform='android',
                         registered_at=datetime.utcnow() - timedelta(minutes=1)))
        db.commit(); db.refresh(note)
        assert note.title == 'Mới: Ca phù hợp' and note.template_version == changed.json()['version']
        assert client.get('/api/notifications', headers=student_headers).json() == []
        assert deliver_once(db, note.id) is False
        calls = []
        def send_email(*args):
            calls.append(args)
            if len(calls) == 1: raise EmailDeliveryError('SMTP tạm lỗi')
        monkeypatch.setattr('app.push_worker.send_notification_email', send_email)
        assert deliver_email_once(db, note.id) is True
        db.refresh(note)
        assert note.email_attempts == 1 and note.email_sent_at is None
        note.email_next_attempt_at = datetime.utcnow() - timedelta(seconds=1); db.commit()
        assert deliver_email_once(db, note.id) is True
        db.refresh(note)
        assert note.email_sent_at is not None and len(calls) == 2
        newer = client.patch('/api/admin/notification-policies/MATCH', headers=headers,
            json={'title_template': 'Đổi: {title}', 'in_app_enabled': True, 'email_enabled': False})
        assert newer.status_code == 200
        db.expire_all()
        next_note = build_notification(db, user_id=student.id, title='Ca khác', body='Nội dung khác', kind='MATCH')
        db.add(next_note); db.commit(); db.refresh(next_note)
        assert next_note.title == 'Đổi: Ca khác'
        assert note.title == 'Mới: Ca phù hợp'
        assert next_note.template_version == note.template_version + 1
        assert len(client.get('/api/notifications', headers=student_headers).json()) == 1
    finally:
        db.rollback()
        db.query(AdminAudit).filter_by(actor_id=admin.id).delete()
        db.delete(student); db.commit()
        db.delete(admin)
        policy = db.query(NotificationPolicy).filter_by(kind='MATCH').one()
        for key, value in original.items(): setattr(policy, key, value)
        db.commit(); db.close()
