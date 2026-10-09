"""Create test accounts through email verification."""

import uuid

import pytest


@pytest.fixture
def verified_register(monkeypatch):
    def create(client, body):
        from app import main

        sent = []
        monkeypatch.setattr(main, 'send_otp_email', lambda email, code, purpose: sent.append((email, code, purpose)))
        payload = dict(body)
        payload.setdefault('email', (payload.get('username') or uuid.uuid4().hex) + '@example.com')
        requested = client.post('/api/auth/register', json=payload)
        assert requested.status_code == 202, requested.text
        assert len(sent) == 1 and sent[0][0] == payload['email'].lower() and sent[0][2] == 'REGISTER'
        return client.post('/api/auth/register/verify', json={'email': payload['email'], 'code': sent[0][1]})

    return create
