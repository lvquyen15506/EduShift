from collections import Counter
from datetime import datetime, timedelta, timezone
import base64
import binascii
import hashlib
import hmac
import json
import os
import re
import secrets
import uuid
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status, Header
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from sqlalchemy import func, or_, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from .database import Base, engine, get_db
from . import models
from .email_delivery import EmailDeliveryError, send_otp_email
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
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS average_rating FLOAT",
        "ALTER TABLE students ALTER COLUMN average_rating DROP DEFAULT",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS latitude FLOAT",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS longitude FLOAT",
        "ALTER TABLE employers ADD COLUMN IF NOT EXISTS average_rating FLOAT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_data TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP",
        "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS description TEXT",
        "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS location VARCHAR(300)",
        "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS hourly_rate FLOAT",
        "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'OPEN'",
        "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS required_skills TEXT DEFAULT ''",
        "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS required_workers INTEGER DEFAULT 1",
        "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS latitude FLOAT",
        "ALTER TABLE shifts ADD COLUMN IF NOT EXISTS longitude FLOAT",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS match_reasons TEXT DEFAULT ''",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PENDING'",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMP",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS cancellation_reason TEXT",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS cancellation_requested_by VARCHAR(20)",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMP",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS kind VARCHAR(30) DEFAULT 'INFO'",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS template_version INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_attempts INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_next_attempt_at TIMESTAMP",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS shift_id UUID",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_attempts INTEGER DEFAULT 0",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_next_attempt_at TIMESTAMP",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMP",
        "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS title VARCHAR(200)",
        "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'STUDY'",
        "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'MANUAL'",
        "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES applications(id) ON DELETE CASCADE",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_schedules_application_id ON schedules(application_id)",
        "CREATE TABLE IF NOT EXISTS employer_plans (id UUID PRIMARY KEY, code VARCHAR(40) UNIQUE NOT NULL, name VARCHAR(120) NOT NULL, post_limit INTEGER, price INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE IF NOT EXISTS employer_subscriptions (employer_id UUID PRIMARY KEY REFERENCES employers(user_id) ON DELETE CASCADE, plan_id UUID NOT NULL REFERENCES employer_plans(id), posts_used INTEGER NOT NULL DEFAULT 0, started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)",
        "ALTER TABLE employer_subscriptions ADD COLUMN IF NOT EXISTS free_posts_used INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE employer_subscriptions ADD COLUMN IF NOT EXISTS purchased_post_limit INTEGER",
        "ALTER TABLE employer_subscriptions ADD COLUMN IF NOT EXISTS purchased_name VARCHAR(120)",
        "ALTER TABLE employer_subscriptions ADD COLUMN IF NOT EXISTS purchased_price INTEGER",
        "ALTER TABLE employer_subscriptions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP",
        "CREATE TABLE IF NOT EXISTS employer_payments (id UUID PRIMARY KEY, employer_id UUID NOT NULL REFERENCES employers(user_id) ON DELETE CASCADE, plan_id UUID NOT NULL REFERENCES employer_plans(id), amount INTEGER NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'PENDING', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, confirmed_at TIMESTAMP)",
        "ALTER TABLE employer_plans ADD COLUMN IF NOT EXISTS duration_days INTEGER",
        "ALTER TABLE employer_plans ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE employer_payments ADD COLUMN IF NOT EXISTS post_limit INTEGER",
        "ALTER TABLE employer_payments ADD COLUMN IF NOT EXISTS duration_days INTEGER NOT NULL DEFAULT 30",
        "ALTER TABLE employer_payments ADD COLUMN IF NOT EXISTS plan_name VARCHAR(120) NOT NULL DEFAULT ''",
        "ALTER TABLE employer_payments ADD COLUMN IF NOT EXISTS provider_event_id VARCHAR(100) UNIQUE",
        "CREATE TABLE IF NOT EXISTS admin_audit (id UUID PRIMARY KEY, actor_id UUID NOT NULL REFERENCES users(id), action VARCHAR(100) NOT NULL, target_id VARCHAR(100) NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE IF NOT EXISTS notification_policies (kind VARCHAR(30) PRIMARY KEY, title_template VARCHAR(220) NOT NULL DEFAULT '{title}', body_template TEXT NOT NULL DEFAULT '{body}', in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE, email_enabled BOOLEAN NOT NULL DEFAULT FALSE, push_enabled BOOLEAN NOT NULL DEFAULT TRUE, version INTEGER NOT NULL DEFAULT 1, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)",
        "INSERT INTO notification_policies (kind, title_template, body_template, in_app_enabled, email_enabled, push_enabled, version, updated_at) VALUES ('INFO', '{title}', '{body}', TRUE, FALSE, TRUE, 1, CURRENT_TIMESTAMP), ('MATCH', '{title}', '{body}', TRUE, FALSE, TRUE, 1, CURRENT_TIMESTAMP), ('APPLICATION', '{title}', '{body}', TRUE, FALSE, TRUE, 1, CURRENT_TIMESTAMP), ('INVITATION', '{title}', '{body}', TRUE, FALSE, TRUE, 1, CURRENT_TIMESTAMP), ('ATTENDANCE', '{title}', '{body}', TRUE, FALSE, TRUE, 1, CURRENT_TIMESTAMP), ('VERIFICATION', '{title}', '{body}', TRUE, FALSE, TRUE, 1, CURRENT_TIMESTAMP) ON CONFLICT (kind) DO NOTHING",
        "INSERT INTO employer_plans (id, code, name, post_limit, price, description, is_active, created_at) SELECT '00000000-0000-0000-0000-000000000001', 'FREE', 'Miễn phí', 5, 0, '5 lượt đăng ca miễn phí tổng cộng', TRUE, CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM employer_plans WHERE code = 'FREE')",
        "UPDATE employer_plans SET description = '5 lượt đăng ca miễn phí tổng cộng' WHERE code = 'FREE' AND description = ''",
        "INSERT INTO employer_subscriptions (employer_id, plan_id, posts_used, free_posts_used, started_at) SELECT e.user_id, p.id, COUNT(s.id), COUNT(s.id), CURRENT_TIMESTAMP FROM employers e CROSS JOIN employer_plans p LEFT JOIN shifts s ON s.employer_id = e.user_id WHERE p.code = 'FREE' AND NOT EXISTS (SELECT 1 FROM employer_subscriptions q WHERE q.employer_id = e.user_id) GROUP BY e.user_id, p.id",
        "UPDATE employer_subscriptions q SET free_posts_used = GREATEST(q.free_posts_used, COALESCE((SELECT COUNT(*) FROM shifts s WHERE s.employer_id = q.employer_id), 0)) WHERE q.plan_id = (SELECT id FROM employer_plans WHERE code = 'FREE')",
        "UPDATE students SET average_rating = NULL WHERE average_rating = 5 AND NOT EXISTS (SELECT 1 FROM reviews r JOIN applications a ON a.id = r.application_id WHERE a.student_id = students.user_id AND r.reviewer_role = 'EMPLOYER')",
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
cors_origins = [origin.strip() for origin in os.getenv('CORS_ORIGINS', '*').split(',') if origin.strip()]
app.add_middleware(CORSMiddleware, allow_origins=cors_origins, allow_credentials=False,
                   allow_methods=['*'], allow_headers=['*'])

class RegisterRequest(BaseModel):
    username: Optional[str] = None
    email: EmailStr
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

class EmailOtpConfirm(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r'^\d{6}$')

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(EmailOtpConfirm):
    new_password: str = Field(min_length=6)

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
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)

    @field_validator('longitude')
    @classmethod
    def coordinate_pair(cls, value: Optional[float], info):
        if (value is None) != (info.data.get('latitude') is None):
            raise ValueError('Cần nhập đủ vĩ độ và kinh độ')
        return value

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

class InvitationCreate(BaseModel):
    student_id: uuid.UUID

class InvitationResponse(BaseModel):
    accept: bool

class CancellationRequest(BaseModel):
    reason: str = Field(min_length=5, max_length=1000)

class LeaveDecision(BaseModel):
    approve: bool
    reason: Optional[str] = Field(default=None, max_length=1000)

class ShiftStatusUpdate(BaseModel):
    status: str

class EmployerPlanOut(BaseModel):
    code: str
    name: str
    post_limit: Optional[int]
    price: int
    is_active: bool

