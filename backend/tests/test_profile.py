"""Profile updates keep account identity and avatar data in sync."""

import base64
import uuid

import pytest


def test_profile_and_avatar_round_trip():
    try:
        from app.database import SessionLocal, engine
        with engine.connect() as connection:
            connection.exec_driver_sql('SELECT 1')
    except Exception as exc:
        pytest.skip(f'PostgreSQL integration database unavailable: {exc}')

    from fastapi.testclient import TestClient
    from app.main import app
    from app.models import User

    client = TestClient(app)
    marker = 'profile_' + uuid.uuid4().hex[:12]
    created = []

    def register(role, suffix):
        username = marker + suffix
        body = {'role': role, 'username': username, 'password': 'TestPass123!'}
        body['full_name' if role == 'STUDENT' else 'company_name'] = username
        response = client.post('/api/auth/register', json=body)
        assert response.status_code == 201, response.text
        created.append(response.json()['user_id'])
        return {'Authorization': 'Bearer ' + response.json()['access_token']}

    try:
        student = register('STUDENT', '_student')
        employer = register('EMPLOYER', '_employer')
        assert client.patch('/api/auth/profile', json={'full_name': 'Unauthorized'}).status_code == 401

        updated = client.patch('/api/auth/profile', headers=student, json={
            'username': marker + '_renamed', 'email': marker + '@example.com',
            'full_name': 'Nguyễn Văn A', 'phone': '0912345678',
            'university': 'Đại học thử nghiệm', 'major': 'Công nghệ thông tin', 'skills': 'Python',
        })
        assert updated.status_code == 200, updated.text
        assert updated.json()['profile']['full_name'] == 'Nguyễn Văn A'
        assert updated.json()['email'] == marker + '@example.com'
        assert client.get('/api/auth/me', headers=student).json()['profile']['skills'] == 'Python'

        assert client.patch('/api/auth/profile', headers=student, json={'company_name': 'Wrong role'}).status_code == 422
        assert client.patch('/api/auth/profile', headers=student, json={'username': None, 'email': None}).status_code == 422
        assert client.patch('/api/auth/profile', headers=employer, json={'username': marker + '_renamed'}).status_code == 409
        business = client.patch('/api/auth/profile', headers=employer, json={'company_name': 'Công ty Mẫu', 'address': 'Hà Nội'})
        assert business.status_code == 200, business.text
        assert business.json()['profile']['address'] == 'Hà Nội'

        png = base64.b64encode(bytes.fromhex('89504e470d0a1a0a') + b'avatar-test').decode()
        avatar = 'data:image/png;base64,' + png
        image_response = client.patch('/api/auth/avatar', headers=student, json={'avatar_data': avatar})
        assert image_response.status_code == 200, image_response.text
        assert client.get('/api/auth/me', headers=student).json()['avatar_data'] == avatar
        assert client.patch('/api/auth/avatar', headers=student, json={'avatar_data': 'data:image/png;base64,broken'}).status_code == 422
        assert client.patch('/api/auth/avatar', headers=student, json={'avatar_data': 'data:image/svg+xml;base64,PHN2Zz4='}).status_code == 422
        removed = client.patch('/api/auth/avatar', headers=student, json={'avatar_data': None})
        assert removed.status_code == 200 and removed.json()['avatar_data'] is None
    finally:
        session = SessionLocal()
        try:
            for user_id in created:
                user = session.query(User).filter(User.id == user_id).first()
                if user:
                    session.delete(user)
            session.commit()
        finally:
            session.close()
