"""Seed dữ liệu demo có thể lặp lại cho môi trường phát triển."""
from datetime import datetime, timedelta
from app.database import Base, engine, SessionLocal
from app import models
from app.main import pwd_context


def get_or_create_user(db, username, email, password, role):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        user = models.User(username=username, email=email, password_hash=pwd_context.hash(password), role=role)
        db.add(user); db.flush()
    else:
        user.email = email
        user.role = role
        user.password_hash = pwd_context.hash(password)
    return user


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        employer = get_or_create_user(db, 'greencoffee', 'employer@edushift.vn', 'EduShift123!', 'EMPLOYER')
        if not employer.employer_profile:
            db.add(models.Employer(user_id=employer.id, company_name='Green Coffee', address='Tạ Quang Bửu, Hà Nội', phone='0901000001', is_verified=True))
        student = get_or_create_user(db, 'sv001', 'student@edushift.vn', 'EduShift123!', 'STUDENT')
        if not student.student_profile:
            db.add(models.Student(user_id=student.id, full_name='Mai Anh', phone='0901000002', university='Đại học Bách Khoa Hà Nội', major='Công nghệ thông tin', skills='Phục vụ,Giao tiếp,Excel', average_rating=4.9))
        admin = get_or_create_user(db, 'admin', 'admin@edushift.vn', 'EduShift123!', 'ADMIN')
        db.flush()
        if not db.query(models.JobShift).filter(models.JobShift.employer_id == employer.id).first():
            now = datetime.utcnow()
            shifts = [
                models.JobShift(employer_id=employer.id, title='Nhân viên phục vụ', description='Hỗ trợ phục vụ khách hàng tại cửa hàng.', location='Green Coffee · Tạ Quang Bửu', start_time=now + timedelta(days=1, hours=5), end_time=now + timedelta(days=1, hours=9), hourly_rate=50000, required_workers=2, required_skills='Phục vụ,Giao tiếp', status='OPEN'),
                models.JobShift(employer_id=employer.id, title='Hỗ trợ sự kiện', description='Đón khách và hỗ trợ vận hành sự kiện.', location='Event X · Cầu Giấy', start_time=now + timedelta(days=4), end_time=now + timedelta(days=4, hours=4), hourly_rate=70000, required_workers=3, required_skills='Giao tiếp', status='OPEN'),
            ]
            db.add_all(shifts); db.flush()
        if not db.query(models.Notification).filter(models.Notification.user_id == employer.id).first():
            db.add_all([
                models.Notification(user_id=employer.id, title='Ứng viên mới cho ca Nhân viên phục vụ', body='Mai Anh có Match Score 98% và đang rảnh toàn bộ ca tối nay.', kind='APPLICATION'),
                models.Notification(user_id=employer.id, title='Ca làm sắp diễn ra', body='Ca Hỗ trợ sự kiện tại Event X sẽ bắt đầu sau 4 ngày.', kind='SHIFT'),
            ])
        db.commit()
        print('Seed completed')
        print('Employer: employer@edushift.vn / EduShift123!')
        print('Student: sv001 / EduShift123!')
        print('Admin: admin@edushift.vn / EduShift123!')
    finally:
        db.close()

if __name__ == '__main__':
    seed()
