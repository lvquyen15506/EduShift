from collections import Counter
from datetime import datetime, timedelta, timezone
import base64
import binascii
import json
import os
import re
import uuid
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, status, Header
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from sqlalchemy import or_, text
from sqlalchemy.orm import Session, joinedload, selectinload

from .database import Base, engine, get_db
from . import models
from .matching import match_student_shift, utc_naive
from .school_calendar import SchoolCalendarError, fetch_school_calendar

Base.metadata.create_all(bind=engine)

# Idempotent development migration for databases created by older EduShift versions.
def migrate_schema():
    statements = [
        "ALTER TABLE employers ADD COLUMN IF NOT EXISTS phone VARCHAR(30)",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS phone VARCHAR(30)",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS major VARCHAR(200)",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS skills TEXT DEFAULT ''",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS average_rating FLOAT DEFAULT 5.0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_data TEXT",
        "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS description TEXT",
        "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS location VARCHAR(300)",
        "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS hourly_rate FLOAT",
        "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'OPEN'",
        "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS required_skills TEXT DEFAULT ''",
        "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS required_workers INTEGER DEFAULT 1",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS match_reasons TEXT DEFAULT ''",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PENDING'",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS kind VARCHAR(30) DEFAULT 'INFO'",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS shift_id UUID",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE",
        "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS title VARCHAR(200)",
        "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'STUDY'",
        "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'MANUAL'",
        "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES applications(id) ON DELETE CASCADE",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_schedules_application_id ON schedules(application_id)",
    ]
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))

migrate_schema()

SECRET_KEY = os.getenv('JWT_SECRET', 'edushift-development-secret-change-me')
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24
pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
app = FastAPI(title='EduShift API', version='1.0.0', description='API kết nối việc làm part-time theo lịch học')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])

class RegisterRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: str = Field(min_length=6)
    role: str
    full_name: Optional[str] = None
    company_name: Optional[str] = None
    phone: Optional[str] = None
    university: Optional[str] = None
    major: Optional[str] = None
    address: Optional[str] = None

class LoginRequest(BaseModel):
    identifier: str
    password: str

class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    username: Optional[str] = Field(default=None, max_length=80)
    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(default=None, max_length=150)
    company_name: Optional[str] = Field(default=None, max_length=200)
    phone: Optional[str] = Field(default=None, max_length=30)
    university: Optional[str] = Field(default=None, max_length=200)
    major: Optional[str] = Field(default=None, max_length=200)
    skills: Optional[str] = Field(default=None, max_length=1000)
    address: Optional[str] = Field(default=None, max_length=300)

class AvatarUpdate(BaseModel):
    avatar_data: Optional[str] = Field(default=None, max_length=1_000_000)

class ShiftCreate(BaseModel):
    title: str
    description: str = ''
    location: str
    start_time: datetime
    end_time: datetime
    hourly_rate: float = 0
    required_workers: int = Field(default=1, ge=1)
    required_skills: list[str] = []

class ShiftOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    description: Optional[str]
    location: str
    start_time: datetime
    end_time: datetime
    hourly_rate: Optional[float]
    required_workers: int
    required_skills: list[str]
    status: str
    applicants: int

class ApplicationCreate(BaseModel):
    shift_id: uuid.UUID

class ScheduleInput(BaseModel):
    title: str = Field(default='', max_length=200)
    start_time: datetime
    end_time: datetime
    type: str = 'STUDY'

    @field_validator('type')
    @classmethod
    def valid_type(cls, value: str) -> str:
        value = value.upper()
        if value not in {'STUDY', 'BUSY', 'FREE'}:
            raise ValueError('type phải là STUDY, BUSY hoặc FREE')
        return value

class ScheduleImport(BaseModel):
    items: list[ScheduleInput] = Field(max_length=500)
    replace: bool = False

class SchoolSyncRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


def create_token(user: models.User) -> str:
    expires = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({'sub': str(user.id), 'role': user.role, 'exp': expires}, SECRET_KEY, algorithm=ALGORITHM)


def current_user(authorization: Optional[str], db: Session) -> Optional[models.User]:
    if not authorization:
        return None
    try:
        scheme, token = authorization.split(' ', 1)
        if scheme.lower() != 'bearer':
            return None
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user = db.query(models.User).filter(models.User.id == payload.get('sub')).first()
        return user
    except (ValueError, JWTError):
        return None