class PlanInput(BaseModel):
    code: str = Field(min_length=2, max_length=40, pattern=r'^[A-Z0-9_]+$')
    name: str = Field(min_length=2, max_length=120)
    post_limit: int = Field(ge=1, le=100000)
    price: int = Field(ge=1000, le=1000000000)
    duration_days: int = Field(ge=1, le=3650)
    description: str = Field(default='', max_length=2000)
    is_active: bool = True

class PlanUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    post_limit: Optional[int] = Field(default=None, ge=1, le=100000)
    price: Optional[int] = Field(default=None, ge=1000, le=1000000000)
    duration_days: Optional[int] = Field(default=None, ge=1, le=3650)
    description: Optional[str] = Field(default=None, max_length=2000)
    is_active: Optional[bool] = None

class CheckoutInput(BaseModel):
    plan_id: uuid.UUID

class SandboxPaymentInput(BaseModel):
    outcome: str = Field(pattern=r'^(SUCCESS|FAILED|CANCELLED)$')

class PaymentWebhookInput(BaseModel):
    payment_id: uuid.UUID
    outcome: str = Field(pattern=r'^(SUCCESS|FAILED|CANCELLED)$')
    event_id: str = Field(min_length=1, max_length=100)

class AdminUserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8)
    role: str = Field(pattern=r'^(STUDENT|EMPLOYER|ADMIN)$')
    name: str = Field(min_length=2, max_length=200)

class AdminUserUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=80)
    email: Optional[EmailStr] = None
    name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    role: Optional[str] = Field(default=None, pattern=r'^(STUDENT|EMPLOYER|ADMIN)$')
    is_active: Optional[bool] = None

class NotificationPolicyUpdate(BaseModel):
    title_template: Optional[str] = Field(default=None, min_length=1, max_length=220)
    body_template: Optional[str] = Field(default=None, min_length=1, max_length=2000)
    in_app_enabled: Optional[bool] = None
    email_enabled: Optional[bool] = None
    push_enabled: Optional[bool] = None


class VerificationUpdate(BaseModel):
    is_verified: bool

class LocationUpdate(BaseModel):
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)

    @field_validator('longitude')
    @classmethod
    def coordinate_pair(cls, value: Optional[float], info):
        if (value is None) != (info.data.get('latitude') is None):
            raise ValueError('Cần nhập đủ vĩ độ và kinh độ')
        return value

class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default='', max_length=1000)

class PushTokenInput(BaseModel):
    token: str = Field(min_length=20, max_length=250, pattern=r'^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$')
    platform: str = Field(pattern='^(android|ios)$')

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
        return user if user and user.is_active and user.deleted_at is None else None
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
    data = {k: getattr(shift, k) for k in ['id','title','description','location','latitude','longitude','start_time','end_time','hourly_rate','required_workers','status']}
    for key in ('start_time', 'end_time'):
        if data[key] is not None and data[key].tzinfo is None:
            data[key] = data[key].replace(tzinfo=timezone.utc)
    return {**data, 'employer_id': str(shift.employer_id), 'company_name': shift.employer.company_name, 'required_skills': [x for x in (shift.required_skills or '').split(',') if x], 'applicants': len(shift.applications)}

def schedule_dict(item: models.Schedule):
    return {'id': item.id, 'title': item.title, 'type': item.type, 'source': item.source, 'application_id': item.application_id, 'shift_id': item.application.shift_id if item.application else None, 'start_time': item.start_time.replace(tzinfo=timezone.utc), 'end_time': item.end_time.replace(tzinfo=timezone.utc)}

def notification_policy_dict(policy: models.NotificationPolicy):
    return {'kind': policy.kind, 'title_template': policy.title_template,
        'body_template': policy.body_template, 'in_app_enabled': policy.in_app_enabled,
        'email_enabled': policy.email_enabled, 'push_enabled': policy.push_enabled,
        'version': policy.version, 'updated_at': policy.updated_at}

def validate_notification_template(value: str):
    if any(field not in {'{title}', '{body}'} for field in re.findall(r'\{[^{}]*\}', value)):
        raise HTTPException(422, 'Mẫu chỉ được dùng {title} và {body}')
    residue = value.replace('{title}', '').replace('{body}', '')
    if '{' in residue or '}' in residue:
        raise HTTPException(422, 'Dấu ngoặc trong mẫu không hợp lệ')

def build_notification(db: Session, **kwargs):
    kind = kwargs.get('kind') or 'INFO'
    policy = db.query(models.NotificationPolicy).filter_by(kind=kind).first()
    if not policy: return models.Notification(**kwargs)
    title, body = kwargs['title'], kwargs['body']
    kwargs['title'] = policy.title_template.replace('{title}', title).replace('{body}', body)
    kwargs['body'] = policy.body_template.replace('{title}', title).replace('{body}', body)
    kwargs.update(template_version=policy.version, in_app_enabled=policy.in_app_enabled,
                  email_enabled=policy.email_enabled, push_enabled=policy.push_enabled)
    return models.Notification(**kwargs)

def schedule_model(item: ScheduleInput, student_id: uuid.UUID):
    start, end = utc_naive(item.start_time), utc_naive(item.end_time)
    if end <= start:
        raise HTTPException(422, 'Giờ kết thúc phải sau giờ bắt đầu')
    return models.Schedule(student_id=student_id, title=item.title, type=item.type, start_time=start, end_time=end)

@app.get('/api/health')
def health():
    return {'status': 'ok', 'service': 'edushift-api'}

def otp_digest(email: str, purpose: str, code: str) -> str:
    value = f'{purpose}:{email}:{code}'.encode()
    return hmac.new(SECRET_KEY.encode(), value, hashlib.sha256).hexdigest()


def issue_email_otp(db: Session, email: str, purpose: str, payload: Optional[dict] = None) -> None:
    now = datetime.utcnow()
    item = db.query(models.EmailOtp).filter_by(email=email, purpose=purpose).with_for_update().first()
    if item and item.requested_at > now - timedelta(seconds=60):
        raise HTTPException(429, 'Vui lòng chờ 60 giây trước khi gửi lại mã')
    code = f'{secrets.randbelow(1_000_000):06d}'
    if not item:
        item = models.EmailOtp(email=email, purpose=purpose)
        db.add(item)
    item.code_hash = otp_digest(email, purpose, code)
    item.payload = json.dumps(payload, ensure_ascii=False) if payload else None
    item.expires_at = now + timedelta(minutes=10)
    item.requested_at = now
    item.attempts = 0
    db.flush()
    try:
        send_otp_email(email, code, purpose)
    except EmailDeliveryError as exc:
        db.rollback()
        raise HTTPException(503, str(exc)) from exc
    db.commit()


def verified_email_otp(db: Session, email: str, purpose: str, code: str) -> models.EmailOtp:
    item = db.query(models.EmailOtp).filter_by(email=email, purpose=purpose).with_for_update().first()
    if not item:
        raise HTTPException(400, 'Mã OTP không hợp lệ hoặc đã hết hạn')
    if item.expires_at <= datetime.utcnow():
        db.delete(item)
        db.commit()
        raise HTTPException(400, 'Mã OTP không hợp lệ hoặc đã hết hạn')
    if not hmac.compare_digest(item.code_hash, otp_digest(email, purpose, code)):
        item.attempts += 1
        locked = item.attempts >= 5
        if locked:
            db.delete(item)
        db.commit()
        raise HTTPException(429 if locked else 400, 'Mã OTP không hợp lệ hoặc đã hết hạn')
    return item


@app.post('/api/auth/register', status_code=202)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    role = req.role.upper()
    email = str(req.email).strip().lower()
    if role not in {'STUDENT', 'EMPLOYER'}:
        raise HTTPException(400, 'Role phải là STUDENT hoặc EMPLOYER')
    if role == 'STUDENT' and (not req.username or not req.full_name):
        raise HTTPException(422, 'Sinh viên cần username và full_name')
    if role == 'EMPLOYER' and not req.company_name:
        raise HTTPException(422, 'Doanh nghiệp cần company_name')
    if req.username and db.query(models.User).filter(models.User.username == req.username).first():
        raise HTTPException(409, 'Username đã tồn tại')
    if db.query(models.User).filter(func.lower(models.User.email) == email).first():
        raise HTTPException(409, 'Email đã tồn tại')
    payload = req.model_dump(mode='json', exclude={'password'})
    payload['role'] = role
    payload['email'] = email
    payload['password_hash'] = pwd_context.hash(req.password)
    issue_email_otp(db, email, 'REGISTER', payload)
    return {'message': 'Đã gửi mã OTP đến email. Mã có hiệu lực trong 10 phút.'}


