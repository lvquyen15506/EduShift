"""Adapter for the school calendar format used by NoteClass."""

import re
from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

import httpx


SCHOOL_TZ = ZoneInfo('Asia/Ho_Chi_Minh')
SCHOOL_URL = 'https://api.lichhocsv.com'
LOGIN_HEADERS = {
    'Accept': 'application/json, text/plain, */*',
    'accept-language': 'vi-VN,vi;q=0.9',
    'User-Agent': 'LichHocSV/34 CFNetwork/1498.700.2 Darwin/23.6.0',
}
CALENDAR_HEADERS = {
    'Accept': 'application/json, text/plain, */*',
    'accept-language': 'vi-VN,vi;q=0.9',
    'User-Agent': 'LichHocSV/34 CFNetwork/3896.100.1.2.1 Darwin/27.0.0',
}


class SchoolCalendarError(Exception):
    pass


def _items(value):
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        for key in ('calendar_tasks', 'data', 'schedule', 'result', 'lichhoc', 'events', 'items'):
            if key in value:
                found = _items(value[key])
                if found:
                    return found
        grouped = [item for key, group in value.items() if re.fullmatch(r'\d{4}-\d{2}-\d{2}', str(key)) and isinstance(group, list) for item in group if isinstance(item, dict)]
        if grouped:
            return grouped
    return []


def _school_date(value):
    value = str(value or '').strip()
    for pattern in ('%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y'):
        try:
            return datetime.strptime(value[:10], pattern).date()
        except ValueError:
            pass
    return None


def _school_times(value):
    value = str(value or '').strip().lower().replace('h', ':')
    clock = re.fullmatch(r'\s*(\d{1,2}):(\d{1,2})\s*-\s*(\d{1,2}):(\d{1,2})\s*', value)
    if clock:
        try:
            return time(int(clock[1]), int(clock[2])), time(int(clock[3]), int(clock[4]))
        except ValueError:
            return None
    periods = re.fullmatch(r'\s*(\d{1,2})\s*-\s*(\d{1,2})\s*', value)
    if periods:
        first, last = int(periods[1]), int(periods[2])
        if 1 <= first <= last <= 15:
            return time(6 + first, 45), time(6 + last, 30)
    return None


def parse_school_calendar(payload):
    events = []
    seen = set()
    for item in _items(payload):
        title = next((str(item[key]).strip() for key in ('title', 'ten_mon', 'tenMonHoc', 'TenMonHoc', 'subject', 'subjectName', 'name', 'desc') if item.get(key)), '')
        day = _school_date(item.get('date') or item.get('ngay') or item.get('ngay_hoc'))
        hours = _school_times(item.get('timelearn') or item.get('tiet') or item.get('time'))
        if not title or not day or not hours:
            continue
        start_local = datetime.combine(day, hours[0], SCHOOL_TZ)
        end_local = datetime.combine(day, hours[1], SCHOOL_TZ)
        if end_local <= start_local:
            continue
        start = start_local.astimezone(timezone.utc).replace(tzinfo=None)
        end = end_local.astimezone(timezone.utc).replace(tzinfo=None)
        key = (title, start, end)
        if key not in seen:
            seen.add(key)
            events.append({'title': title[:200], 'start_time': start, 'end_time': end})
    return events


def fetch_school_calendar(username: str, password: str):
    try:
        with httpx.Client(base_url=SCHOOL_URL, timeout=15) as client:
            login = client.post('/api/auth/login?version=1.2.1', headers=LOGIN_HEADERS, json={
                'username': username, 'password': password,
                'token': 'dummy_token_for_api', 'platform': 'ios',
            })
            if login.status_code != 200:
                raise SchoolCalendarError('Đăng nhập cổng lịch học thất bại')
            login_data = login.json()
            cookie = login.cookies.get('session_key')
            if not cookie and isinstance(login_data, dict):
                cookie = str((login_data.get('UserData') or {}).get('cookie') or '').removeprefix('session_key=')
            if not cookie:
                raise SchoolCalendarError('Cổng lịch học không trả phiên đăng nhập')
            response = client.get('/api/calendar/task?version=1.2.1', headers={**CALENDAR_HEADERS, 'Cookie': f'session_key={cookie}'})
            if response.status_code != 200:
                raise SchoolCalendarError('Không tải được lịch học từ cổng trường')
            return parse_school_calendar(response.json())
    except (httpx.HTTPError, ValueError) as exc:
        raise SchoolCalendarError('Không thể kết nối hoặc đọc dữ liệu lịch học') from exc
