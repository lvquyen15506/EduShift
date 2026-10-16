from datetime import datetime, timedelta, timezone
import uuid

from app.database import SessionLocal
from app.models import Employer, User


def test_chat_advice_history_is_private_and_can_be_cleared(verified_register, monkeypatch):
    from fastapi.testclient import TestClient
    from app import main

    monkeypatch.setattr(main, '_gemini_chat', lambda *args: None)
    client = TestClient(main.app)
    marker = uuid.uuid4().hex[:10]
    student = verified_register(client, {'role': 'STUDENT', 'username': marker + '_a', 'full_name': 'Sinh viên A', 'password': 'TestPass123!'})
    other = verified_register(client, {'role': 'STUDENT', 'username': marker + '_b', 'full_name': 'Sinh viên B', 'password': 'TestPass123!'})
    employer = verified_register(client, {'role': 'EMPLOYER', 'username': marker + '_e', 'company_name': 'Quán thử nghiệm', 'password': 'TestPass123!'})
    assert student.status_code == other.status_code == employer.status_code == 201
    student_headers = {'Authorization': 'Bearer ' + student.json()['access_token']}
    other_headers = {'Authorization': 'Bearer ' + other.json()['access_token']}
    employer_headers = {'Authorization': 'Bearer ' + employer.json()['access_token']}
    ids = [student.json()['user_id'], other.json()['user_id'], employer.json()['user_id']]
    try:
        db = SessionLocal()
        try:
            db.query(Employer).filter_by(user_id=ids[2]).update({'is_verified': True})
            db.commit()
        finally:
            db.close()
        start = datetime.now(timezone.utc) + timedelta(days=2)
        study = client.post('/api/schedules', headers=student_headers, json={
            'title': 'Lớp học riêng', 'type': 'STUDY', 'start_time': (start - timedelta(hours=1)).isoformat(),
            'end_time': (start + timedelta(hours=1)).isoformat(),
        })
        assert study.status_code == 201, study.text
        shift = client.post('/api/shifts', headers=employer_headers, json={
            'title': 'Ca thử nghiệm riêng', 'location': 'Hà Nội', 'start_time': start.isoformat(),
            'end_time': (start + timedelta(hours=4)).isoformat(), 'required_workers': 1, 'hourly_rate': 45000,
        })
        assert shift.status_code == 201, shift.text
        reply = client.post('/api/chat', headers=student_headers, json={'message': 'Tư vấn lịch học và ca làm của tôi'})
        assert reply.status_code == 200, reply.text
        assert 'Ca thử nghiệm riêng' in reply.json()['answer']
        assert 'Trùng lịch' in reply.json()['answer']
        own_history = client.get('/api/chat/history', headers=student_headers)
        assert [item['role'] for item in own_history.json()] == ['user', 'assistant']
        assert client.get('/api/chat/history', headers=other_headers).json() == []
        assert client.get('/api/chat/history').status_code == 401
        assert client.delete('/api/chat/history', headers=student_headers).status_code == 204
        assert client.get('/api/chat/history', headers=student_headers).json() == []
    finally:
        db = SessionLocal()
        try:
            for user_id in ids:
                user = db.query(User).filter_by(id=user_id).first()
                if user: db.delete(user)
            db.commit()
        finally:
            db.close()
