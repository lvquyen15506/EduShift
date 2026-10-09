"""Account creation and password recovery require a single-use email code."""

from datetime import datetime, timedelta
import uuid

import pytest


def test_registration_otp_attempts_expiry_and_reuse(monkeypatch):
    try:
        from app.database import SessionLocal, engine
        with engine.connect() as connection:
            connection.exec_driver_sql('SELECT 1')
    except Exception as exc:
        pytest.skip(f'PostgreSQL integration database unavailable: {exc}')

    from fastapi.testclient import TestClient
    from app import main, models

    client = TestClient(main.app)
    sent = []
    monkeypatch.setattr(main, 'send_otp_email', lambda email, code, purpose: sent.append((email, code, purpose)))
    marker = uuid.uuid4().hex
    email = marker + '@example.com'
    body = {'role': 'STUDENT', 'full_name': 'OTP Student', 'username': marker,
            'email': email, 'password': 'ExamplePass123'}

    try:
        assert client.post('/api/auth/register', json=body).status_code == 202
        assert sent[-1][2] == 'REGISTER'
        assert client.post('/api/auth/register', json=body).status_code == 429
        wrong = {'email': email, 'code': '999999' if sent[-1][1] != '999999' else '888888'}
        for _ in range(4):
            assert client.post('/api/auth/register/verify', json=wrong).status_code == 400
        assert client.post('/api/auth/register/verify', json=wrong).status_code == 429
        assert client.post('/api/auth/register/verify', json={'email': email, 'code': sent[-1][1]}).status_code == 400

        assert client.post('/api/auth/register', json=body).status_code == 202
        code = sent[-1][1]
        with SessionLocal() as db:
            item = db.query(models.EmailOtp).filter_by(email=email, purpose='REGISTER').one()
            assert code not in item.code_hash and code not in (item.payload or '')
            item.expires_at = datetime.utcnow() - timedelta(seconds=1)
            db.commit()
        assert client.post('/api/auth/register/verify', json={'email': email, 'code': code}).status_code == 400

        assert client.post('/api/auth/register', json=body).status_code == 202
        code = sent[-1][1]
        confirmed = client.post('/api/auth/register/verify', json={'email': email, 'code': code})
        assert confirmed.status_code == 201
        assert client.post('/api/auth/register/verify', json={'email': email, 'code': code}).status_code == 400
        assert client.post('/api/auth/login', json={'identifier': email, 'password': body['password']}).status_code == 200
    finally:
        with SessionLocal() as db:
            db.query(models.EmailOtp).filter_by(email=email).delete()
            user = db.query(models.User).filter_by(email=email).first()
            if user:
                db.delete(user)
            db.commit()


def test_password_reset_requires_code_and_changes_password(monkeypatch, verified_register):
    try:
        from app.database import SessionLocal, engine
        with engine.connect() as connection:
            connection.exec_driver_sql('SELECT 1')
    except Exception as exc:
        pytest.skip(f'PostgreSQL integration database unavailable: {exc}')

    from fastapi.testclient import TestClient
    from app import main, models

    client = TestClient(main.app)
    marker = uuid.uuid4().hex
    email = marker + '@example.com'
    body = {'role': 'STUDENT', 'full_name': 'Reset Student', 'username': marker,
            'email': email, 'password': 'BeforePass123'}
    assert verified_register(client, body).status_code == 201
    sent = []
    monkeypatch.setattr(main, 'send_otp_email', lambda address, code, purpose: sent.append((address, code, purpose)))
    try:
        assert client.post('/api/auth/password-reset/request', json={'email': 'missing-' + email}).status_code == 202
        assert not sent
        assert client.post('/api/auth/password-reset/request', json={'email': email}).status_code == 202
        assert sent[-1][2] == 'RESET'
        assert client.post('/api/auth/password-reset/request', json={'email': email}).status_code == 202
        assert len(sent) == 1
        confirm = {'email': email, 'code': sent[-1][1], 'new_password': 'AfterPass123'}
        assert client.post('/api/auth/password-reset/confirm', json={**confirm, 'code': '999999' if confirm['code'] != '999999' else '888888'}).status_code == 400
        assert client.post('/api/auth/password-reset/confirm', json=confirm).status_code == 200
        assert client.post('/api/auth/password-reset/confirm', json=confirm).status_code == 400
        assert client.post('/api/auth/login', json={'identifier': email, 'password': 'BeforePass123'}).status_code == 401
        assert client.post('/api/auth/login', json={'identifier': email, 'password': 'AfterPass123'}).status_code == 200
    finally:
        with SessionLocal() as db:
            db.query(models.EmailOtp).filter_by(email=email).delete()
            user = db.query(models.User).filter_by(email=email).first()
            if user:
                db.delete(user)
            db.commit()