@app.post('/api/auth/register/verify', status_code=201)
def verify_registration(req: EmailOtpConfirm, db: Session = Depends(get_db)):
    email = str(req.email).strip().lower()
    item = verified_email_otp(db, email, 'REGISTER', req.code)
    payload = json.loads(item.payload or '{}')
    username = payload.get('username')
    if (username and db.query(models.User).filter(models.User.username == username).first()
            or db.query(models.User).filter(func.lower(models.User.email) == email).first()):
        raise HTTPException(409, 'Tài khoản đã tồn tại')
    user = models.User(username=username, email=email, password_hash=payload['password_hash'], role=payload['role'])
    try:
        db.add(user)
        db.flush()
        if user.role == 'STUDENT':
            db.add(models.Student(user_id=user.id, full_name=payload['full_name'], phone=payload.get('phone'),
                                  university=payload.get('university'), major=payload.get('major')))
        else:
            db.add(models.Employer(user_id=user.id, company_name=payload['company_name'],
                                   phone=payload.get('phone'), address=payload.get('address')))
        db.delete(item)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, 'Tài khoản đã tồn tại') from exc
    return {'message': 'Đăng ký thành công', 'user_id': str(user.id), 'role': user.role,
            'access_token': create_token(user), 'token_type': 'bearer'}


@app.post('/api/auth/password-reset/request', status_code=202)
def request_password_reset(req: PasswordResetRequest, db: Session = Depends(get_db)):
    email = str(req.email).strip().lower()
    message = {'message': 'Nếu email có tài khoản, mã OTP đã được gửi.'}
    if not db.query(models.User).filter(func.lower(models.User.email) == email).first():
        return message
    recent = db.query(models.EmailOtp).filter_by(email=email, purpose='RESET').first()
    if recent and recent.requested_at > datetime.utcnow() - timedelta(seconds=60):
        return message
    issue_email_otp(db, email, 'RESET')
    return message


@app.post('/api/auth/password-reset/confirm')
def confirm_password_reset(req: PasswordResetConfirm, db: Session = Depends(get_db)):
    email = str(req.email).strip().lower()
    item = verified_email_otp(db, email, 'RESET', req.code)
    user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
    if not user:
        db.delete(item)
        db.commit()
        raise HTTPException(400, 'Mã OTP không hợp lệ hoặc đã hết hạn')
    user.password_hash = pwd_context.hash(req.new_password)
    db.delete(item)
    db.commit()
    return {'message': 'Đã đổi mật khẩu. Bạn có thể đăng nhập.'}


@app.post('/api/auth/login')
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(or_(models.User.email == req.identifier, models.User.username == req.identifier)).first()
    if not user or not user.is_active or user.deleted_at is not None or not pwd_context.verify(req.password, user.password_hash):
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
def admin_users(q: Optional[str] = None, role: Optional[str] = None, user: models.User = Depends(require_role('ADMIN')), db: Session = Depends(get_db)):
    query = db.query(models.User)
    if q:
        term = '%' + q.strip()[:100] + '%'
        query = query.filter(or_(models.User.username.ilike(term), models.User.email.ilike(term)))
    if role:
        if role not in {'ADMIN', 'STUDENT', 'EMPLOYER'}: raise HTTPException(422, 'Vai trò không hợp lệ')
        query = query.filter(models.User.role == role)
    return [admin_user_dict(u) for u in query.order_by(models.User.created_at.desc()).limit(500).all()]

def admin_user_dict(u: models.User):
    return {'id': str(u.id), 'name': u.student_profile.full_name if u.student_profile else u.employer_profile.company_name if u.employer_profile else u.username or u.email,
        'username': u.username, 'email': u.email, 'role': u.role, 'created_at': u.created_at.isoformat(),
        'is_verified': u.employer_profile.is_verified if u.employer_profile else None,
        'is_active': u.is_active, 'deleted_at': u.deleted_at}

def audit_admin(db: Session, actor_id: uuid.UUID, action: str, target_id: uuid.UUID, detail: dict):
    db.add(models.AdminAudit(actor_id=actor_id, action=action, target_id=str(target_id), detail=json.dumps(detail, ensure_ascii=False, default=str)))

def ensure_admin_remains(db: Session, target: models.User):
    if target.role == 'ADMIN' and target.is_active and target.deleted_at is None:
        db.execute(text('SELECT pg_advisory_xact_lock(8829101)'))
        active_count = db.query(models.User).filter_by(role='ADMIN', is_active=True, deleted_at=None).count()
        if active_count <= 1: raise HTTPException(409, 'Không thể vô hiệu hóa admin cuối cùng')

@app.post('/api/admin/users', status_code=201)
def admin_create_user(req: AdminUserCreate, actor: models.User = Depends(require_role('ADMIN')), db: Session = Depends(get_db)):
    u = models.User(username=req.username, email=str(req.email).lower(), password_hash=pwd_context.hash(req.password), role=req.role)
    try:
        db.add(u); db.flush()
        if req.role == 'STUDENT': db.add(models.Student(user_id=u.id, full_name=req.name))
        elif req.role == 'EMPLOYER': db.add(models.Employer(user_id=u.id, company_name=req.name, is_verified=False))
        audit_admin(db, actor.id, 'USER_CREATE', u.id, {'role': req.role})
        db.commit(); db.refresh(u)
    except IntegrityError:
        db.rollback(); raise HTTPException(409, 'Username hoặc email đã tồn tại')
    return admin_user_dict(u)

@app.get('/api/admin/users/{target_id}')
def admin_get_user(target_id: uuid.UUID, actor: models.User = Depends(require_role('ADMIN')), db: Session = Depends(get_db)):
    u = db.query(models.User).filter_by(id=target_id).first()
    if not u: raise HTTPException(404, 'Không tìm thấy tài khoản')
    return admin_user_dict(u)

@app.patch('/api/admin/users/{target_id}')
def admin_update_user(target_id: uuid.UUID, req: AdminUserUpdate, actor: models.User = Depends(require_role('ADMIN')), db: Session = Depends(get_db)):
    u = db.query(models.User).filter_by(id=target_id).with_for_update().first()
    if not u: raise HTTPException(404, 'Không tìm thấy tài khoản')
    if u.deleted_at is not None: raise HTTPException(409, 'Tài khoản đã xóa mềm')
    changes = req.model_dump(exclude_unset=True)
    role_changed = 'role' in changes and changes['role'] != u.role
    if role_changed:
        if u.role == 'ADMIN': ensure_admin_remains(db, u)
        if u.student_profile and (u.student_profile.applications or u.student_profile.schedules):
            raise HTTPException(409, 'Tài khoản có lịch sử, không thể đổi vai trò')
        if u.employer_profile and (u.employer_profile.shifts or db.query(models.EmployerPayment).filter_by(employer_id=u.id).first()):
            raise HTTPException(409, 'Tài khoản có lịch sử, không thể đổi vai trò')
        if u.student_profile: db.delete(u.student_profile)
        if u.employer_profile: db.delete(u.employer_profile)
        db.flush()
        u.role = changes['role']
        if u.role == 'STUDENT': db.add(models.Student(user_id=u.id, full_name=changes.get('name') or u.username))
        elif u.role == 'EMPLOYER': db.add(models.Employer(user_id=u.id, company_name=changes.get('name') or u.username))
    if changes.get('is_active') is False and u.is_active:
        if u.id == actor.id: raise HTTPException(409, 'Không thể tự vô hiệu hóa tài khoản')
        if u.role == 'ADMIN': ensure_admin_remains(db, u)
    for field in ('username', 'email', 'is_active'):
        if field in changes:
            if changes[field] is None: raise HTTPException(422, 'Không thể đặt giá trị rỗng')
            setattr(u, field, str(changes[field]).lower() if field == 'email' else changes[field])
    if changes.get('name') and not role_changed:
        if u.student_profile: u.student_profile.full_name = changes['name']
        elif u.employer_profile: u.employer_profile.company_name = changes['name']
    audit_admin(db, actor.id, 'USER_UPDATE', u.id, {k: v for k, v in changes.items() if k != 'password'})
    try: db.commit(); db.refresh(u)
    except IntegrityError: db.rollback(); raise HTTPException(409, 'Username hoặc email đã tồn tại')
    return admin_user_dict(u)

