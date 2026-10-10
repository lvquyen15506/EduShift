import uuid

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app, create_token
from app.models import AdminAudit, User


def test_admin_soft_delete_blocks_old_token_and_keeps_record():
    client = TestClient(app)
    marker = uuid.uuid4().hex[:10]
    db = SessionLocal()
    admin = User(username='admin_' + marker, email='admin_' + marker + '@example.com',
                 password_hash='unused', role='ADMIN')
    db.add(admin); db.commit(); db.refresh(admin)
    admin_headers = {'Authorization': 'Bearer ' + create_token(admin)}
    target_id = None
    try:
        created = client.post('/api/admin/users', headers=admin_headers, json={
            'username': 'staff_' + marker, 'email': 'staff_' + marker + '@example.com',
            'password': 'TestPass123!', 'role': 'EMPLOYER', 'name': 'Doanh nghiệp thử'})
        assert created.status_code == 201, created.text
        target_id = created.json()['id']
        login = client.post('/api/auth/login', json={'identifier': 'staff_' + marker, 'password': 'TestPass123!'})
        assert login.status_code == 200, login.text
        target_headers = {'Authorization': 'Bearer ' + login.json()['access_token']}
        assert client.get('/api/auth/me', headers=target_headers).status_code == 200
        assert client.patch('/api/admin/users/' + target_id, headers=target_headers,
            json={'is_active': False}).status_code == 403
        assert client.patch('/api/admin/users/' + target_id, headers=admin_headers,
            json={'is_active': False}).status_code == 200
        assert client.get('/api/auth/me', headers=target_headers).status_code == 401
        assert client.post('/api/auth/login', json={'identifier': 'staff_' + marker,
            'password': 'TestPass123!'}).status_code == 401
        assert client.delete('/api/admin/users/' + str(admin.id), headers=admin_headers).status_code == 409
        assert client.delete('/api/admin/users/' + target_id, headers=admin_headers).status_code == 200
        assert client.get('/api/admin/users/' + target_id, headers=admin_headers).json()['deleted_at']
    finally:
        db.rollback()
        db.query(AdminAudit).filter_by(actor_id=admin.id).delete()
        if target_id:
            target = db.query(User).filter_by(id=target_id).first()
            if target: db.delete(target)
        db.delete(admin); db.commit(); db.close()