def user_or_401(authorization: Optional[str] = Header(default=None), db: Session = Depends(get_db)):
    user = current_user(authorization, db)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Token không hợp lệ hoặc đã hết hạn')
    return user

def require_role(*roles):
    def check(user: models.User = Depends(user_or_401)):
        if user.role not in roles:
            raise HTTPException(403, 'Tài khoản không có quyền truy cập')
        return user
    return check


def shift_dict(shift: models.JobShift):
    data = {k: getattr(shift, k) for k in ['id','title','description','location','start_time','end_time','hourly_rate','required_workers','status']}
    for key in ('start_time', 'end_time'):
        if data[key] is not None and data[key].tzinfo is None:
            data[key] = data[key].replace(tzinfo=timezone.utc)
    return {**data, 'company_name': shift.employer.company_name, 'required_skills': [x for x in (shift.required_skills or '').split(',') if x], 'applicants': len(shift.applications)}

def schedule_dict(item: models.Schedule):
    return {'id': item.id, 'title': item.title, 'type': item.type, 'source': item.source, 'application_id': item.application_id, 'start_time': item.start_time.replace(tzinfo=timezone.utc), 'end_time': item.end_time.replace(tzinfo=timezone.utc)}

def schedule_model(item: ScheduleInput, student_id: uuid.UUID):
    start, end = utc_naive(item.start_time), utc_naive(item.end_time)
    if end <= start:
        raise HTTPException(422, 'Giờ kết thúc phải sau giờ bắt đầu')
    return models.Schedule(student_id=student_id, title=item.title, type=item.type, start_time=start, end_time=end)

@app.get('/api/health')
def health():
    return {'status': 'ok', 'service': 'edushift-api'}