@app.delete('/api/admin/users/{target_id}')
def admin_delete_user(target_id: uuid.UUID, actor: models.User = Depends(require_role('ADMIN')), db: Session = Depends(get_db)):
    u = db.query(models.User).filter_by(id=target_id).with_for_update().first()
    if not u: raise HTTPException(404, 'Không tìm thấy tài khoản')
    if u.id == actor.id: raise HTTPException(409, 'Không thể tự xóa tài khoản')
    if u.role == 'ADMIN' and u.is_active and u.deleted_at is None: ensure_admin_remains(db, u)
    u.deleted_at = datetime.utcnow(); u.is_active = False
    audit_admin(db, actor.id, 'USER_SOFT_DELETE', u.id, {})
    db.commit()
    return {'id': str(u.id), 'deleted_at': u.deleted_at}

@app.get('/api/admin/notification-policies')
def admin_notification_policies(actor: models.User = Depends(require_role('ADMIN')), db: Session = Depends(get_db)):
    return [notification_policy_dict(p) for p in db.query(models.NotificationPolicy).order_by(models.NotificationPolicy.kind).all()]

@app.patch('/api/admin/notification-policies/{kind}')
def update_notification_policy(kind: str, req: NotificationPolicyUpdate,
        actor: models.User = Depends(require_role('ADMIN')), db: Session = Depends(get_db)):
    policy = db.query(models.NotificationPolicy).filter_by(kind=kind).with_for_update().first()
    if not policy: raise HTTPException(404, 'Không tìm thấy loại thông báo')
    changes = req.model_dump(exclude_unset=True)
    for key, value in changes.items():
        if value is None: raise HTTPException(422, 'Giá trị rỗng không hợp lệ')
        if key.endswith('_template'): validate_notification_template(value)
        setattr(policy, key, value)
    policy.version += 1
    policy.updated_at = datetime.utcnow()
    audit_admin(db, actor.id, 'NOTIFICATION_POLICY_UPDATE', actor.id,
                {'kind': kind, 'version': policy.version, 'changes': changes})
    db.commit(); db.refresh(policy)
    return notification_policy_dict(policy)

@app.get('/api/admin/notification-policies/{kind}/preview')
def preview_notification_policy(kind: str, actor: models.User = Depends(require_role('ADMIN')), db: Session = Depends(get_db)):
    policy = db.query(models.NotificationPolicy).filter_by(kind=kind).first()
    if not policy: raise HTTPException(404, 'Không tìm thấy loại thông báo')
    title, body = 'EduShift có cập nhật', 'Mở ứng dụng để xem thông báo.'
    return {'title': policy.title_template.replace('{title}', title).replace('{body}', body),
            'body': policy.body_template.replace('{title}', title).replace('{body}', body)}

@app.get('/api/admin/shifts')
def admin_shifts(user: models.User = Depends(require_role('ADMIN')), db: Session = Depends(get_db)):
    shifts = db.query(models.JobShift).options(joinedload(models.JobShift.applications)).order_by(models.JobShift.created_at.desc()).all()
    return [{**shift_dict(s), 'company_name': s.employer.company_name} for s in shifts]

@app.patch('/api/admin/employers/{employer_id}/verify')
def verify_employer(employer_id: uuid.UUID, req: VerificationUpdate, user: models.User = Depends(require_role('ADMIN')), db: Session = Depends(get_db)):
    employer = db.query(models.Employer).filter(models.Employer.user_id == employer_id).first()
    if not employer:
        raise HTTPException(404, 'Không tìm thấy doanh nghiệp')
    employer.is_verified = req.is_verified
    db.add(build_notification(db, user_id=employer_id, title='Trạng thái xác minh doanh nghiệp', body='Doanh nghiệp đã được xác minh.' if req.is_verified else 'Trạng thái xác minh doanh nghiệp đã bị thu hồi.', kind='VERIFICATION'))
    db.commit()
    return {'id': str(employer_id), 'is_verified': employer.is_verified}

@app.get('/api/student/applications')
def student_applications(user: models.User = Depends(require_role('STUDENT')), db: Session = Depends(get_db)):
    applications = db.query(models.Application).filter(models.Application.student_id == user.id).order_by(models.Application.applied_at.desc()).all()
    return [{'id': str(a.id), 'shift_id': str(a.shift_id), 'title': a.shift.title, 'company_id': str(a.shift.employer_id), 'company_name': a.shift.employer.company_name, 'location': a.shift.location, 'start_time': a.shift.start_time.isoformat(), 'end_time': a.shift.end_time.isoformat(), 'status': a.status, 'match_score': a.match_score, 'applied_at': a.applied_at.isoformat(), 'checked_in_at': a.checked_in_at, 'checked_out_at': a.checked_out_at, 'completed_at': a.completed_at, 'cancellation_reason': a.cancellation_reason, 'cancellation_requested_by': a.cancellation_requested_by} for a in applications]

@app.get('/api/students/{student_id}/profile')
def student_public_profile(student_id: uuid.UUID, user: models.User = Depends(require_role('EMPLOYER')), db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.user_id == student_id).first()
    if not student: raise HTTPException(404, 'Không tìm thấy hồ sơ sinh viên')
    applications = db.query(models.Application).filter(models.Application.student_id == student_id).order_by(models.Application.applied_at.desc()).all()
    reviews = db.query(models.Review).join(models.Application).filter(models.Application.student_id == student_id, models.Review.reviewer_role == 'EMPLOYER').order_by(models.Review.created_at.desc()).all()
    return {'id': str(student.user_id), 'name': student.full_name, 'university': student.university, 'major': student.major, 'skills': [x.strip() for x in (student.skills or '').split(',') if x.strip()], 'rating': student.average_rating, 'history': [{'id': str(a.id), 'shift_id': str(a.shift_id), 'title': a.shift.title, 'company_name': a.shift.employer.company_name, 'status': a.status, 'start_time': a.shift.start_time.isoformat()} for a in applications], 'reviews': [{'rating': r.rating, 'comment': r.comment, 'created_at': r.created_at.isoformat(), 'shift_title': next((a.shift.title for a in applications if a.id == r.application_id), '')} for r in reviews]}

@app.get('/api/employers/{employer_id}/profile')
def employer_public_profile(employer_id: uuid.UUID, user: models.User = Depends(require_role('STUDENT')), db: Session = Depends(get_db)):
    employer = db.query(models.Employer).filter(models.Employer.user_id == employer_id).first()
    if not employer: raise HTTPException(404, 'Không tìm thấy hồ sơ doanh nghiệp')
    shifts = db.query(models.JobShift).filter(models.JobShift.employer_id == employer_id).order_by(models.JobShift.start_time.desc()).all()
    reviews = db.query(models.Review).join(models.Application).join(models.JobShift).filter(models.JobShift.employer_id == employer_id, models.Review.reviewer_role == 'STUDENT').order_by(models.Review.created_at.desc()).all()
    return {'id': str(employer.user_id), 'name': employer.company_name, 'address': employer.address, 'phone': employer.phone, 'verified': employer.is_verified, 'rating': employer.average_rating, 'history': [{'id': str(s.id), 'title': s.title, 'location': s.location, 'status': s.status, 'start_time': s.start_time.isoformat()} for s in shifts], 'reviews': [{'rating': r.rating, 'comment': r.comment, 'created_at': r.created_at.isoformat()} for r in reviews]}

@app.put('/api/student/location')
def update_student_location(req: LocationUpdate, user: models.User = Depends(require_role('STUDENT')), db: Session = Depends(get_db)):
    user.student_profile.latitude = req.latitude
    user.student_profile.longitude = req.longitude
    db.commit()
    return {'latitude': req.latitude, 'longitude': req.longitude}

@app.get('/api/employer/plan')
def employer_plan(user: models.User = Depends(require_role('EMPLOYER')), db: Session = Depends(get_db)):
    subscription = db.query(models.EmployerSubscription).filter(models.EmployerSubscription.employer_id == user.id).first()
    if not subscription:
        free_plan = db.query(models.EmployerPlan).filter(models.EmployerPlan.code == 'FREE').first()
        if not free_plan:
            raise HTTPException(503, 'Chưa cấu hình gói đăng ca')
        subscription = models.EmployerSubscription(employer_id=user.id, plan_id=free_plan.id, posts_used=0, free_posts_used=0)
        db.add(subscription); db.commit(); db.refresh(subscription)
    plan = db.query(models.EmployerPlan).filter(models.EmployerPlan.id == subscription.plan_id).first()
    expired = subscription.expires_at is not None and subscription.expires_at <= datetime.utcnow()
    if expired:
        plan = db.query(models.EmployerPlan).filter_by(code='FREE').one()
    used = subscription.free_posts_used if expired else subscription.posts_used
    limit = subscription.purchased_post_limit if plan.code != 'FREE' else plan.post_limit
    remaining = None if limit is None else max(limit - used, 0)
    return {'plan': {'code': plan.code, 'name': subscription.purchased_name if plan.code != 'FREE' and subscription.purchased_name else plan.name, 'post_limit': limit, 'price': subscription.purchased_price if plan.code != 'FREE' and subscription.purchased_price is not None else plan.price, 'is_active': plan.is_active}, 'posts_used': used, 'posts_remaining': remaining, 'free_posts_used': subscription.free_posts_used, 'expires_at': None if expired else subscription.expires_at}

