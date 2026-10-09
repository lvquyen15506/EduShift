from datetime import datetime, timedelta, timezone
import uuid

from app.database import SessionLocal
from app.models import Application, Employer, JobShift, User


def test_public_shifts_only_returns_verified_open_future_shifts(verified_register):
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    marker = 'public_' + uuid.uuid4().hex[:10]
    created = []

    def register_employer(suffix):
        response = verified_register(client, {
            'role': 'EMPLOYER',
            'username': marker + suffix,
            'company_name': marker + suffix,
            'password': 'TestPass123!',
        })
        assert response.status_code == 201, response.text
        created.append(response.json()['user_id'])
        return response.json()['access_token']

    verified_token = register_employer('_verified')
    unverified_token = register_employer('_unverified')
    session = SessionLocal()
    try:
        session.query(Employer).filter(Employer.user_id == created[0]).update({'is_verified': True})
        session.commit()
        start = datetime.now(timezone.utc) + timedelta(days=3)
        end = start + timedelta(hours=4)
        visible = client.post('/api/shifts', headers={'Authorization': f'Bearer {verified_token}'}, json={
            'title': marker + ' visible', 'location': 'Quận 1',
            'start_time': start.isoformat(), 'end_time': end.isoformat(),
            'hourly_rate': 45000, 'required_workers': 2,
        })
        assert visible.status_code == 201, visible.text
        hidden = client.post('/api/shifts', headers={'Authorization': f'Bearer {unverified_token}'}, json={
            'title': marker + ' hidden', 'location': 'Quận 3',
            'start_time': start.isoformat(), 'end_time': end.isoformat(),
            'hourly_rate': 45000, 'required_workers': 1,
        })
        assert hidden.status_code == 403

        old = models_shift = JobShift(
            employer_id=created[0], title=marker + ' old', location='Cũ',
            start_time=datetime.utcnow() - timedelta(hours=2),
            end_time=datetime.utcnow() - timedelta(hours=1), hourly_rate=1,
            required_workers=1, status='OPEN',
        )
        closed = JobShift(
            employer_id=created[0], title=marker + ' closed', location='Đóng',
            start_time=start, end_time=end, hourly_rate=1,
            required_workers=1, status='CLOSED',
        )
        session.add_all([old, closed]); session.commit()

        result = client.get('/api/public/shifts?limit=24')
        assert result.status_code == 200, result.text
        body = result.json()
        marker_items = [item for item in body['items'] if marker in item['title']]
        assert len(marker_items) == 1
        item = marker_items[0]
        assert item['id'] == visible.json()['id']
        assert item['remaining_workers'] == 2
        assert item['company_name'] == marker + '_verified'
        assert 'description' not in item and 'required_skills' not in item
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
