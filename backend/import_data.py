"""Import JSON seed data. Usage: python -m import_data path/to/data.json"""
import json, sys
from datetime import datetime
from app.database import Base, engine, SessionLocal
from app import models
from app.main import pwd_context


def import_json(path):
    Base.metadata.create_all(bind=engine)
    payload = json.load(open(path, encoding='utf-8'))
    db = SessionLocal()
    try:
        users = {}
        for item in payload.get('users', []):
            user = models.User(username=item.get('username'), email=item.get('email'), role=item['role'].upper(), password_hash=pwd_context.hash(item.get('password', 'EduShift123!')))
            db.add(user); db.flush(); users[item.get('username') or item.get('email')] = user
            if user.role == 'STUDENT': db.add(models.Student(user_id=user.id, full_name=item['full_name'], university=item.get('university'), major=item.get('major'), skills=','.join(item.get('skills', []))))
            if user.role == 'EMPLOYER': db.add(models.Employer(user_id=user.id, company_name=item['company_name'], address=item.get('address'), phone=item.get('phone')))
        db.commit(); print(f'Imported {len(users)} users')
    finally: db.close()

if __name__ == '__main__':
    if len(sys.argv) != 2: raise SystemExit('Usage: python -m import_data data.json')
    import_json(sys.argv[1])