def plan_dict(plan: models.EmployerPlan):
    return {'id': str(plan.id), 'code': plan.code, 'name': plan.name,
            'post_limit': plan.post_limit, 'price': plan.price,
            'duration_days': plan.duration_days, 'description': plan.description,
            'is_active': plan.is_active}

@app.get('/api/plans')
def public_plans(db: Session = Depends(get_db)):
    return [plan_dict(p) for p in db.query(models.EmployerPlan).filter_by(is_active=True).order_by(models.EmployerPlan.price).all()]

@app.get('/api/payments/config')
def payment_config():
    return {'available': os.getenv('PAYMENTS_MODE', 'disabled') == 'sandbox', 'mode': os.getenv('PAYMENTS_MODE', 'disabled')}

@app.get('/api/admin/plans')
def admin_plans(user: models.User = Depends(require_role('ADMIN')), db: Session = Depends(get_db)):
    return [plan_dict(p) for p in db.query(models.EmployerPlan).order_by(models.EmployerPlan.price).all()]

@app.post('/api/admin/plans', status_code=201)
def create_plan(req: PlanInput, user: models.User = Depends(require_role('ADMIN')), db: Session = Depends(get_db)):
    if req.code == 'FREE':
        raise HTTPException(409, 'Không thể thay đổi gói Free cố định')
    plan = models.EmployerPlan(**req.model_dump())
    try:
        db.add(plan); db.flush()
        db.add(models.AdminAudit(actor_id=user.id, action='PLAN_CREATE', target_id=str(plan.id), detail=json.dumps(req.model_dump(), ensure_ascii=False)))
        db.commit(); db.refresh(plan)
    except IntegrityError:
        db.rollback(); raise HTTPException(409, 'Mã gói đã tồn tại')
    return plan_dict(plan)

@app.patch('/api/admin/plans/{plan_id}')
def update_plan(plan_id: uuid.UUID, req: PlanUpdate, user: models.User = Depends(require_role('ADMIN')), db: Session = Depends(get_db)):
    plan = db.query(models.EmployerPlan).filter_by(id=plan_id).with_for_update().first()
    if not plan: raise HTTPException(404, 'Không tìm thấy gói')
    if plan.code == 'FREE': raise HTTPException(409, 'Không thể sửa gói Free cố định')
    changes = req.model_dump(exclude_unset=True)
    for key, value in changes.items():
        if value is None: raise HTTPException(422, 'Không thể đặt giá trị rỗng')
        setattr(plan, key, value)
    db.add(models.AdminAudit(actor_id=user.id, action='PLAN_UPDATE', target_id=str(plan.id), detail=json.dumps(changes, ensure_ascii=False)))
    db.commit(); db.refresh(plan)
    return plan_dict(plan)

@app.post('/api/employer/checkout', status_code=201)
def create_checkout(req: CheckoutInput, user: models.User = Depends(require_role('EMPLOYER')), db: Session = Depends(get_db)):
    if os.getenv('PAYMENTS_MODE', 'disabled') != 'sandbox':
        raise HTTPException(503, 'Thanh toán chưa được cấu hình')
    plan = db.query(models.EmployerPlan).filter_by(id=req.plan_id, is_active=True).first()
    if not plan or plan.code == 'FREE' or not plan.duration_days:
        raise HTTPException(404, 'Gói không còn được bán')
    db.query(models.Employer).filter_by(user_id=user.id).with_for_update().one()
    subscription = db.query(models.EmployerSubscription).filter_by(employer_id=user.id).first()
    if not subscription:
        free_plan = db.query(models.EmployerPlan).filter_by(code='FREE').one()
        used = db.query(func.count(models.JobShift.id)).filter_by(employer_id=user.id).scalar() or 0
        db.add(models.EmployerSubscription(employer_id=user.id, plan_id=free_plan.id,
            posts_used=used, free_posts_used=used))
    payment = models.EmployerPayment(employer_id=user.id, plan_id=plan.id,
        amount=plan.price, post_limit=plan.post_limit, duration_days=plan.duration_days,
        plan_name=plan.name, status='PENDING')
    db.add(payment); db.commit(); db.refresh(payment)
    return {'id': str(payment.id), 'amount': payment.amount, 'status': payment.status,
            'checkout_url': '/checkout/' + str(payment.id)}

def settle_payment(db: Session, payment_id: uuid.UUID, outcome: str, event_id: str):
    payment = db.query(models.EmployerPayment).filter_by(id=payment_id).with_for_update().first()
    if not payment: raise HTTPException(404, 'Không tìm thấy giao dịch')
    if payment.status != 'PENDING':
        return {'id': str(payment.id), 'status': payment.status}
    if outcome == 'SUCCESS':
        subscription = db.query(models.EmployerSubscription).filter_by(employer_id=payment.employer_id).with_for_update().first()
        if not subscription: raise HTTPException(409, 'Không tìm thấy thuê bao doanh nghiệp')
        renewing = (subscription.plan_id == payment.plan_id and subscription.expires_at is not None
                    and subscription.expires_at > datetime.utcnow())
        subscription.plan_id = payment.plan_id
        if renewing:
            subscription.purchased_post_limit = (subscription.purchased_post_limit or 0) + (payment.post_limit or 0)
        else:
            subscription.posts_used = 0
            subscription.purchased_post_limit = payment.post_limit
        subscription.purchased_name = payment.plan_name
        subscription.purchased_price = payment.amount
        if not renewing:
            subscription.started_at = datetime.utcnow()
        subscription.expires_at = (subscription.expires_at if renewing else subscription.started_at) + timedelta(days=payment.duration_days)
    payment.status = outcome
    payment.provider_event_id = event_id
    payment.confirmed_at = datetime.utcnow()
    db.commit()
    return {'id': str(payment.id), 'status': payment.status}

@app.post('/api/payments/sandbox/{payment_id}')
def sandbox_payment(payment_id: uuid.UUID, req: SandboxPaymentInput,
                    user: models.User = Depends(require_role('EMPLOYER')), db: Session = Depends(get_db)):
    if os.getenv('PAYMENTS_MODE', 'disabled') != 'sandbox': raise HTTPException(404, 'Sandbox không bật')
    payment = db.query(models.EmployerPayment).filter_by(id=payment_id, employer_id=user.id).first()
    if not payment: raise HTTPException(404, 'Không tìm thấy giao dịch')
    return settle_payment(db, payment_id, req.outcome, 'sandbox:' + str(payment_id))

@app.post('/api/payments/webhook')
async def payment_webhook(req: Request, db: Session = Depends(get_db)):
    secret = os.getenv('PAYMENT_WEBHOOK_SECRET', '')
    if os.getenv('PAYMENTS_MODE', 'disabled') != 'sandbox' or not secret:
        raise HTTPException(503, 'Webhook chưa được cấu hình')
    body = await req.body()
    supplied = req.headers.get('x-edushift-signature', '')
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(supplied, expected):
        raise HTTPException(401, 'Chữ ký không hợp lệ')
    event = PaymentWebhookInput.model_validate_json(body)
    return settle_payment(db, event.payment_id, event.outcome, event.event_id)

@app.get('/api/employer/payments')
def employer_payments(user: models.User = Depends(require_role('EMPLOYER')), db: Session = Depends(get_db)):
    rows = db.query(models.EmployerPayment).filter_by(employer_id=user.id).order_by(models.EmployerPayment.created_at.desc()).all()
    return [{'id': str(p.id), 'plan_name': p.plan_name, 'amount': p.amount,
             'post_limit': p.post_limit, 'duration_days': p.duration_days,
             'status': p.status, 'created_at': p.created_at} for p in rows]

@app.get('/api/employer/payments/{payment_id}')
def employer_payment(payment_id: uuid.UUID, user: models.User = Depends(require_role('EMPLOYER')), db: Session = Depends(get_db)):
    p = db.query(models.EmployerPayment).filter_by(id=payment_id, employer_id=user.id).first()
    if not p: raise HTTPException(404, 'Không tìm thấy giao dịch')
    return {'id': str(p.id), 'plan_name': p.plan_name, 'amount': p.amount,
            'post_limit': p.post_limit, 'duration_days': p.duration_days,
            'status': p.status, 'created_at': p.created_at}

