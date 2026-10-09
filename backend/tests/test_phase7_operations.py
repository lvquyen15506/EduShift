"""Employer verification, invitations, and recruitment decisions."""

from datetime import datetime, timedelta, timezone
import uuid

import pytest


def test_verified_employer_invites_and_decides_applications(verified_register):
    try:
        from app.database import SessionLocal, engine
        with engine.connect() as connection:
            connection.exec_driver_sql('SELECT 1')
    except Exception as exc:
        pytest.skip(f'PostgreSQL integration database unavailable: {exc}')

    from fastapi.testclient import TestClient
    from app.main import app, create_token, pwd_context
    from app.models import User

    client = TestClient(app)
    marker = 'phase7_' + uuid.uuid4().hex[:12]
    users = []

    def register(role, suffix):
        username = marker + suffix
        body = {'role': role, 'username': username, 'password': 'TestPass123!'}
        body['full_name' if role == 'STUDENT' else 'company_name'] = username
        response = verified_register(client, body)
        assert response.status_code == 201, response.text
        users.append(username)
        return response.json()['user_id'], {'Authorization': 'Bearer ' + response.json()['access_token']}

    def post_shift(headers, offset):
        start = (datetime.now(timezone.utc) + timedelta(days=25 + offset)).replace(hour=8, minute=0, second=0, microsecond=0)
        response = client.post('/api/shifts', headers=headers, json={
            'title': marker + str(offset), 'location': 'Hà Nội', 'start_time': start.isoformat(),
            'end_time': (start + timedelta(hours=3)).isoformat(), 'required_workers': 1,
        })
        return response

    try:
        student_id, student = register('STUDENT', '_student')
        employer_id, employer = register('EMPLOYER', '_employer')
        _, other = register('EMPLOYER', '_other')
        session = SessionLocal()
        try:
            admin_user = User(username=marker + '_admin', role='ADMIN', password_hash=pwd_context.hash('TestPass123!'))
            session.add(admin_user)
            session.commit()
            session.refresh(admin_user)
            admin = {'Authorization': 'Bearer ' + create_token(admin_user)}
            users.append(admin_user.username)
        finally:
            session.close()

        assert post_shift(employer, 0).status_code == 403
        verify_path = '/api/admin/employers/' + employer_id + '/verify'
        assert client.patch(verify_path, headers=employer, json={'is_verified': True}).status_code == 403
        assert client.patch(verify_path, headers=admin, json={'is_verified': True}).status_code == 200
        assert next(item for item in client.get('/api/admin/users', headers=admin).json() if item['id'] == employer_id)['is_verified'] is True

        first = post_shift(employer, 0)
        assert first.status_code == 201, first.text
        first_id = first.json()['id']
        invitation_path = '/api/shifts/' + first_id + '/invitations'
        assert client.post(invitation_path, headers=other, json={'student_id': student_id}).status_code == 404
        invitation = client.post(invitation_path, headers=employer, json={'student_id': student_id})
        assert invitation.status_code == 201, invitation.text
        assert client.post(invitation_path, headers=employer, json={'student_id': student_id}).status_code == 409
        detail = client.get('/api/shifts/' + first_id, headers=student).json()
        assert detail['invitation_id'] == invitation.json()['id'] and detail['applied'] is False
        respond_path = '/api/applications/' + invitation.json()['id'] + '/respond'
        assert client.patch(respond_path, headers=other, json={'accept': True}).status_code == 403
        accepted = client.patch(respond_path, headers=student, json={'accept': True})
        assert accepted.status_code == 200 and accepted.json()['status'] == 'ACCEPTED', accepted.text
        assert client.patch(respond_path, headers=student, json={'accept': True}).status_code == 409
        assert client.get('/api/shifts/' + first_id, headers=employer).json()['status'] == 'FULL'
        assert any(item['type'] == 'WORK' and item['application_id'] == invitation.json()['id'] for item in client.get('/api/schedules', headers=student).json())
        assert client.patch('/api/shifts/' + first_id + '/status', headers=employer, json={'status': 'OPEN'}).status_code == 409

        second = post_shift(employer, 1)
        assert second.status_code == 201
        second_id = second.json()['id']
        status_path = '/api/shifts/' + second_id + '/status'
        assert client.patch(status_path, headers=employer, json={'status': 'CLOSED'}).status_code == 200
        assert client.post('/api/applications', headers=student, json={'shift_id': second_id}).status_code == 409
        assert client.patch(status_path, headers=employer, json={'status': 'OPEN'}).status_code == 200
        application = client.post('/api/applications', headers=student, json={'shift_id': second_id})
        assert application.status_code == 201, application.text
        reject_path = '/api/applications/' + application.json()['application_id'] + '/reject'
        assert client.patch(reject_path, headers=other).status_code == 404
        assert client.patch(reject_path, headers=employer).json()['status'] == 'REJECTED'
        assert any(item['title'] == 'Kết quả ứng tuyển' for item in client.get('/api/notifications', headers=student).json())

        third = post_shift(employer, 2)
        assert third.status_code == 201
        decline = client.post('/api/shifts/' + third.json()['id'] + '/invitations', headers=employer, json={'student_id': student_id})
        assert decline.status_code == 201
        declined = client.patch('/api/applications/' + decline.json()['id'] + '/respond', headers=student, json={'accept': False})
        assert declined.status_code == 200 and declined.json()['status'] == 'DECLINED'
    finally:
        session = SessionLocal()
        try:
            for username in users:
                user = session.query(User).filter(User.username == username).first()
                if user:
                    session.delete(user)
            session.commit()
        finally:
            session.close()
