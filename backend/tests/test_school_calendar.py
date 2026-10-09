from datetime import datetime
import httpx

from app import school_calendar
from app.school_calendar import parse_school_calendar


def test_grouped_school_calendar_is_deduplicated_and_converted_to_utc():
    payload = {'data': {
        '2026-10-12': [
            {'date': '2026-10-12', 'timelearn': '13:00 - 17:00', 'title': 'Toán'},
            {'date': '2026-10-12', 'timelearn': '13:00 - 17:00', 'title': 'Toán'},
            {'date': '2026-10-12', 'timelearn': 'không rõ', 'title': 'Bỏ qua'},
        ],
    }}
    events = parse_school_calendar(payload)
    assert len(events) == 1
    assert events[0]['start_time'] == datetime(2026, 10, 12, 6)
    assert events[0]['end_time'] == datetime(2026, 10, 12, 10)


def test_period_notation_from_noteclass():
    events = parse_school_calendar({'data': [{'date': '13/10/2026', 'timelearn': '1-5', 'title': 'Vật lý'}]})
    assert events[0]['start_time'] == datetime(2026, 10, 13, 0, 45)
    assert events[0]['end_time'] == datetime(2026, 10, 13, 4, 30)


def test_school_fetch_uses_headers_required_by_calendar_api(monkeypatch):
    original_client = httpx.Client
    def respond(request):
        if request.url.path == '/api/auth/login':
            assert request.headers['user-agent'].startswith('LichHocSV/34')
            return httpx.Response(200, json={'UserData': {'cookie': 'session_key=test-session'}})
        assert request.url.path == '/api/calendar/task'
        assert request.headers['user-agent'].startswith('LichHocSV/34')
        assert request.headers['cookie'] == 'session_key=test-session'
        return httpx.Response(200, json={'data': [{'date': '2026-10-12', 'timelearn': '13:00 - 17:00', 'title': 'Toán'}]})
    transport = httpx.MockTransport(respond)
    monkeypatch.setattr(school_calendar.httpx, 'Client', lambda *args, **kwargs: original_client(*args, transport=transport, **kwargs))
    events = school_calendar.fetch_school_calendar('sample-user', 'sample-password')
    assert len(events) == 1
    assert events[0]['start_time'] == datetime(2026, 10, 12, 6)
