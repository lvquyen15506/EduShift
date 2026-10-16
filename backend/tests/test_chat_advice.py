from datetime import datetime, timedelta
from types import SimpleNamespace

from app.chat_advice import assess_shift, schedule_advice_context


def test_advice_warns_about_overlap_and_heavy_day_without_blocking():
    start = datetime(2026, 10, 19, 2)
    study = SimpleNamespace(title='Lịch học', type='STUDY', start_time=start - timedelta(hours=5), end_time=start + timedelta(hours=1))
    result = assess_shift(start, start + timedelta(hours=8), [study])
    assert result['score'] < 50
    assert result['estimated_busy_hours'] == 13
    assert any('Trùng lịch' in warning for warning in result['warnings'])
    assert any('nghỉ ngơi' in warning for warning in result['warnings'])
    assert 'available' not in result


def test_context_uses_only_supplied_student_schedule_and_future_shifts():
    now = datetime(2026, 10, 19, 5)
    study = SimpleNamespace(title='Toán', type='STUDY', start_time=now + timedelta(hours=2), end_time=now + timedelta(hours=4))
    free = SimpleNamespace(title='Rảnh', type='FREE', start_time=now + timedelta(hours=4), end_time=now + timedelta(hours=8))
    company = SimpleNamespace(company_name='Quán A')
    shift = SimpleNamespace(id='shift-1', title='Phục vụ', employer=company, location='Hà Nội', hourly_rate=40000,
                            start_time=now + timedelta(hours=6), end_time=now + timedelta(hours=10))
    context = schedule_advice_context([study, free], [shift], now)
    assert len([item for item in context if item['type'] == 'my_schedule']) == 1
    assert len([item for item in context if item['type'] == 'advised_shift']) == 1
    assert context[-1]['score'] > 0
