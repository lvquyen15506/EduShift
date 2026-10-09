import httpx
import asyncio
import json
import os

async def fetch_student_schedule(username, password):
    base_url = "https://api.lichhocsv.com"

    headers = {
        'Accept': 'application/json, text/plain, */*',
        'accept-language': 'vi-VN,vi;q=0.9',
        'Content-Type': 'application/json',
        'User-Agent': 'LichHocSV/34 CFNetwork/1498.700.2 Darwin/23.6.0'
    }

    login_data = {
        'username': username,
        'password': password,
        'token': 'dummy_token_for_api',
        'platform': 'ios'
    }

    async with httpx.AsyncClient() as client:
        # 1. Login
        print(f"[*] Đang đăng nhập tài khoản: {username}...")
        login_url = f"{base_url}/api/auth/login?version=1.2.1"
        response = await client.post(login_url, json=login_data, headers=headers)

        if response.status_code != 200:
            print("[-] Đăng nhập thất bại:", response.status_code, response.text)
            return None

        data = response.json()
        print("[+] Đăng nhập thành công!")

        # Lấy session cookie
        session_key = None

        # Check raw cookies
        for cookie in response.cookies.jar:
            if cookie.name == 'session_key':
                session_key = cookie.value

        # Check from payload
        if not session_key and 'UserData' in data and 'cookie' in data['UserData']:
            cookie_str = data['UserData']['cookie']
            if cookie_str.startswith('session_key='):
                session_key = cookie_str.split('=')[1]

        if not session_key:
            print("[-] Không tìm thấy session_key!")
            return None

        print("[*] Đã nhận phiên đăng nhập")

        # 2. Lấy thời khóa biểu
        print("[*] Đang lấy thời khóa biểu...")
        headers['Cookie'] = f"session_key={session_key}"
        schedule_url = f"{base_url}/api/calendar/task?version=1.2.1"

        sched_response = await client.get(schedule_url, headers=headers)

        if sched_response.status_code == 200:
            sched_data = sched_response.json()
            print("[+] Lấy thời khóa biểu thành công!")

            # Print a few tasks to verify
            if isinstance(sched_data, list):
                print(f"[*] Số lượng ca học tìm thấy: {len(sched_data)}")
                for task in sched_data[:3]: # in ra 3 ca học đầu tiên
                    print(" - ", task.get('title') or task.get('name') or task, "| Time:", task.get('start'), "->", task.get('end'))
            else:
                print(f"[*] Dữ liệu trả về (Sample): {str(sched_data)[:500]}...")

            return sched_data
        else:
            print("[-] Lấy thời khóa biểu thất bại:", sched_response.status_code)
            return None

if __name__ == "__main__":
    username = os.getenv("SCHOOL_USERNAME")
    password = os.getenv("SCHOOL_PASSWORD")
    if not username or not password:
        raise SystemExit("Thiếu SCHOOL_USERNAME hoặc SCHOOL_PASSWORD")
    asyncio.run(fetch_student_schedule(username, password))
