#!/usr/bin/env python3
"""jackee 알림 큐 상태 + 세션 진단"""
import paramiko, os, urllib.request, json

pw = os.environ.get('SSHPASS', '')

# 1) CRON_TOKEN 읽기
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('104.64.128.103', username='root', password=pw)
stdin, stdout, stderr = client.exec_command(
    "grep CRON_TOKEN /data/wwwroot/api.sajumoon.co.kr/.env | head -1"
)
token_line = stdout.read().decode().strip()

# 2) jackee member_id 확인
stdin2, stdout2, stderr2 = client.exec_command(
    "psql -U sajumoon -d sajumoon -c \"SELECT id, mb_id, role, nickname FROM member WHERE mb_id='jackee' LIMIT 1;\" 2>&1"
)
print("=== jackee 계정 정보 ===")
print(stdout2.read().decode())

# 3) pm2 로그에서 alerts.enqueue 흔적
stdin3, stdout3, stderr3 = client.exec_command(
    "pm2 logs sajumoon-api --lines 30 --nostream 2>&1 | grep -i 'grade_upgraded\\|enqueue\\|inapp' | tail -10"
)
print("=== PM2 로그 (알림 관련) ===")
print(stdout3.read().decode())

client.close()

token = token_line.split('=',1)[1].strip().strip('"').strip("'") if '=' in token_line else ''
print(f"=== CRON_TOKEN: {token[:8]}... ===")

# 4) 지금 알림 큐에 jackee 알림이 있는지 — 다시 발화
print("=== 알림 재발화 ===")
url = f'https://api.sajuplan.com/api/cron/test-inapp-alert?mb_id=jackee'
req = urllib.request.Request(url)
req.add_header('X-Cron-Token', token)
try:
    resp = urllib.request.urlopen(req, timeout=10)
    print(f'발화 성공: {resp.read().decode()}')
except Exception as e:
    print(f'발화 실패: {e}')
