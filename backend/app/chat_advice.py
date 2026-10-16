"""Advisory-only schedule analysis for the chat assistant."""

from datetime import datetime, timedelta, timezone

VIETNAM = timezone(timedelta(hours=7))
BUSY_TYPES = {'STUDY', 'BUSY', 'WORK'}


def local_time(value: datetime) -> str:
    utc_value = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return utc_value.astimezone(VIETNAM).isoformat(timespec='minutes')


def assess_shift(start: datetime, end: datetime, schedules) -> dict:
    """Describe risks without deciding whether the student may apply."""
    busy = [item for item in schedules if item.type in BUSY_TYPES]
    overlapping = [item for item in busy if item.start_time < end and item.end_time > start]
    local_start = start.replace(tzinfo=timezone.utc).astimezone(VIETNAM)
    local_end = end.replace(tzinfo=timezone.utc).astimezone(VIETNAM)
    day = local_start.date()
    peak_hours = 0.0
    while day <= local_end.date():
        day_start = datetime.combine(day, datetime.min.time(), VIETNAM).astimezone(timezone.utc).replace(tzinfo=None)
        day_end = day_start + timedelta(days=1)
        intervals = sorted((max(item_start, day_start), min(item_end, day_end)) for item_start, item_end in
                           [(start, end)] + [(item.start_time, item.end_time) for item in busy]
                           if item_start < day_end and item_end > day_start)
        merged = []
        for item_start, item_end in intervals:
            if merged and item_start <= merged[-1][1]:
                merged[-1] = (merged[-1][0], max(merged[-1][1], item_end))
            else:
                merged.append((item_start, item_end))
        peak_hours = max(peak_hours, sum((item_end - item_start).total_seconds() for item_start, item_end in merged) / 3600)
        day += timedelta(days=1)
    shift_hours = (end - start).total_seconds() / 3600
    total_hours = round(peak_hours, 1)
    gaps = [(start - item.end_time).total_seconds() for item in busy if item.end_time <= start]
    gaps += [(item.start_time - end).total_seconds() for item in busy if item.start_time >= end]
    nearest_gap = min(gaps, default=None)
    warnings = []
    if overlapping:
        warnings.append('Trùng lịch đã có: ' + ', '.join(item.title for item in overlapping[:3]))
    if total_hours > 12:
        warnings.append(f'Tổng thời gian học/làm dự kiến khoảng {total_hours:g} giờ trong ngày, cần cân nhắc nghỉ ngơi')
    elif total_hours > 8:
        warnings.append(f'Ngày này dự kiến bận khoảng {total_hours:g} giờ')
    if nearest_gap is not None and nearest_gap < 3600:
        warnings.append('Khoảng nghỉ trước ca dưới 1 giờ; cần tính thời gian di chuyển')
    if shift_hours >= 10:
        warnings.append(f'Ca dài {shift_hours:g} giờ; nên hỏi doanh nghiệp về thời gian nghỉ')
    score = max(0, 100 - (50 if overlapping else 0) - (25 if total_hours > 12 else 10 if total_hours > 8 else 0) - (10 if nearest_gap is not None and nearest_gap < 3600 else 0))
    return {'score': score, 'warnings': warnings, 'estimated_busy_hours': total_hours}


def schedule_advice_context(schedules, shifts, now: datetime) -> list[dict]:
    horizon = now + timedelta(days=14)
    relevant = [item for item in schedules if item.end_time > now and item.start_time < horizon and item.type in BUSY_TYPES]
    planned = [{'type': 'my_schedule', 'title': item.title, 'kind': item.type,
                'start_time': local_time(item.start_time), 'end_time': local_time(item.end_time)} for item in relevant[:60]]
    candidates = []
    for shift in shifts:
        if not (now < shift.start_time < horizon):
            continue
        advice = assess_shift(shift.start_time, shift.end_time, relevant)
        candidates.append({'type': 'advised_shift', 'id': str(shift.id), 'title': shift.title,
                           'company_name': shift.employer.company_name, 'location': shift.location,
                           'start_time': local_time(shift.start_time), 'end_time': local_time(shift.end_time),
                           'hourly_rate': shift.hourly_rate, **advice})
    candidates.sort(key=lambda item: (-item['score'], item['start_time']))
    return planned + candidates[:6]
