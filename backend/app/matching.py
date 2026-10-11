"""Pure matching rules shared by recommendations, candidates, and applications."""

from datetime import datetime, timezone
from math import asin, cos, radians, sin, sqrt


def distance_km(lat1, lon1, lat2, lon2):
    a1, a2 = radians(lat1), radians(lat2)
    delta_a, delta_b = a2 - a1, radians(lon2 - lon1)
    arc = sin(delta_a / 2) ** 2 + cos(a1) * cos(a2) * sin(delta_b / 2) ** 2
    return 12742 * asin(sqrt(min(1, arc)))


def utc_naive(value: datetime) -> datetime:
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def schedule_available(start: datetime, end: datetime, schedules) -> bool:
    start, end = utc_naive(start), utc_naive(end)
    entries = list(schedules)
    if any(item.type in {'STUDY', 'BUSY', 'WORK'} and item.start_time < end and item.end_time > start for item in entries):
        return False
    # Availability is the default. FREE rows are informational only; students
    # should not have to pre-fill every free interval before receiving a shift.
    # Only declared study, busy, or already accepted work intervals can block it.
    return True


def match_student_shift(student, shift):
    if not schedule_available(shift.start_time, shift.end_time, student.schedules):
        return {'score': 0, 'reasons': ['Không phù hợp thời gian'], 'available': False}

    required = {part.strip().casefold() for part in (shift.required_skills or '').split(',') if part.strip()}
    skills = {part.strip().casefold() for part in (student.skills or '').split(',') if part.strip()}
    skill_fraction = len(required & skills) / len(required) if required else 1
    rating = student.average_rating
    has_location = all(getattr(value, name, None) is not None for value, name in ((student, 'latitude'), (student, 'longitude'), (shift, 'latitude'), (shift, 'longitude')))
    score = 60 + 25 * skill_fraction
    reasons = ['Phù hợp thời gian']
    if required:
        reasons.append(f'Đáp ứng {len(required & skills)}/{len(required)} kỹ năng')
    if rating is not None:
        score += 15 * max(0, min(5, float(rating))) / 5
        reasons.append(f'Đánh giá thật {rating:g}/5')
    else:
        reasons.append('Chưa có đánh giá')
    if has_location:
        km = distance_km(student.latitude, student.longitude, shift.latitude, shift.longitude)
        distance_points, band = (10, 'dưới 5 km') if km < 5 else (7, '5–15 km') if km < 15 else (3, '15–30 km') if km < 30 else (0, 'trên 30 km')
        score = score * 0.9 + distance_points
        reasons.append('Khoảng cách ước tính: ' + band)
    return {'score': int(score + 0.5), 'reasons': reasons, 'available': True}
