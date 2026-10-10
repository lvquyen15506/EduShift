from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import uuid

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Employer, User


def test_free_quota_is_total_and_concurrent(verified_register):
    client = TestClient(app)
    name = 'quota_' + uuid.uuid4().hex[:12]
    registered = verified_register(client, {'role': 'EMPLOYER', 'username': name,
        'company_name': name, 'password': 'TestPass123!'})
    assert registered.status_code == 201, registered.text
    user_id = registered.json()['user_id']
    headers = {'Authorization': 'Bearer ' + registered.json()['access_token']}
    db = SessionLocal()
    try:
        db.query(Employer).filter_by(user_id=user_id).update({'is_verified': True})
        db.commit()
        assert client.get('/api/employer/plan', headers=headers).json()['posts_remaining'] == 5
        start = datetime.now(timezone.utc) + timedelta(days=10)
        payload = {'title': name, 'location': 'Hà Nội', 'start_time': start.isoformat(),
            'end_time': (start + timedelta(hours=3)).isoformat(), 'required_workers': 1}
        for _ in range(4):
            response = client.post('/api/shifts', json=payload, headers=headers)
            assert response.status_code == 201, response.text
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: client.post('/api/shifts', json=payload, headers=headers), range(2)))
        assert sorted(result.status_code for result in results) == [201, 402]
        plan = client.get('/api/employer/plan', headers=headers).json()
        assert plan['posts_used'] == 5 and plan['free_posts_used'] == 5 and plan['posts_remaining'] == 0
        assert client.get('/api/employer/plan').status_code == 401
    finally:
        db.rollback()
        user = db.query(User).filter_by(id=user_id).first()
        if user:
            db.delete(user)
            db.commit()
        db.close()
