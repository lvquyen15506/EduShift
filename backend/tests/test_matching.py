from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.matching import match_student_shift, schedule_available, utc_naive


START = datetime(2026, 10, 12, 8)
END = datetime(2026, 10, 12, 12)


def entry(start, end, kind):
    return SimpleNamespace(start_time=start, end_time=end, type=kind)


def student(schedules=(), skills='Giao tiếp', rating=4):
    return SimpleNamespace(schedules=schedules, skills=skills, average_rating=rating)


def shift(skills='Giao tiếp,Excel'):
    return SimpleNamespace(start_time=START, end_time=END, required_skills=skills)


def test_busy_overlap_blocks_but_touching_boundary_does_not():
    assert not schedule_available(START, END, [entry(START - timedelta(hours=1), START + timedelta(minutes=1), 'STUDY')])
    assert schedule_available(START, END, [entry(END, END + timedelta(hours=1), 'BUSY')])


def test_free_windows_must_cover_whole_shift():
    assert schedule_available(START, END, [entry(START, START + timedelta(hours=2), 'FREE'), entry(START + timedelta(hours=2), END, 'FREE')])
    assert not schedule_available(START, END, [entry(START, END - timedelta(minutes=1), 'FREE')])
    assert not schedule_available(START, END, [entry(START, END, 'FREE'), entry(START + timedelta(hours=1), START + timedelta(hours=2), 'STUDY')])


def test_score_uses_actual_skills_rating_and_availability():
    result = match_student_shift(student(), shift())
    assert result['score'] == 85
    assert result['available'] is True
    assert match_student_shift(student(skills='Giao tiếp,Excel', rating=5), shift())['score'] == 100
    assert match_student_shift(student(schedules=[entry(START, END, 'STUDY')]), shift())['score'] == 0


def test_aware_datetimes_are_normalized_to_utc():
    local = datetime(2026, 10, 12, 15, tzinfo=timezone(timedelta(hours=7)))
    assert utc_naive(local) == START
