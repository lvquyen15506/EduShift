from datetime import datetime
import uuid
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = 'users'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(80), unique=True, index=True, nullable=True)
    email = Column(String(255), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)
    avatar_data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    student_profile = relationship('Student', back_populates='user', uselist=False, cascade='all, delete-orphan')
    employer_profile = relationship('Employer', back_populates='user', uselist=False, cascade='all, delete-orphan')
    notifications = relationship('Notification', back_populates='user', cascade='all, delete-orphan')

class Student(Base):
    __tablename__ = 'students'
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    full_name = Column(String(150), nullable=False)
    phone = Column(String(30))
    university = Column(String(200))
    major = Column(String(200))
    skills = Column(Text, default='')
    average_rating = Column(Float, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    user = relationship('User', back_populates='student_profile')
    schedules = relationship('Schedule', back_populates='student', cascade='all, delete-orphan')
    applications = relationship('Application', back_populates='student', cascade='all, delete-orphan')

class Employer(Base):
    __tablename__ = 'employers'
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    company_name = Column(String(200), nullable=False)
    address = Column(String(300))
    phone = Column(String(30))
    is_verified = Column(Boolean, default=False)
    average_rating = Column(Float, nullable=True)
    user = relationship('User', back_populates='employer_profile')
    shifts = relationship('JobShift', back_populates='employer', cascade='all, delete-orphan')

class Schedule(Base):
    __tablename__ = 'schedules'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey('students.user_id', ondelete='CASCADE'), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    title = Column(String(200))
    type = Column(String(20), nullable=False, default='STUDY')
    source = Column(String(20), nullable=False, default='MANUAL')
    application_id = Column(UUID(as_uuid=True), ForeignKey('applications.id', ondelete='CASCADE'), unique=True, nullable=True)
    student = relationship('Student', back_populates='schedules')
    application = relationship('Application')

class JobShift(Base):
    __tablename__ = 'shifts'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employer_id = Column(UUID(as_uuid=True), ForeignKey('employers.user_id', ondelete='CASCADE'), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    location = Column(String(300), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    hourly_rate = Column(Float)
    required_workers = Column(Integer, default=1)
    required_skills = Column(Text, default='')
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    status = Column(String(20), default='OPEN')
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    employer = relationship('Employer', back_populates='shifts')
    applications = relationship('Application', back_populates='shift', cascade='all, delete-orphan')

class Application(Base):
    __tablename__ = 'applications'
    __table_args__ = (UniqueConstraint('student_id', 'shift_id', name='uq_application_student_shift'),)
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey('students.user_id', ondelete='CASCADE'), nullable=False)
    shift_id = Column(UUID(as_uuid=True), ForeignKey('shifts.id', ondelete='CASCADE'), nullable=False)
    match_score = Column(Float, default=0)
    match_reasons = Column(Text, default='')
    status = Column(String(20), default='PENDING')
    applied_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    checked_in_at = Column(DateTime, nullable=True)
    checked_out_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    student = relationship('Student', back_populates='applications')
    shift = relationship('JobShift', back_populates='applications')

class Review(Base):
    __tablename__ = 'reviews'
    __table_args__ = (UniqueConstraint('application_id', 'reviewer_role', name='uq_review_application_role'),)
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id = Column(UUID(as_uuid=True), ForeignKey('applications.id', ondelete='CASCADE'), nullable=False)
    reviewer_role = Column(String(20), nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, default='')
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class Notification(Base):
    __tablename__ = 'notifications'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    shift_id = Column(UUID(as_uuid=True), nullable=True)
    title = Column(String(220), nullable=False)
    body = Column(Text, nullable=False)
    kind = Column(String(30), default='INFO')
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    push_attempts = Column(Integer, default=0, nullable=False)
    push_next_attempt_at = Column(DateTime, nullable=True)
    push_sent_at = Column(DateTime, nullable=True)
    user = relationship('User', back_populates='notifications')

class PushToken(Base):
    __tablename__ = 'push_tokens'
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    token = Column(String(250), unique=True, nullable=False)
    platform = Column(String(20), nullable=False)
    registered_at = Column(DateTime, default=datetime.utcnow, nullable=False)
