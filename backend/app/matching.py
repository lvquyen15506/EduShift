"""Pure matching rules shared by recommendations, candidates, and applications."""

from datetime import datetime, timezone


def utc_naive(value: datetime) -> datetime:
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def schedule_available(start: datetime, end: datetime, schedules) -> bool:
    start, end = utc_naive(start), utc_naive(end)
    entries = list(schedules)
    if any(item.type in {'STUDY', 'BUSY', 'WORK'} and item.start_time < end and item.end_time > start for item in entries):
        return False
    free = sorted((item.start_time, item.end_time) for item in entries if item.type == 'FREE')
    if not free:
        return True
    covered_until = start
    for free_start, free_end in free:
        if free_start > covered_until:
            break
        if free_end > covered_until:
            covered_until = free_end
        if covered_until >= end:
            return True
    return False


def match_student_shift(student, shift):
    if not schedule_available(shift.start_time, shift.end_time, student.schedules):
        return {'score': 0, 'reasons': ['Không phù hợp thời gian'], 'available': False}

    required = {part.strip().casefold() for part in (shift.required_skills or '').split(',') if part.strip()}
    skills = {part.strip().casefold() for part in (student.skills or '').split(',') if part.strip()}
    skill_fraction = len(required & skills) / len(required) if required else 1
    rating = max(0.0, min(5.0, float(student.average_rating or 0)))
    score = int(60 + 25 * skill_fraction + 15 * rating / 5 + 0.5)
    reasons = ['Phù hợp thời gian']
    if required:
        reasons.append(f'Đáp ứng {len(required & skills)}/{len(required)} kỹ năng')
    if rating:
        reasons.append(f'Đánh giá {rating:g}/5')
    return {'score': score, 'reasons': reasons, 'available': True}
