"""Attendance, bilateral reviews, and voluntary location matching."""

from datetime import datetime, timedelta, timezone
import uuid

import pytest


def test_attendance_reviews_and_private_location():
    try:
        from app.database import SessionLocal, engine
        with engine.connect() as connection:
            connection.exec_driver_sql('SELECT 1')
    except Exception as exc:
        pytest.skip(f'PostgreSQL integration database unavailable: {exc}')

    from fastapi.testclient import TestClient
    from app.main import app, create_token, pwd_context
    from app.models import JobShift, Student, User

    client = TestClient(app)
    marker = 'phase8_' + uuid.uuid4().hex[:12]
    names = []

    def register(role, suffix):
        name = marker + suffix
        payload = {'username': name, 'password': 'TestPass123!', 'role': role}
        payload['full_name' if role == 'STUDENT' else 'company_name'] = name
        result = client.post('/api/auth/register', json=payload)
        assert result.status_code == 201, result.text
        names.append(name)
        return result.json()['user_id'], {'Authorization': 'Bearer ' + result.json()['access_token']}

    try:
        student_id, student = register('STUDENT', '_student')
        employer_id, employer = register('EMPLOYER', '_employer')
        _, stranger = register('EMPLOYER', '_stranger')
        session = SessionLocal()
        try:
            admin_user = User(username=marker + '_admin', role='ADMIN', password_hash=pwd_context.hash('TestPass123!'))
            session.add(admin_user)
            session.commit()
            session.refresh(admin_user)
            admin = {'Authorization': 'Bearer ' + create_token(admin_user)}
            names.append(admin_user.username)
        finally:
            session.close()
        assert client.patch('/api/admin/employers/' + employer_id + '/verify', headers=admin, json={'is_verified': True}).status_code == 200
        profile = client.get('/api/auth/me', headers=student).json()['profile']
        assert profile['average_rating'] is None
        assert client.put('/api/student/location', headers=student, json={'latitude': 21.0285, 'longitude': 105.8542}).status_code == 200
        assert client.put('/api/student/location', headers=employer, json={'latitude': 21, 'longitude': 105}).status_code == 403
        start = datetime.now(timezone.utc) + timedelta(minutes=15)
        end = start + timedelta(hours=1)
        created = client.post('/api/shifts', headers=employer, json={'title': marker, 'location': 'Hà Nội', 'start_time': start.isoformat(), 'end_time': end.isoformat(), 'required_workers': 1, 'latitude': 21.0285, 'longitude': 105.8542})
        assert created.status_code == 201, created.text
        shift_id = created.json()['id']
        candidates = client.get('/api/candidates?shift_id=' + shift_id, headers=employer).json()
        candidate = next(item for item in candidates if item['id'] == student_id)
        assert 'latitude' not in candidate and 'longitude' not in candidate
        assert any('Khoảng cách' in reason for reason in candidate['match_reasons'])
        applied = client.post('/api/applications', headers=student, json={'shift_id': shift_id})
        assert applied.status_code == 201, applied.text
        application_id = applied.json()['application_id']
        base = '/api/applications/' + application_id
        assert client.patch(base + '/check-in', headers=student).status_code == 409
        assert client.patch(base + '/accept', headers=employer).status_code == 200
        assert client.patch(base + '/check-in', headers=stranger).status_code == 403
        assert client.patch(base + '/check-in', headers=student).status_code == 200
        assert client.patch(base + '/check-in', headers=student).status_code == 409
        assert client.patch(base + '/check-out', headers=student).status_code == 409
        assert client.patch(base + '/complete', headers=employer).status_code == 409
        session = SessionLocal()
        try:
            shift = session.query(JobShift).filter(JobShift.id == uuid.UUID(shift_id)).one()
            shift.end_time = datetime.utcnow() - timedelta(seconds=1)
            session.commit()
        finally:
            session.close()
        assert client.patch(base + '/check-out', headers=student).status_code == 200
        assert client.patch(base + '/complete', headers=stranger).status_code == 404
        assert client.patch(base + '/complete', headers=employer).status_code == 200
        assert client.patch(base + '/complete', headers=employer).status_code == 409
        assert client.get('/api/shifts/' + shift_id, headers=student).json()['application_status'] == 'COMPLETED'
        assert client.post(base + '/reviews', headers=stranger, json={'rating': 1}).status_code == 404
        assert client.post(base + '/reviews', headers=student, json={'rating': 5}).status_code == 201
        assert client.post(base + '/reviews', headers=employer, json={'rating': 4}).status_code == 201
        assert client.post(base + '/reviews', headers=employer, json={'rating': 2}).status_code == 409
        session = SessionLocal()
        try:
            assert session.query(Student).filter(Student.user_id == uuid.UUID(student_id)).one().average_rating == 4
        finally:
            session.close()
    finally:
        session = SessionLocal()
        try:
            for name in names:
                user = session.query(User).filter(User.username == name).first()
                if user:
                    session.delete(user)
            session.commit()
        finally:
            session.close()
