from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import uuid

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app, create_token
from app.models import AdminAudit, Employer, EmployerPlan, EmployerSubscription, User


def test_plan_purchase_uses_server_price_and_snapshot(monkeypatch, verified_register):
    monkeypatch.setenv('PAYMENTS_MODE', 'sandbox')
    monkeypatch.setenv('PAYMENT_WEBHOOK_SECRET', 'test-webhook-secret')
    client = TestClient(app)
    marker = uuid.uuid4().hex[:10]
    db = SessionLocal()
    admin = User(username='admin_' + marker, email='admin_' + marker + '@example.com',
                 password_hash='unused', role='ADMIN')
    db.add(admin); db.commit(); db.refresh(admin)
    admin_headers = {'Authorization': 'Bearer ' + create_token(admin)}
    employer_id = None
    plan_id = None
    try:
        registration = verified_register(client, {'role': 'EMPLOYER', 'username': 'buy_' + marker,
            'company_name': 'Buy ' + marker, 'password': 'TestPass123!'})
        assert registration.status_code == 201, registration.text
        employer_id = registration.json()['user_id']
        employer_headers = {'Authorization': 'Bearer ' + registration.json()['access_token']}
        db.query(Employer).filter_by(user_id=employer_id).update({'is_verified': True}); db.commit()
        plan = client.post('/api/admin/plans', headers=admin_headers, json={
            'code': 'TEST_' + marker.upper(), 'name': 'Gói thử', 'post_limit': 2,
            'price': 99000, 'duration_days': 30, 'description': 'Hai ca'})
        assert plan.status_code == 201, plan.text
        plan_id = plan.json()['id']
        assert client.post('/api/admin/plans', headers=employer_headers, json={}).status_code == 403
        order = client.post('/api/employer/checkout', headers=employer_headers,
            json={'plan_id': plan_id, 'price': 1})
        assert order.status_code == 201, order.text
        assert order.json()['amount'] == 99000
        assert client.patch('/api/admin/plans/' + plan_id, headers=admin_headers,
            json={'post_limit': 1, 'price': 199000, 'is_active': False}).status_code == 200
        assert not any(p['id'] == plan_id for p in client.get('/api/plans').json())
        payload = {'payment_id': order.json()['id'], 'outcome': 'SUCCESS', 'event_id': 'event_' + marker}
        raw = json.dumps(payload, separators=(',', ':')).encode()
        assert client.post('/api/payments/webhook', content=raw,
            headers={'x-edushift-signature': 'bad'}).status_code == 401
        signature = hmac.new(b'test-webhook-secret', raw, hashlib.sha256).hexdigest()
        first = client.post('/api/payments/webhook', content=raw,
            headers={'x-edushift-signature': signature})
        assert first.status_code == 200, first.text
        second = client.post('/api/payments/webhook', content=raw,
            headers={'x-edushift-signature': signature})
        assert second.status_code == 200 and second.json()['status'] == 'SUCCESS'
        info = client.get('/api/employer/plan', headers=employer_headers).json()
        assert info['posts_remaining'] == 2 and info['plan']['post_limit'] == 2
        start = datetime.now(timezone.utc) + timedelta(days=4)
        shift = {'title': marker, 'location': 'Hà Nội', 'start_time': start.isoformat(),
                 'end_time': (start + timedelta(hours=3)).isoformat(), 'required_workers': 1}
        assert [client.post('/api/shifts', headers=employer_headers, json=shift).status_code
                for _ in range(3)] == [201, 201, 402]
        assert client.patch('/api/admin/plans/' + plan_id, headers=admin_headers,
            json={'is_active': True}).status_code == 200
        renewal = client.post('/api/employer/checkout', headers=employer_headers,
            json={'plan_id': plan_id})
        assert renewal.status_code == 201, renewal.text
        before_expiry = db.query(EmployerSubscription).filter_by(employer_id=employer_id).one().expires_at
        paid = client.post('/api/payments/sandbox/' + renewal.json()['id'],
            headers=employer_headers, json={'outcome': 'SUCCESS'})
        assert paid.status_code == 200, paid.text
        renewed = client.get('/api/employer/plan', headers=employer_headers).json()
        assert renewed['posts_used'] == 2 and renewed['posts_remaining'] == 1
        db.expire_all()
        subscription = db.query(EmployerSubscription).filter_by(employer_id=employer_id).one()
        assert subscription.expires_at > before_expiry + timedelta(days=29)
        assert client.post('/api/payments/sandbox/' + renewal.json()['id'],
            headers=employer_headers, json={'outcome': 'SUCCESS'}).json()['status'] == 'SUCCESS'
        assert client.get('/api/employer/plan', headers=employer_headers).json()['posts_remaining'] == 1
        subscription.expires_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1)
        db.commit()
        expired = client.get('/api/employer/plan', headers=employer_headers).json()
        assert expired['plan']['code'] == 'FREE' and expired['posts_remaining'] == 5
        assert client.post('/api/shifts', headers=employer_headers, json=shift).status_code == 201
        fallback = client.get('/api/employer/plan', headers=employer_headers).json()
        assert fallback['plan']['code'] == 'FREE' and fallback['free_posts_used'] == 1
    finally:
        db.rollback()
        if employer_id:
            employer = db.query(User).filter_by(id=employer_id).first()
            if employer: db.delete(employer)
        db.query(AdminAudit).filter_by(actor_id=admin.id).delete()
        db.commit()
        if plan_id:
            db.query(EmployerPlan).filter_by(id=plan_id).delete(); db.commit()
        db.delete(admin); db.commit(); db.close()
