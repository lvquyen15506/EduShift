"""The employer-to-student notification and application journey used by mobile QA."""

from datetime import datetime, timedelta, timezone
import uuid

import pytest


def test_employer_shift_notifies_student_and_student_applies(verified_register):
    try:
        from app.database import SessionLocal, engine
        with engine.connect() as connection:
            connection.exec_driver_sql('SELECT 1')
    except Exception as exc:
        pytest.skip(f'PostgreSQL integration database unavailable: {exc}')

    from fastapi.testclient import TestClient
    from app.main import app
    from app.models import Employer, Notification, User

    client = TestClient(app)
    marker = 'phase5_' + uuid.uuid4().hex[:12]
    created = []

    def register(role):
        username = marker + '_' + role.lower()
        body = {'role': role, 'username': username, 'password': 'TestPass123!'}
        body['full_name' if role == 'STUDENT' else 'company_name'] = username
        response = verified_register(client, body)
        assert response.status_code == 201, response.text
        created.append(response.json()['user_id'])
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
        start = (datetime.now(timezone.utc) + timedelta(days=14)).replace(hour=8, minute=0, second=0, microsecond=0)
        end = start + timedelta(hours=3)
        free = client.post('/api/schedules', headers=student, json={
            'title': 'Rảnh để ứng tuyển', 'type': 'FREE',
            'start_time': (start - timedelta(hours=1)).isoformat(),
            'end_time': (end + timedelta(hours=1)).isoformat(),
        })
        assert free.status_code == 201, free.text

        shift = client.post('/api/shifts', headers=employer, json={
            'title': marker, 'description': 'Ca kiểm thử phase 5', 'location': 'Hà Nội',
            'start_time': start.isoformat(), 'end_time': end.isoformat(),
            'hourly_rate': 30000, 'required_workers': 1, 'required_skills': [],
        })
        assert shift.status_code == 201 and shift.json()['matched_students'] >= 1, shift.text
        shift_id = shift.json()['id']

        notices = client.get('/api/notifications', headers=student)
        assert notices.status_code == 200
        assert any(item['kind'] == 'MATCH' and item['shift_id'] == shift_id and marker in item['body'] for item in notices.json())
        dashboard = client.get('/api/student/dashboard', headers=student)
        assert dashboard.status_code == 200
        assert any(item['id'] == shift_id for item in dashboard.json()['recommended_shifts'])

        detail = client.get('/api/shifts/' + shift_id, headers=student)
        assert detail.status_code == 200 and detail.json()['available'] is True
        application = client.post('/api/applications', headers=student, json={'shift_id': shift_id})
        assert application.status_code == 201, application.text
        assert client.get('/api/shifts/' + shift_id, headers=student).json()['applied'] is True
        assert client.post('/api/applications', headers=student, json={'shift_id': shift_id}).status_code == 409

        employer_notices = client.get('/api/notifications', headers=employer)
        assert employer_notices.status_code == 200
        assert any(item['kind'] == 'APPLICATION' and item['shift_id'] == shift_id and marker in item['body'] for item in employer_notices.json())
        applicants = client.get('/api/shifts/' + shift_id + '/applications', headers=employer)
        assert applicants.status_code == 200
        assert any(item['id'] == application.json()['application_id'] for item in applicants.json())
    finally:
        session = SessionLocal()
        try:
            session.query(Notification).filter(Notification.body.contains(marker)).delete(synchronize_session=False)
            for user_id in created:
                user = session.query(User).filter(User.id == user_id).first()
                if user:
                    session.delete(user)
            session.commit()
        finally:
            session.close()
