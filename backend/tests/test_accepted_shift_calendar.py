"""Acceptance must reserve a shift in the student's calendar."""

from datetime import datetime, timedelta, timezone
import uuid

import pytest


def test_accepted_shift_appears_in_calendar_and_blocks_overbooking():
    try:
        from app.database import SessionLocal, engine
        from app.models import User
        with engine.connect() as connection:
            connection.exec_driver_sql('SELECT 1')
    except Exception as exc:
        pytest.skip(f'PostgreSQL integration database unavailable: {exc}')

    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    marker = 'calendar_' + uuid.uuid4().hex[:10]
    created = []
    tokens = {}

    def register(role, suffix):
        username = marker + suffix
        body = {'role': role, 'username': username, 'password': 'TestPass123!'}
        body['full_name' if role == 'STUDENT' else 'company_name'] = username
        response = client.post('/api/auth/register', json=body)
        assert response.status_code == 201, response.text
        created.append(username)
        tokens[suffix] = response.json()['access_token']

    def call(method, path, actor, body=None):
        return client.request(method, path, headers={'Authorization': 'Bearer ' + tokens[actor]}, json=body)

    try:
        register('STUDENT', '_student_a')
        register('STUDENT', '_student_b')
        register('EMPLOYER', '_employer')
        register('EMPLOYER', '_other')
        start = (datetime.now(timezone.utc) + timedelta(days=14)).replace(hour=8, minute=0, second=0, microsecond=0)
        end = start + timedelta(hours=3)
        free = {'title': 'Rảnh cả buổi', 'type': 'FREE', 'start_time': (start - timedelta(hours=1)).isoformat(), 'end_time': (end + timedelta(hours=1)).isoformat()}
        for actor in ('_student_a', '_student_b'):
            assert call('POST', '/api/schedules', actor, free).status_code == 201
        shift_input = {'title': 'Ca thử tự xếp lịch', 'description': 'Test', 'location': 'Hà Nội', 'start_time': start.isoformat(), 'end_time': end.isoformat(), 'hourly_rate': 30000, 'required_workers': 1, 'required_skills': []}
        shift_response = call('POST', '/api/shifts', '_employer', shift_input)
        assert shift_response.status_code == 201, shift_response.text
        shift_id = shift_response.json()['id']
        applications = {}
        for actor in ('_student_a', '_student_b'):
            response = call('POST', '/api/applications', actor, {'shift_id': shift_id})
            assert response.status_code == 201, response.text
            applications[actor] = response.json()['application_id']
        before = call('GET', '/api/schedules', '_student_a').json()
        assert [item['type'] for item in before] == ['FREE']
        employer_list = call('GET', f'/api/shifts/{shift_id}/applications', '_employer')
        assert employer_list.status_code == 200 and len(employer_list.json()) == 2
        assert call('GET', f'/api/shifts/{shift_id}/applications', '_other').status_code == 404
        accept_path = '/api/applications/' + applications['_student_a'] + '/accept'
        assert call('PATCH', accept_path, '_other').status_code == 404
        accepted = call('PATCH', accept_path, '_employer')
        assert accepted.status_code == 200 and accepted.json()['status'] == 'ACCEPTED', accepted.text
        assert call('PATCH', accept_path, '_employer').status_code == 409
        assert call('PATCH', '/api/applications/' + applications['_student_b'] + '/accept', '_employer').status_code == 409

        after = call('GET', '/api/schedules', '_student_a').json()
        assert len(after) == 2
        assert any(item['type'] == 'FREE' and item['source'] == 'MANUAL' for item in after)
        work = next(item for item in after if item['type'] == 'WORK')
        assert work['source'] == 'SHIFT' and work['application_id'] == applications['_student_a']
        assert work['start_time'] == start.isoformat()
        assert work['end_time'] == end.isoformat()
        detail = call('GET', '/api/shifts/' + shift_id, '_student_a')
        assert detail.status_code == 200 and detail.json()['applied'] is True
        assert detail.json()['match_score'] > 0
        assert call('DELETE', '/api/schedules/' + work['id'], '_student_a').status_code == 409
        assert call('POST', '/api/schedules/import', '_student_a', {'items': [], 'replace': True}).status_code == 200
        assert [item['type'] for item in call('GET', '/api/schedules', '_student_a').json()] == ['WORK']
        notices = call('GET', '/api/notifications', '_student_a').json()
        assert any(item['title'] == 'Bạn đã được nhận vào ca làm' for item in notices)
        second_shift = call('POST', '/api/shifts', '_employer', {**shift_input, 'title': 'Ca trùng giờ'})
        assert second_shift.status_code == 201
        assert call('POST', '/api/applications', '_student_a', {'shift_id': second_shift.json()['id']}).status_code == 409
    finally:
        session = SessionLocal()
        try:
            for username in created:
                user = session.query(User).filter(User.username == username).first()
                if user:
                    session.delete(user)
            session.commit()
        finally:
            session.close()