@app.get('/api/shifts')
def list_shifts(status_filter: Optional[str] = Query(default=None, alias='status'), user: models.User = Depends(user_or_401), db: Session = Depends(get_db)):
    query = db.query(models.JobShift).options(joinedload(models.JobShift.applications)).order_by(models.JobShift.start_time.asc())
    if user.role == 'EMPLOYER': query = query.filter(models.JobShift.employer_id == user.id)
    elif user.role == 'STUDENT': query = query.filter(models.JobShift.status == 'OPEN')
    elif user.role != 'ADMIN': raise HTTPException(403, 'Tài khoản không có quyền truy cập')
    if status_filter: query = query.filter(models.JobShift.status == status_filter.upper())
    return [shift_dict(s) for s in query.all()]

@app.get('/api/public/shifts')
def public_shifts(
    limit: int = Query(default=6, ge=1, le=24),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """Return the safe, public subset of currently recruitable shifts."""
    now = datetime.utcnow()
    query = (
        db.query(models.JobShift)
        .join(models.JobShift.employer)
        .options(joinedload(models.JobShift.employer), joinedload(models.JobShift.applications))
        .filter(
            models.JobShift.status == 'OPEN',
            models.JobShift.start_time > now,
            models.Employer.is_verified.is_(True),
        )
        .order_by(models.JobShift.start_time.asc(), models.JobShift.created_at.desc())
    )
    total = query.count()
    shifts = query.offset(offset).limit(limit).all()
    items = []
    for shift in shifts:
        accepted = sum(1 for application in shift.applications if application.status == 'ACCEPTED')
        remaining = max(shift.required_workers - accepted, 0)
        items.append({
            'id': shift.id,
            'title': shift.title,
            'company_name': shift.employer.company_name,
            'location': shift.location,
            'start_time': shift.start_time.replace(tzinfo=timezone.utc),
            'end_time': shift.end_time.replace(tzinfo=timezone.utc),
            'hourly_rate': shift.hourly_rate,
            'latitude': shift.latitude,
            'longitude': shift.longitude,
            'required_workers': shift.required_workers,
            'remaining_workers': remaining,
        })
    return {'items': items, 'total': total, 'limit': limit, 'offset': offset}

@app.post('/api/shifts', status_code=201)
def create_shift(req: ShiftCreate, user: models.User = Depends(user_or_401), db: Session = Depends(get_db)):
    if user.role != 'EMPLOYER' or not user.employer_profile: raise HTTPException(403, 'Chỉ doanh nghiệp mới được tạo ca')
    if not user.employer_profile.is_verified: raise HTTPException(403, 'Doanh nghiệp cần được xác minh trước khi đăng ca')
    # Lock the employer even when its subscription row does not exist yet.
    db.query(models.Employer).filter(models.Employer.user_id == user.id).with_for_update().one()
    subscription = db.query(models.EmployerSubscription).filter(models.EmployerSubscription.employer_id == user.id).with_for_update().first()
    if not subscription:
        free_plan = db.query(models.EmployerPlan).filter(models.EmployerPlan.code == 'FREE', models.EmployerPlan.is_active.is_(True)).first()
        if not free_plan:
            raise HTTPException(503, 'Chưa cấu hình gói đăng ca miễn phí')
        existing = db.query(func.count(models.JobShift.id)).filter(models.JobShift.employer_id == user.id).scalar() or 0
        subscription = models.EmployerSubscription(employer_id=user.id, plan_id=free_plan.id, posts_used=existing, free_posts_used=existing)
        db.add(subscription)
        db.flush()
    plan = db.query(models.EmployerPlan).filter(models.EmployerPlan.id == subscription.plan_id).first()
    if not plan:
        raise HTTPException(403, 'Gói đăng ca hiện không khả dụng')
    if subscription.expires_at is not None and subscription.expires_at <= datetime.utcnow():
        free_plan = db.query(models.EmployerPlan).filter_by(code='FREE').one()
        subscription.plan_id = free_plan.id
        subscription.posts_used = subscription.free_posts_used
        subscription.purchased_post_limit = None
        subscription.purchased_name = None
        subscription.purchased_price = None
        subscription.expires_at = None
        plan = free_plan
    limit = subscription.purchased_post_limit if plan.code != 'FREE' else plan.post_limit
    if limit is not None and subscription.posts_used >= limit:
        raise HTTPException(402, 'Bạn đã dùng hết lượt đăng ca của gói hiện tại. Vui lòng mua gói mới.')
    start, end = utc_naive(req.start_time), utc_naive(req.end_time)
    if end <= start: raise HTTPException(422, 'Giờ kết thúc phải sau giờ bắt đầu')
    shift = models.JobShift(employer_id=user.id, title=req.title, description=req.description, location=req.location, start_time=start, end_time=end, hourly_rate=req.hourly_rate, required_workers=req.required_workers, required_skills=','.join(req.required_skills), latitude=req.latitude, longitude=req.longitude)
    db.add(shift); db.flush()
    subscription.posts_used += 1
    if plan.code == 'FREE':
        subscription.free_posts_used += 1
    students = db.query(models.Student).options(selectinload(models.Student.schedules)).all()
    matched = 0
    for student in students:
        result = match_student_shift(student, shift)
        if result['score'] >= 80:
            matched += 1
            db.add(build_notification(db, user_id=student.user_id, shift_id=shift.id, title='Có ca làm phù hợp', body=f'{shift.title} phù hợp {result["score"]}% với hồ sơ và lịch của bạn.', kind='MATCH'))
    db.commit(); db.refresh(shift)
    return {**shift_dict(shift), 'matched_students': matched}

@app.patch('/api/shifts/{shift_id}/status')
def update_shift_status(shift_id: uuid.UUID, req: ShiftStatusUpdate, user: models.User = Depends(require_role('EMPLOYER')), db: Session = Depends(get_db)):
    shift = db.query(models.JobShift).filter(models.JobShift.id == shift_id, models.JobShift.employer_id == user.id).with_for_update().first()
    if not shift:
        raise HTTPException(404, 'Không tìm thấy ca làm')
    if req.status not in {'OPEN', 'CLOSED'}:
        raise HTTPException(422, 'Trạng thái chỉ có thể là OPEN hoặc CLOSED')
    if req.status == 'OPEN':
        if shift.start_time <= datetime.utcnow():
            raise HTTPException(409, 'Không thể mở lại ca đã bắt đầu')
        accepted = db.query(models.Application).filter_by(shift_id=shift.id, status='ACCEPTED').count()
        if accepted >= shift.required_workers:
            raise HTTPException(409, 'Ca đã đủ người')
    shift.status = req.status
    db.commit()
    return {'id': str(shift.id), 'status': shift.status}

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
        if own_application and own_application.status in {'ACCEPTED', 'COMPLETED'}:
            reviewed = db.query(models.Review).filter_by(application_id=own_application.id, reviewer_role='STUDENT').first() is not None
            return {**shift_dict(shift), 'match_score': own_application.match_score, 'match_reasons': own_application.match_reasons.split(', '), 'available': False, 'applied': True, 'application_id': str(own_application.id), 'application_status': own_application.status, 'checked_in_at': own_application.checked_in_at, 'checked_out_at': own_application.checked_out_at, 'completed_at': own_application.completed_at, 'reviewed': reviewed}
        return {**shift_dict(shift), 'match_score': match['score'], 'match_reasons': match['reasons'], 'available': match['available'], 'applied': bool(own_application and own_application.status != 'INVITED'), 'invitation_id': str(own_application.id) if own_application and own_application.status == 'INVITED' else None}
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
    db.add(application); db.add(build_notification(db, user_id=shift.employer_id, shift_id=shift.id, title='Ứng viên mới cho ca làm', body=f'{user.student_profile.full_name} vừa ứng tuyển {shift.title}.', kind='APPLICATION')); db.commit()
    return {'message': 'Ứng tuyển thành công', 'application_id': str(application.id), 'match_score': application.match_score}

@app.post('/api/shifts/{shift_id}/invitations', status_code=201)
def invite_student(shift_id: uuid.UUID, req: InvitationCreate, user: models.User = Depends(require_role('EMPLOYER')), db: Session = Depends(get_db)):
    shift = db.query(models.JobShift).filter(models.JobShift.id == shift_id, models.JobShift.employer_id == user.id).with_for_update().first()
    if not shift:
        raise HTTPException(404, 'Không tìm thấy ca làm')
    if shift.status != 'OPEN' or shift.start_time <= datetime.utcnow():
        raise HTTPException(409, 'Ca không còn nhận ứng viên')
    student = db.query(models.Student).options(selectinload(models.Student.schedules)).filter(models.Student.user_id == req.student_id).first()
    if not student:
        raise HTTPException(404, 'Không tìm thấy sinh viên')
    if db.query(models.Application).filter_by(shift_id=shift.id, student_id=student.user_id).first():
        raise HTTPException(409, 'Sinh viên đã có đơn hoặc lời mời cho ca này')
    match = match_student_shift(student, shift)
    if not match['available']:
        raise HTTPException(409, 'Ca không phù hợp lịch sinh viên')
    application = models.Application(student_id=student.user_id, shift_id=shift.id, status='INVITED', match_score=match['score'], match_reasons=', '.join(match['reasons']))
    db.add(application)
    db.add(build_notification(db, user_id=student.user_id, shift_id=shift.id, title='Lời mời nhận ca làm', body=f'{shift.employer.company_name} mời bạn nhận ca {shift.title}.', kind='INVITATION'))
    db.commit()
    return {'id': str(application.id), 'status': 'INVITED'}

@app.get('/api/shifts/{shift_id}/applications')
def shift_applications(shift_id: uuid.UUID, user: models.User = Depends(require_role('EMPLOYER')), db: Session = Depends(get_db)):
    shift = db.query(models.JobShift).filter(models.JobShift.id == shift_id, models.JobShift.employer_id == user.id).first()
    if not shift:
        raise HTTPException(404, 'Không tìm thấy ca làm')
    applications = db.query(models.Application).filter(models.Application.shift_id == shift_id).order_by(models.Application.applied_at.desc()).all()
    reviewed_ids = {review.application_id for review in db.query(models.Review).filter(models.Review.reviewer_role == 'EMPLOYER', models.Review.application_id.in_([item.id for item in applications])).all()}
    return [{'id': str(item.id), 'student_id': str(item.student_id), 'name': item.student.full_name, 'avatar_data': item.student.user.avatar_data if item.student.user else None, 'university': item.student.university, 'status': item.status, 'match_score': item.match_score, 'applied_at': item.applied_at.replace(tzinfo=timezone.utc).isoformat(), 'checked_in_at': item.checked_in_at, 'checked_out_at': item.checked_out_at, 'completed_at': item.completed_at, 'cancellation_reason': item.cancellation_reason, 'cancellation_requested_by': item.cancellation_requested_by, 'reviewed': item.id in reviewed_ids} for item in applications]

@app.patch('/api/applications/{application_id}/check-in')
def check_in(application_id: uuid.UUID, user: models.User = Depends(require_role('STUDENT')), db: Session = Depends(get_db)):
    application = db.query(models.Application).filter_by(id=application_id, student_id=user.id).with_for_update().first()
    if not application:
        raise HTTPException(404, 'Không tìm thấy ca đã nhận')
    now = datetime.utcnow()
    if application.status != 'ACCEPTED' or application.checked_in_at:
        raise HTTPException(409, 'Ca không thể check-in')
    if not application.shift.start_time - timedelta(minutes=30) <= now <= application.shift.end_time:
        raise HTTPException(409, 'Chỉ check-in từ 30 phút trước ca đến khi ca kết thúc')
    application.checked_in_at = now
    db.commit()
    return {'id': str(application.id), 'checked_in_at': now.replace(tzinfo=timezone.utc)}

@app.patch('/api/applications/{application_id}/check-out')
def check_out(application_id: uuid.UUID, user: models.User = Depends(require_role('STUDENT')), db: Session = Depends(get_db)):
    application = db.query(models.Application).filter_by(id=application_id, student_id=user.id).with_for_update().first()
    if not application:
        raise HTTPException(404, 'Không tìm thấy ca đã nhận')
    now = datetime.utcnow()
    if application.status != 'ACCEPTED' or not application.checked_in_at or application.checked_out_at:
        raise HTTPException(409, 'Ca không thể check-out')
    if now < application.shift.end_time:
        raise HTTPException(409, 'Chỉ check-out sau khi ca kết thúc')
    application.checked_out_at = now
    db.add(build_notification(db, user_id=application.shift.employer_id, shift_id=application.shift_id, title='Sinh viên đã check-out', body=f'{user.student_profile.full_name} đã hoàn thành ca {application.shift.title}; vui lòng xác nhận chấm công.', kind='ATTENDANCE'))
    db.commit()
    return {'id': str(application.id), 'checked_out_at': now.replace(tzinfo=timezone.utc)}

@app.patch('/api/applications/{application_id}/complete')
def complete_application(application_id: uuid.UUID, user: models.User = Depends(require_role('EMPLOYER')), db: Session = Depends(get_db)):
    application = db.query(models.Application).join(models.JobShift).filter(models.Application.id == application_id, models.JobShift.employer_id == user.id).with_for_update().first()
    if not application:
        raise HTTPException(404, 'Không tìm thấy ca đã nhận')
    if application.status != 'ACCEPTED' or not application.checked_out_at or application.completed_at:
        raise HTTPException(409, 'Ca chưa thể xác nhận hoàn thành')
    application.completed_at = datetime.utcnow()
    application.status = 'COMPLETED'
    db.add(build_notification(db, user_id=application.student_id, shift_id=application.shift_id, title='Ca làm đã hoàn thành', body=f'Chấm công ca {application.shift.title} đã được xác nhận. Bạn có thể đánh giá doanh nghiệp.', kind='ATTENDANCE'))
    db.flush()
    remaining = db.query(models.Application).filter(models.Application.shift_id == application.shift_id, models.Application.status == 'ACCEPTED').count()
    if remaining == 0:
        application.shift.status = 'DONE'
    db.commit()
    return {'id': str(application.id), 'status': application.status, 'completed_at': application.completed_at.replace(tzinfo=timezone.utc)}

@app.post('/api/applications/{application_id}/reviews', status_code=201)
def review_application(application_id: uuid.UUID, req: ReviewCreate, user: models.User = Depends(user_or_401), db: Session = Depends(get_db)):
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application or (user.id != application.student_id and user.id != application.shift.employer_id):
        raise HTTPException(404, 'Không tìm thấy ca đã hoàn thành')
    if application.status != 'COMPLETED':
        raise HTTPException(409, 'Chỉ đánh giá sau khi ca được xác nhận hoàn thành')
    role = 'STUDENT' if user.id == application.student_id else 'EMPLOYER'
    if db.query(models.Review).filter_by(application_id=application.id, reviewer_role=role).first():
        raise HTTPException(409, 'Bạn đã đánh giá ca này')
    db.add(models.Review(application_id=application.id, reviewer_role=role, rating=req.rating, comment=req.comment.strip()))
    db.flush()
    if role == 'EMPLOYER':
        ratings = [row.rating for row in db.query(models.Review).join(models.Application).filter(models.Application.student_id == application.student_id, models.Review.reviewer_role == 'EMPLOYER').all()]
        application.student.average_rating = round(sum(ratings) / len(ratings), 2)
    else:
        ratings = [row.rating for row in db.query(models.Review).join(models.Application).join(models.JobShift).filter(models.JobShift.employer_id == application.shift.employer_id, models.Review.reviewer_role == 'STUDENT').all()]
        application.shift.employer.average_rating = round(sum(ratings) / len(ratings), 2)
    db.commit()
    return {'application_id': str(application.id), 'reviewer_role': role, 'rating': req.rating}

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
    db.add(build_notification(db, user_id=application.student_id, shift_id=shift.id, title='Bạn đã được nhận vào ca làm', body=f'Ca {shift.title} đã được xếp vào lịch của bạn.', kind='APPLICATION'))
    if accepted + 1 >= shift.required_workers:
        shift.status = 'FULL'
    db.commit()
    return {'id': str(application.id), 'status': application.status, 'shift_id': str(shift.id)}

@app.patch('/api/applications/{application_id}/reject')
def reject_application(application_id: uuid.UUID, user: models.User = Depends(require_role('EMPLOYER')), db: Session = Depends(get_db)):
    application = db.query(models.Application).join(models.JobShift).filter(models.Application.id == application_id, models.JobShift.employer_id == user.id).with_for_update().first()
    if not application:
        raise HTTPException(404, 'Không tìm thấy đơn ứng tuyển')
    if application.status != 'PENDING':
        raise HTTPException(409, 'Đơn không còn chờ duyệt')
    application.status = 'REJECTED'
    db.add(build_notification(db, user_id=application.student_id, shift_id=application.shift_id, title='Kết quả ứng tuyển', body=f'Đơn ứng tuyển ca {application.shift.title} chưa được chấp nhận.', kind='APPLICATION'))
    db.commit()
    return {'id': str(application.id), 'status': application.status}

def _remove_shift_schedule(db: Session, application: models.Application):
    db.query(models.Schedule).filter(models.Schedule.application_id == application.id).delete(synchronize_session=False)

@app.post('/api/applications/{application_id}/cancel')
def cancel_accepted_application(application_id: uuid.UUID, req: CancellationRequest, user: models.User = Depends(require_role('EMPLOYER')), db: Session = Depends(get_db)):
    application = db.query(models.Application).join(models.JobShift).filter(models.Application.id == application_id, models.JobShift.employer_id == user.id).with_for_update().first()
    if not application:
        raise HTTPException(404, 'Không tìm thấy ca đã nhận')
    if application.status not in {'ACCEPTED', 'LEAVE_REQUESTED'} or application.checked_in_at:
        raise HTTPException(409, 'Ca này không thể hủy')
    application.status = 'CANCELLED'
    application.cancellation_reason = req.reason.strip()
    application.cancellation_requested_by = 'EMPLOYER'
    application.cancellation_requested_at = datetime.utcnow()
    _remove_shift_schedule(db, application)
    if application.shift.status == 'FULL': application.shift.status = 'OPEN'
    db.add(build_notification(db, user_id=application.student_id, shift_id=application.shift_id, title='Ca làm đã bị hủy', body=f'{user.employer_profile.company_name} đã hủy ca {application.shift.title}. Lý do: {application.cancellation_reason}', kind='APPLICATION'))
    db.commit()
    return {'id': str(application.id), 'status': application.status}

@app.post('/api/applications/{application_id}/leave-request')
def request_leave(application_id: uuid.UUID, req: CancellationRequest, user: models.User = Depends(require_role('STUDENT')), db: Session = Depends(get_db)):
    application = db.query(models.Application).filter_by(id=application_id, student_id=user.id).with_for_update().first()
    if not application:
        raise HTTPException(404, 'Không tìm thấy ca đã nhận')
    if application.status != 'ACCEPTED' or application.checked_in_at:
        raise HTTPException(409, 'Ca này không thể xin nghỉ')
    application.status = 'LEAVE_REQUESTED'
    application.cancellation_reason = req.reason.strip()
    application.cancellation_requested_by = 'STUDENT'
    application.cancellation_requested_at = datetime.utcnow()
    db.add(build_notification(db, user_id=application.shift.employer_id, shift_id=application.shift_id, title='Sinh viên xin nghỉ ca', body=f'{user.student_profile.full_name} xin nghỉ ca {application.shift.title}. Lý do: {application.cancellation_reason}', kind='APPLICATION'))
    db.commit()
    return {'id': str(application.id), 'status': application.status}

@app.patch('/api/applications/{application_id}/leave-request')
def decide_leave(application_id: uuid.UUID, req: LeaveDecision, user: models.User = Depends(require_role('EMPLOYER')), db: Session = Depends(get_db)):
    application = db.query(models.Application).join(models.JobShift).filter(models.Application.id == application_id, models.JobShift.employer_id == user.id).with_for_update().first()
    if not application or application.status != 'LEAVE_REQUESTED':
        raise HTTPException(404, 'Không tìm thấy yêu cầu xin nghỉ')
    if req.approve:
        application.status = 'CANCELLED'
        _remove_shift_schedule(db, application)
        if application.shift.status == 'FULL': application.shift.status = 'OPEN'
        title, body = 'Yêu cầu xin nghỉ đã được duyệt', f'Yêu cầu xin nghỉ ca {application.shift.title} của bạn đã được duyệt.'
    else:
        application.status = 'ACCEPTED'
        application.cancellation_reason = None
        application.cancellation_requested_by = None
        application.cancellation_requested_at = None
        title, body = 'Yêu cầu xin nghỉ bị từ chối', f'Yêu cầu xin nghỉ ca {application.shift.title} bị từ chối.' + (f' Lý do: {req.reason.strip()}' if req.reason else '')
    db.add(build_notification(db, user_id=application.student_id, shift_id=application.shift_id, title=title, body=body, kind='APPLICATION'))
    db.commit()
    return {'id': str(application.id), 'status': application.status}

@app.patch('/api/applications/{application_id}/respond')
def respond_invitation(application_id: uuid.UUID, req: InvitationResponse, user: models.User = Depends(require_role('STUDENT')), db: Session = Depends(get_db)):
    application = db.query(models.Application).filter(models.Application.id == application_id, models.Application.student_id == user.id).with_for_update().first()
    if not application:
        raise HTTPException(404, 'Không tìm thấy lời mời')
    if application.status != 'INVITED':
        raise HTTPException(409, 'Lời mời không còn hiệu lực')
    shift = db.query(models.JobShift).filter(models.JobShift.id == application.shift_id).with_for_update().first()
    if not req.accept:
        application.status = 'DECLINED'
    else:
        if shift.status != 'OPEN' or shift.start_time <= datetime.utcnow():
            raise HTTPException(409, 'Ca không còn nhận ứng viên')
        accepted = db.query(models.Application).filter_by(shift_id=shift.id, status='ACCEPTED').count()
        if accepted >= shift.required_workers:
            raise HTTPException(409, 'Ca đã đủ người')
        student = db.query(models.Student).options(selectinload(models.Student.schedules)).filter(models.Student.user_id == user.id).first()
        if not match_student_shift(student, shift)['available']:
            raise HTTPException(409, 'Lịch của bạn đã thay đổi, không thể nhận ca')
        application.status = 'ACCEPTED'
        db.add(models.Schedule(student_id=user.id, application_id=application.id, title=f'Ca làm: {shift.title}', type='WORK', source='SHIFT', start_time=shift.start_time, end_time=shift.end_time))
        if accepted + 1 >= shift.required_workers:
            shift.status = 'FULL'
    db.add(build_notification(db, user_id=shift.employer_id, shift_id=shift.id, title='Sinh viên trả lời lời mời', body=f'{user.student_profile.full_name} đã {"nhận" if req.accept else "từ chối"} lời mời ca {shift.title}.', kind='INVITATION'))
    db.commit()
    return {'id': str(application.id), 'status': application.status, 'shift_id': str(shift.id)}

@app.get('/api/notifications')
def notifications(db: Session = Depends(get_db), user: models.User = Depends(user_or_401)):
    query = db.query(models.Notification).filter(models.Notification.user_id == user.id, models.Notification.in_app_enabled.is_(True)).order_by(models.Notification.created_at.desc()).limit(30)
    return [{'id': str(n.id), 'shift_id': str(n.shift_id) if n.shift_id else None, 'title': n.title, 'body': n.body, 'kind': n.kind, 'is_read': n.is_read, 'created_at': n.created_at.replace(tzinfo=timezone.utc).isoformat()} for n in query.all()]

@app.post('/api/push-tokens', status_code=201)
def register_push_token(req: PushTokenInput, user: models.User = Depends(require_role('STUDENT')), db: Session = Depends(get_db)):
    previous_owner = db.query(models.PushToken).filter(models.PushToken.token == req.token, models.PushToken.user_id != user.id).first()
    if previous_owner:
        db.delete(previous_owner)
        db.flush()
    token = db.query(models.PushToken).filter_by(user_id=user.id).first()
    if token:
        token.token = req.token
        token.platform = req.platform
        token.registered_at = datetime.utcnow()
    else:
        db.add(models.PushToken(user_id=user.id, token=req.token, platform=req.platform))
    db.commit()
    return {'registered': True}

@app.delete('/api/push-tokens', status_code=204)
def remove_push_token(req: PushTokenInput, user: models.User = Depends(require_role('STUDENT')), db: Session = Depends(get_db)):
    db.query(models.PushToken).filter_by(user_id=user.id, token=req.token).delete()
    db.commit()

@app.patch('/api/notifications/read-all')
def read_all_notifications(db: Session = Depends(get_db), user: models.User = Depends(user_or_401)):
    db.query(models.Notification).filter(models.Notification.user_id == user.id).update({'is_read': True}); db.commit(); return {'message': 'Đã đánh dấu tất cả đã đọc'}
