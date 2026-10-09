"""File imports must be repeatable and preserve accepted shifts."""

from datetime import datetime, timedelta, timezone
import uuid

import pytest


def test_import_deduplicates_and_preserves_accepted_shift(verified_register):
    try:
        from app.database import SessionLocal, engine
        with engine.connect() as connection:
            connection.exec_driver_sql('SELECT 1')
    except Exception as exc:
        pytest.skip(f'PostgreSQL integration database unavailable: {exc}')

    from fastapi.testclient import TestClient
    from app.main import app
    from app.models import User, Employer

    client = TestClient(app)
    marker = 'file_' + uuid.uuid4().hex[:12]
    registered = []

    def register(role):
        username = marker + role.lower()
        body = {'role': role, 'username': username, 'password': 'TestPass123!'}
        body['full_name' if role == 'STUDENT' else 'company_name'] = username
        response = verified_register(client, body)
        assert response.status_code == 201, response.text
        registered.append(username)
        if role == 'EMPLOYER':
            session = SessionLocal()
            try:
                session.query(Employer).filter(Employer.user_id == response.json()['user_id']).update({'is_verified': True})
                session.commit()
            finally:
                session.close()
        return {'Authorization': 'Bearer ' + response.json()['access_token']}

    try:
        student = register('STUDENT')
        employer = register('EMPLOYER')
        start = (datetime.now(timezone.utc) + timedelta(days=20)).replace(hour=8, minute=0, second=0, microsecond=0)
        end = start + timedelta(hours=3)
        free = {'title': 'Rảnh', 'type': 'FREE', 'start_time': (start - timedelta(hours=1)).isoformat(), 'end_time': (end + timedelta(hours=1)).isoformat()}
        assert client.post('/api/schedules/import', headers=student, json={'items': [free, free]}).json() == {'imported': 1, 'skipped': 1, 'replaced': False}
        assert client.post('/api/schedules/import', headers=student, json={'items': [free]}).json()['imported'] == 0
        shift = client.post('/api/shifts', headers=employer, json={
            'title': marker, 'location': 'Hà Nội', 'start_time': start.isoformat(),
            'end_time': end.isoformat(), 'required_workers': 1, 'required_skills': [],
        })
        assert shift.status_code == 201, shift.text
        application = client.post('/api/applications', headers=student, json={'shift_id': shift.json()['id']})
        assert application.status_code == 201, application.text
        accepted = client.patch('/api/applications/' + application.json()['application_id'] + '/accept', headers=employer)
        assert accepted.status_code == 200, accepted.text
        busy = {'title': 'Trùng ca', 'type': 'STUDY', 'start_time': start.isoformat(), 'end_time': end.isoformat()}
        assert client.post('/api/schedules/import', headers=student, json={'items': [busy], 'replace': True}).status_code == 409
        assert client.post('/api/schedules/import', headers=student, json={'items': [free], 'replace': True}).status_code == 200
        schedule = client.get('/api/schedules', headers=student).json()
        assert sorted(item['type'] for item in schedule) == ['FREE', 'WORK']
    finally:
        session = SessionLocal()
        try:
            for username in registered:
                user = session.query(User).filter(User.username == username).first()
                if user:
                    session.delete(user)
            session.commit()
        finally:
            session.close()
