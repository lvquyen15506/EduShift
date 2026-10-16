from datetime import datetime, timedelta, timezone
import uuid

from app.database import SessionLocal
from app.models import Employer, User


def test_followed_employer_new_shift_notifies_once_and_unfollow_stops_it(verified_register):
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    marker = 'follow_' + uuid.uuid4().hex[:10]
    employer = verified_register(client, {'role': 'EMPLOYER', 'username': marker + '_employer', 'company_name': 'Công ty ' + marker, 'password': 'TestPass123!'})
    student = verified_register(client, {'role': 'STUDENT', 'username': marker + '_student', 'full_name': 'Sinh viên ' + marker, 'password': 'TestPass123!'})
    assert employer.status_code == 201 and student.status_code == 201
    employer_id = employer.json()['user_id']
    student_token = {'Authorization': 'Bearer ' + student.json()['access_token']}
    employer_token = {'Authorization': 'Bearer ' + employer.json()['access_token']}
    db = SessionLocal()
    try:
        db.query(Employer).filter_by(user_id=employer_id).update({'is_verified': True})
        db.commit()
        path = '/api/employers/' + employer_id + '/follow'
        assert client.put(path, headers=employer_token).status_code == 403
        assert client.put(path, headers=student_token).json() == {'following': True}
        assert client.put(path, headers=student_token).json() == {'following': True}
        assert client.get('/api/employers/' + employer_id + '/profile', headers=student_token).json()['following'] is True
        assert len(client.get('/api/student/followed-employers', headers=student_token).json()) == 1

        start = datetime.now(timezone.utc) + timedelta(days=3)
        def post_shift(title, offset):
            response = client.post('/api/shifts', headers=employer_token, json={
                'title': title, 'location': 'Hà Nội', 'start_time': (start + timedelta(days=offset)).isoformat(),
                'end_time': (start + timedelta(days=offset, hours=4)).isoformat(),
                'required_workers': 2, 'hourly_rate': 45000,
            })
            assert response.status_code == 201, response.text
            return response.json()['id']

        first_id = post_shift(marker + ' first', 0)
        profile = client.get('/api/employers/' + employer_id + '/profile', headers=student_token).json()
        assert [item['id'] for item in profile['open_shifts']] == [first_id]
        notices = client.get('/api/notifications', headers=student_token).json()
        followed_notices = [item for item in notices if item['kind'] == 'FOLLOWED_EMPLOYER']
        assert len(followed_notices) == 1 and followed_notices[0]['shift_id'] == first_id
        assert client.delete(path, headers=student_token).json() == {'following': False}
        assert client.get('/api/employers/' + employer_id + '/profile', headers=student_token).json()['following'] is False
        post_shift(marker + ' second', 1)
        notices = client.get('/api/notifications', headers=student_token).json()
        assert len([item for item in notices if item['kind'] == 'FOLLOWED_EMPLOYER']) == 1
    finally:
        db.close()
        cleanup = SessionLocal()
        try:
            for user_id in [student.json()['user_id'], employer_id]:
                user = cleanup.query(User).filter_by(id=user_id).first()
                if user: cleanup.delete(user)
            cleanup.commit()
        finally:
            cleanup.close()
