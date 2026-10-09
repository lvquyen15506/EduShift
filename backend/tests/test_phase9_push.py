"""Push token registration and retryable delivery."""

import uuid
import httpx
import pytest


def test_push_delivery(monkeypatch):
    try:
        from app.database import SessionLocal, engine
        with engine.connect() as connection:
            connection.exec_driver_sql('SELECT 1')
    except Exception as exc:
        pytest.skip(f'PostgreSQL integration database unavailable: {exc}')

    from fastapi.testclient import TestClient
    from app.main import app
    from app.models import Notification, User
    from app.push_worker import deliver_once

    client = TestClient(app)
    username = 'push_' + uuid.uuid4().hex[:12]
    response = client.post('/api/auth/register', json={'role': 'STUDENT', 'username': username, 'password': 'TestPass123!', 'full_name': username})
    assert response.status_code == 201, response.text
    user_id = uuid.UUID(response.json()['user_id'])
    headers = {'Authorization': 'Bearer ' + response.json()['access_token']}
    token_body = {'token': 'ExponentPushToken[' + uuid.uuid4().hex + ']', 'platform': 'android'}
    try:
        assert client.post('/api/push-tokens', headers=headers, json=token_body).status_code == 201
        assert client.post('/api/push-tokens', headers=headers, json={'token': 'bad', 'platform': 'android'}).status_code == 422
        with SessionLocal() as db:
            notification = Notification(user_id=user_id, title='Ca mới', body='Nội dung riêng tư', kind='MATCH')
            db.add(notification)
            db.commit()
            notification_id = notification.id

        payloads = []

        class Success:
            def raise_for_status(self):
                pass

            def json(self):
                return {'data': {'status': 'ok', 'id': 'ticket'}}

        def send(url, json, timeout):
            payloads.append(json)
            return Success()

        monkeypatch.setattr(httpx, 'post', send)
        with SessionLocal() as db:
            assert deliver_once(db, notification_id)
            assert db.query(Notification).filter_by(id=notification_id).one().push_sent_at is not None
            assert payloads[0]['to'] == token_body['token']
            assert 'Nội dung riêng tư' not in payloads[0]['body']
            assert not deliver_once(db, notification_id)
            retry = Notification(user_id=user_id, title='Đơn mới', body='Nội dung', kind='APPLICATION')
            db.add(retry)
            db.commit()
            retry_id = retry.id

        def timeout(url, json, timeout):
            raise httpx.ConnectTimeout('temporary')

        monkeypatch.setattr(httpx, 'post', timeout)
        with SessionLocal() as db:
            assert deliver_once(db, retry_id)
            item = db.query(Notification).filter_by(id=retry_id).one()
            assert item.push_attempts == 1 and item.push_next_attempt_at is not None
            assert not deliver_once(db, retry_id)
        assert client.request('DELETE', '/api/push-tokens', headers=headers, json=token_body).status_code == 204
    finally:
        with SessionLocal() as db:
            user = db.query(User).filter_by(id=user_id).first()
            if user:
                db.delete(user)
            db.commit()