@app.post('/api/auth/register', status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    role = req.role.upper()
    if role not in {'STUDENT', 'EMPLOYER'}:
        raise HTTPException(400, 'Role phải là STUDENT hoặc EMPLOYER')
    if not req.username and not req.email:
        raise HTTPException(400, 'Cần username hoặc email')
    if req.username and db.query(models.User).filter(models.User.username == req.username).first():
        raise HTTPException(409, 'Username đã tồn tại')
    if req.email and db.query(models.User).filter(models.User.email == str(req.email)).first():
        raise HTTPException(409, 'Email đã tồn tại')
    user = models.User(username=req.username, email=str(req.email) if req.email else None, password_hash=pwd_context.hash(req.password), role=role)
    db.add(user); db.flush()
    if role == 'STUDENT':
        if not req.full_name: raise HTTPException(422, 'Sinh viên cần full_name')
        db.add(models.Student(user_id=user.id, full_name=req.full_name, phone=req.phone, university=req.university, major=req.major))
    else:
        if not req.company_name: raise HTTPException(422, 'Doanh nghiệp cần company_name')
        db.add(models.Employer(user_id=user.id, company_name=req.company_name, phone=req.phone, address=req.address))
    db.commit()
    return {'message': 'Đăng ký thành công', 'user_id': str(user.id), 'role': role, 'access_token': create_token(user), 'token_type': 'bearer'}

@app.post('/api/auth/login')
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(or_(models.User.email == req.identifier, models.User.username == req.identifier)).first()
    if not user or not pwd_context.verify(req.password, user.password_hash):
        raise HTTPException(401, 'Sai thông tin đăng nhập hoặc mật khẩu')
    return {'message': 'Đăng nhập thành công', 'user_id': str(user.id), 'role': user.role, 'username': user.username, 'email': user.email, 'access_token': create_token(user), 'token_type': 'bearer'}

@app.get('/api/auth/me')
def me(user: models.User = Depends(user_or_401)):
    return account_dict(user)

def account_dict(user: models.User):
    profile = user.student_profile or user.employer_profile
    profile_data = None
    if profile:
        profile_data = {column.name: getattr(profile, column.name) for column in profile.__table__.columns}
        if 'user_id' in profile_data: profile_data['user_id'] = str(profile_data['user_id'])
    return {'id': str(user.id), 'username': user.username, 'email': user.email, 'role': user.role, 'avatar_data': user.avatar_data, 'profile': profile_data}

@app.patch('/api/auth/profile')
def update_profile(req: ProfileUpdate, user: models.User = Depends(user_or_401), db: Session = Depends(get_db)):
    updates = req.model_dump(exclude_unset=True)
    role_fields = {'STUDENT': {'full_name', 'phone', 'university', 'major', 'skills'}, 'EMPLOYER': {'company_name', 'phone', 'address'}, 'ADMIN': set()}
    allowed = {'username', 'email'} | role_fields.get(user.role, set())
    if set(updates) - allowed:
        raise HTTPException(422, 'Trường thông tin không thể chỉnh sửa')
    if 'username' in updates:
        username = (updates['username'] or '').strip() or None
        if username and db.query(models.User).filter(models.User.username == username, models.User.id != user.id).first():
            raise HTTPException(409, 'Tên đăng nhập đã được sử dụng')
        user.username = username
    if 'email' in updates:
        email = str(updates['email']) if updates['email'] else None
        if email and db.query(models.User).filter(models.User.email == email, models.User.id != user.id).first():
            raise HTTPException(409, 'Email đã được sử dụng')
        user.email = email
    if not user.username and not user.email:
        raise HTTPException(422, 'Cần giữ ít nhất email hoặc tên đăng nhập')
    profile = user.student_profile or user.employer_profile
    if profile:
        for field in role_fields[user.role] & set(updates):
            value = updates[field]
            value = value.strip() if isinstance(value, str) else value
            if field in {'full_name', 'company_name'} and not value:
                raise HTTPException(422, 'Tên hiển thị không được để trống')
            setattr(profile, field, value)
    db.commit()
    db.refresh(user)
    return account_dict(user)

@app.patch('/api/auth/avatar')
def update_avatar(req: AvatarUpdate, user: models.User = Depends(user_or_401), db: Session = Depends(get_db)):
    if req.avatar_data is None:
        user.avatar_data = None
    else:
        match = re.fullmatch(r'data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)', req.avatar_data)
        if not match:
            raise HTTPException(422, 'Ảnh đại diện phải là JPEG, PNG hoặc WebP')
        try:
            image_bytes = base64.b64decode(match.group(2), validate=True)
        except binascii.Error:
            raise HTTPException(422, 'Dữ liệu ảnh không hợp lệ') from None
        mime = match.group(1)
        valid_image = (mime == 'jpeg' and image_bytes.startswith(bytes.fromhex('ffd8ff'))) or (mime == 'png' and image_bytes.startswith(bytes.fromhex('89504e470d0a1a0a'))) or (mime == 'webp' and image_bytes.startswith(b'RIFF') and image_bytes[8:12] == b'WEBP')
        if not valid_image or len(image_bytes) > 700_000:
            raise HTTPException(422, 'Ảnh không hợp lệ hoặc vượt quá 700 KB')
        user.avatar_data = req.avatar_data
    db.commit()
    db.refresh(user)
    return account_dict(user)

@app.get('/api/dashboard')
def dashboard(user: models.User = Depends(require_role('EMPLOYER')), db: Session = Depends(get_db)):
    now = datetime.utcnow()
    shifts = db.query(models.JobShift).filter(models.JobShift.employer_id == user.id).options(joinedload(models.JobShift.applications)).order_by(models.JobShift.created_at.desc()).limit(6).all()
    all_shifts = db.query(models.JobShift).filter(models.JobShift.employer_id == user.id)
    active_shift = all_shifts.filter(models.JobShift.status == 'OPEN', models.JobShift.end_time > now).order_by(models.JobShift.created_at.desc()).first()
    top_candidates = []
    if active_shift:
        students = db.query(models.Student).options(selectinload(models.Student.schedules)).all()
        for student in students:
            match = match_student_shift(student, active_shift)
            if match['available']:
                top_candidates.append({'id': str(student.user_id), 'name': student.full_name, 'score': match['score'], 'university': student.university, 'shift_id': str(active_shift.id)})
        top_candidates.sort(key=lambda candidate: candidate['score'], reverse=True)
    total_slots = sum(s.required_workers or 1 for s in all_shifts.all())
    accepted = db.query(models.Application).join(models.JobShift).filter(models.JobShift.employer_id == user.id, models.Application.status == 'ACCEPTED').count()
    upcoming = all_shifts.filter(models.JobShift.status != 'DRAFT', models.JobShift.start_time > now).options(joinedload(models.JobShift.applications)).order_by(models.JobShift.start_time).limit(5).all()
    days = [now.date() - timedelta(days=offset) for offset in range(6, -1, -1)]
    applied_at = db.query(models.Application.applied_at).join(models.JobShift).filter(
        models.JobShift.employer_id == user.id,
        models.Application.applied_at >= datetime.combine(days[0], datetime.min.time()),
    ).all()
    applications_by_day = Counter(item.applied_at.date() for item in applied_at)
    return {
        'stats': {
            'open_shifts': all_shifts.filter(models.JobShift.status == 'OPEN').count(),
            'new_applications': db.query(models.Application).join(models.JobShift).filter(models.JobShift.employer_id == user.id, models.Application.status == 'PENDING').count(),
            'upcoming_shifts': all_shifts.filter(models.JobShift.status != 'DRAFT', models.JobShift.start_time > now).count(),
            'fill_rate': round(accepted / total_slots * 100) if total_slots else 0,
        },
        'recent_shifts': [shift_dict(shift) for shift in shifts],
        'top_candidates': top_candidates[:5],
        'activity_7_days': [{'date': day.isoformat(), 'applications': applications_by_day[day]} for day in days],
        'upcoming_schedule': [shift_dict(shift) for shift in upcoming],
    }

@app.get('/api/student/dashboard')
def student_dashboard(user: models.User = Depends(require_role('STUDENT')), db: Session = Depends(get_db)):
    shifts = db.query(models.JobShift).filter(models.JobShift.status == 'OPEN', models.JobShift.start_time > datetime.utcnow()).options(joinedload(models.JobShift.applications)).order_by(models.JobShift.start_time).limit(6).all()
    applications = db.query(models.Application).filter(models.Application.student_id == user.id)
    recommendations = [{**shift_dict(s), 'match_score': match_student_shift(user.student_profile, s)['score']} for s in shifts]
    recommendations = [s for s in recommendations if s['match_score'] > 0]
    recommendations.sort(key=lambda s: s['match_score'], reverse=True)
    return {'stats': {'available_shifts': len(recommendations), 'pending_applications': applications.filter(models.Application.status == 'PENDING').count(), 'accepted_applications': applications.filter(models.Application.status == 'ACCEPTED').count()}, 'recommended_shifts': recommendations}

@app.get('/api/schedules')
def list_schedules(user: models.User = Depends(require_role('STUDENT')), db: Session = Depends(get_db)):
    items = db.query(models.Schedule).filter(models.Schedule.student_id == user.id).order_by(models.Schedule.start_time).all()
    return [schedule_dict(item) for item in items]

@app.post('/api/schedules', status_code=201)
def add_schedule(req: ScheduleInput, user: models.User = Depends(require_role('STUDENT')), db: Session = Depends(get_db)):
    item = schedule_model(req, user.id)
    db.add(item); db.commit(); db.refresh(item)
    return schedule_dict(item)

@app.post('/api/schedules/import')
def import_schedules(req: ScheduleImport, user: models.User = Depends(require_role('STUDENT')), db: Session = Depends(get_db)):
    items = [schedule_model(item, user.id) for item in req.items]
    current = db.query(models.Schedule).filter(models.Schedule.student_id == user.id).all()
    work = [item for item in current if item.source == 'SHIFT']
    for item in items:
        if item.type in {'STUDY', 'BUSY'} and any(shift.start_time < item.end_time and shift.end_time > item.start_time for shift in work):
            raise HTTPException(409, 'Lịch nhập trùng với ca làm đã nhận')
    retained = work if req.replace else current
    known = {(item.title, item.type, item.start_time, item.end_time) for item in retained}
    unique = []
    for item in items:
        key = (item.title, item.type, item.start_time, item.end_time)
        if key not in known:
            known.add(key)
            unique.append(item)
    if req.replace:
        db.query(models.Schedule).filter(models.Schedule.student_id == user.id, models.Schedule.source != 'SHIFT').delete(synchronize_session=False)
    db.add_all(unique); db.commit()
    return {'imported': len(unique), 'skipped': len(items) - len(unique), 'replaced': req.replace}

@app.post('/api/schedules/sync-school')
def sync_school_schedules(req: SchoolSyncRequest, user: models.User = Depends(require_role('STUDENT')), db: Session = Depends(get_db)):
    try:
        events = fetch_school_calendar(req.username, req.password)
    except SchoolCalendarError as exc:
        raise HTTPException(502, str(exc)) from exc
    if not events:
        raise HTTPException(422, 'Không tìm thấy lịch học hợp lệ từ cổng trường')
    db.query(models.Schedule).filter(models.Schedule.student_id == user.id, models.Schedule.source == 'SCHOOL').delete(synchronize_session=False)
    db.add_all(models.Schedule(student_id=user.id, title=event['title'], type='STUDY', source='SCHOOL', start_time=event['start_time'], end_time=event['end_time']) for event in events)
    db.commit()
    return {'synced': len(events)}

@app.delete('/api/schedules/{schedule_id}', status_code=204)
def delete_schedule(schedule_id: uuid.UUID, user: models.User = Depends(require_role('STUDENT')), db: Session = Depends(get_db)):
    item = db.query(models.Schedule).filter(models.Schedule.id == schedule_id, models.Schedule.student_id == user.id).first()
    if not item:
        raise HTTPException(404, 'Không tìm thấy lịch')
    if item.source == 'SHIFT':
        raise HTTPException(409, 'Ca đã nhận không thể xóa khỏi lịch')
    db.delete(item); db.commit()

@app.get('/api/admin/dashboard')
def admin_dashboard(user: models.User = Depends(require_role('ADMIN')), db: Session = Depends(get_db)):
    users = db.query(models.User).order_by(models.User.created_at.desc()).limit(8).all()
    return {'stats': {'users': db.query(models.User).count(), 'students': db.query(models.Student).count(), 'employers': db.query(models.Employer).count(), 'shifts': db.query(models.JobShift).count(), 'applications': db.query(models.Application).count(), 'unverified_employers': db.query(models.Employer).filter(models.Employer.is_verified == False).count()}, 'recent_users': [{'id': str(u.id), 'name': u.student_profile.full_name if u.student_profile else u.employer_profile.company_name if u.employer_profile else u.username or u.email, 'email': u.email, 'role': u.role, 'created_at': u.created_at.isoformat()} for u in users]}

@app.get('/api/admin/users')
def admin_users(user: models.User = Depends(require_role('ADMIN')), db: Session = Depends(get_db)):
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    return [{'id': str(u.id), 'name': u.student_profile.full_name if u.student_profile else u.employer_profile.company_name if u.employer_profile else u.username or u.email, 'username': u.username, 'email': u.email, 'role': u.role, 'created_at': u.created_at.isoformat(), 'is_verified': u.employer_profile.is_verified if u.employer_profile else None} for u in users]

@app.get('/api/admin/shifts')
def admin_shifts(user: models.User = Depends(require_role('ADMIN')), db: Session = Depends(get_db)):
    shifts = db.query(models.JobShift).options(joinedload(models.JobShift.applications)).order_by(models.JobShift.created_at.desc()).all()
    return [{**shift_dict(s), 'company_name': s.employer.company_name} for s in shifts]

@app.get('/api/student/applications')
def student_applications(user: models.User = Depends(require_role('STUDENT')), db: Session = Depends(get_db)):
    applications = db.query(models.Application).filter(models.Application.student_id == user.id).order_by(models.Application.applied_at.desc()).all()
    return [{'id': str(a.id), 'shift_id': str(a.shift_id), 'title': a.shift.title, 'company_name': a.shift.employer.company_name, 'location': a.shift.location, 'start_time': a.shift.start_time.isoformat(), 'status': a.status, 'match_score': a.match_score, 'applied_at': a.applied_at.isoformat()} for a in applications]

@app.get('/api/shifts')
def list_shifts(status_filter: Optional[str] = Query(default=None, alias='status'), user: models.User = Depends(user_or_401), db: Session = Depends(get_db)):
    query = db.query(models.JobShift).options(joinedload(models.JobShift.applications)).order_by(models.JobShift.start_time.asc())
    if user.role == 'EMPLOYER': query = query.filter(models.JobShift.employer_id == user.id)
    elif user.role == 'STUDENT': query = query.filter(models.JobShift.status == 'OPEN')
    elif user.role != 'ADMIN': raise HTTPException(403, 'Tài khoản không có quyền truy cập')
    if status_filter: query = query.filter(models.JobShift.status == status_filter.upper())
    return [shift_dict(s) for s in query.all()]

@app.post('/api/shifts', status_code=201)
def create_shift(req: ShiftCreate, user: models.User = Depends(user_or_401), db: Session = Depends(get_db)):
    if user.role != 'EMPLOYER' or not user.employer_profile: raise HTTPException(403, 'Chỉ doanh nghiệp mới được tạo ca')
    start, end = utc_naive(req.start_time), utc_naive(req.end_time)
    if end <= start: raise HTTPException(422, 'Giờ kết thúc phải sau giờ bắt đầu')
    shift = models.JobShift(employer_id=user.id, title=req.title, description=req.description, location=req.location, start_time=start, end_time=end, hourly_rate=req.hourly_rate, required_workers=req.required_workers, required_skills=','.join(req.required_skills))
    db.add(shift); db.flush()
    students = db.query(models.Student).options(selectinload(models.Student.schedules)).all()
    matched = 0
    for student in students:
        result = match_student_shift(student, shift)
        if result['score'] >= 80:
            matched += 1
            db.add(models.Notification(user_id=student.user_id, shift_id=shift.id, title='Có ca làm phù hợp', body=f'{shift.title} phù hợp {result["score"]}% với hồ sơ và lịch của bạn.', kind='MATCH'))
    db.commit(); db.refresh(shift)
    return {**shift_dict(shift), 'matched_students': matched}

@app.get('/api/shifts/{shift_id}')
def get_shift(shift_id: uuid.UUID, user: models.User = Depends(user_or_401), db: Session = Depends(get_db)):
    shift = db.query(models.JobShift).options(joinedload(models.JobShift.applications), joinedload(models.JobShift.employer)).filter(models.JobShift.id == shift_id).first()
    if not shift:
        raise HTTPException(404, 'Không tìm thấy ca làm')
    if user.role == 'EMPLOYER' and shift.employer_id != user.id:
        raise HTTPException(404, 'Không tìm thấy ca làm')
    if user.role == 'STUDENT':
        own_application = next((application for application in shift.applications if application.student_id == user.id), None)
        if shift.status != 'OPEN' and not own_application:
            raise HTTPException(404, 'Không tìm thấy ca làm')
        match = match_student_shift(user.student_profile, shift)
        if own_application and own_application.status == 'ACCEPTED':
            return {**shift_dict(shift), 'match_score': own_application.match_score, 'match_reasons': own_application.match_reasons.split(', '), 'available': False, 'applied': True}
        return {**shift_dict(shift), 'match_score': match['score'], 'match_reasons': match['reasons'], 'available': match['available'], 'applied': bool(own_application)}
    if user.role not in {'EMPLOYER', 'ADMIN'}:
        raise HTTPException(403, 'Tài khoản không có quyền truy cập')
    return shift_dict(shift)

@app.get('/api/candidates')
def candidates(shift_id: Optional[uuid.UUID] = None, user: models.User = Depends(require_role('EMPLOYER')), db: Session = Depends(get_db)):
    query = db.query(models.JobShift).filter(models.JobShift.employer_id == user.id)
    shift = query.filter(models.JobShift.id == shift_id).first() if shift_id else query.filter(models.JobShift.status == 'OPEN').order_by(models.JobShift.created_at.desc()).first()
    if not shift:
        if shift_id: raise HTTPException(404, 'Không tìm thấy ca làm')
        return []
    students = db.query(models.Student).options(selectinload(models.Student.schedules)).all()
    result = []
    for student in students:
        match = match_student_shift(student, shift)
        if not match['available']:
            continue
        result.append({'id': str(student.user_id), 'name': student.full_name, 'university': student.university, 'major': student.major, 'skills': [x.strip() for x in (student.skills or '').split(',') if x.strip()], 'rating': student.average_rating, 'match_score': match['score'], 'match_reasons': match['reasons']})
    return sorted(result, key=lambda item: item['match_score'], reverse=True)

@app.post('/api/applications', status_code=201)
def apply_shift(req: ApplicationCreate, user: models.User = Depends(user_or_401), db: Session = Depends(get_db)):
    if user.role != 'STUDENT': raise HTTPException(403, 'Chỉ sinh viên mới được ứng tuyển')
    shift = db.query(models.JobShift).filter(models.JobShift.id == req.shift_id).first()
    if not shift: raise HTTPException(404, 'Không tìm thấy ca làm')
    if shift.status != 'OPEN' or shift.start_time <= datetime.utcnow(): raise HTTPException(409, 'Ca làm không còn nhận ứng tuyển')
    if db.query(models.Application).filter_by(student_id=user.id, shift_id=shift.id).first(): raise HTTPException(409, 'Bạn đã ứng tuyển ca này')
    match = match_student_shift(user.student_profile, shift)
    if not match['available']: raise HTTPException(409, 'Ca làm không phù hợp lịch đã khai báo')
    application = models.Application(student_id=user.id, shift_id=shift.id, match_score=match['score'], match_reasons=', '.join(match['reasons']))
    db.add(application); db.add(models.Notification(user_id=shift.employer_id, shift_id=shift.id, title='Ứng viên mới cho ca làm', body=f'{user.student_profile.full_name} vừa ứng tuyển {shift.title}.', kind='APPLICATION')); db.commit()
    return {'message': 'Ứng tuyển thành công', 'application_id': str(application.id), 'match_score': application.match_score}

@app.get('/api/shifts/{shift_id}/applications')
def shift_applications(shift_id: uuid.UUID, user: models.User = Depends(require_role('EMPLOYER')), db: Session = Depends(get_db)):
    shift = db.query(models.JobShift).filter(models.JobShift.id == shift_id, models.JobShift.employer_id == user.id).first()
    if not shift:
        raise HTTPException(404, 'Không tìm thấy ca làm')
    applications = db.query(models.Application).filter(models.Application.shift_id == shift_id).order_by(models.Application.applied_at.desc()).all()
    return [{'id': str(item.id), 'student_id': str(item.student_id), 'name': item.student.full_name, 'university': item.student.university, 'status': item.status, 'match_score': item.match_score, 'applied_at': item.applied_at.replace(tzinfo=timezone.utc).isoformat()} for item in applications]

@app.patch('/api/applications/{application_id}/accept')
def accept_application(application_id: uuid.UUID, user: models.User = Depends(require_role('EMPLOYER')), db: Session = Depends(get_db)):
    application = db.query(models.Application).join(models.JobShift).filter(models.Application.id == application_id, models.JobShift.employer_id == user.id).with_for_update().first()
    if not application:
        raise HTTPException(404, 'Không tìm thấy đơn ứng tuyển')
    if application.status != 'PENDING':
        raise HTTPException(409, 'Đơn ứng tuyển không còn chờ duyệt')
    shift = db.query(models.JobShift).filter(models.JobShift.id == application.shift_id).with_for_update().first()
    if shift.status != 'OPEN' or shift.start_time <= datetime.utcnow():
        raise HTTPException(409, 'Ca làm không còn nhận ứng viên')
    accepted = db.query(models.Application).filter(models.Application.shift_id == shift.id, models.Application.status == 'ACCEPTED').count()
    if accepted >= shift.required_workers:
        raise HTTPException(409, 'Ca làm đã đủ người')
    student = db.query(models.Student).options(selectinload(models.Student.schedules)).filter(models.Student.user_id == application.student_id).first()
    if not match_student_shift(student, shift)['available']:
        raise HTTPException(409, 'Lịch sinh viên đã thay đổi, không thể nhận ca')
    application.status = 'ACCEPTED'
    db.add(models.Schedule(student_id=application.student_id, application_id=application.id, title=f'Ca làm: {shift.title}', type='WORK', source='SHIFT', start_time=shift.start_time, end_time=shift.end_time))
    db.add(models.Notification(user_id=application.student_id, shift_id=shift.id, title='Bạn đã được nhận vào ca làm', body=f'Ca {shift.title} đã được xếp vào lịch của bạn.', kind='APPLICATION'))
    db.commit()
    return {'id': str(application.id), 'status': application.status, 'shift_id': str(shift.id)}

@app.get('/api/notifications')
def notifications(db: Session = Depends(get_db), user: models.User = Depends(user_or_401)):
    query = db.query(models.Notification).filter(models.Notification.user_id == user.id).order_by(models.Notification.created_at.desc()).limit(30)
    return [{'id': str(n.id), 'shift_id': str(n.shift_id) if n.shift_id else None, 'title': n.title, 'body': n.body, 'kind': n.kind, 'is_read': n.is_read, 'created_at': n.created_at.replace(tzinfo=timezone.utc).isoformat()} for n in query.all()]

@app.patch('/api/notifications/read-all')
def read_all_notifications(db: Session = Depends(get_db), user: models.User = Depends(user_or_401)):
    db.query(models.Notification).filter(models.Notification.user_id == user.id).update({'is_read': True}); db.commit(); return {'message': 'Đã đánh dấu tất cả đã đọc'}
