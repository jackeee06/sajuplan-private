#!/usr/bin/env python3
import paramiko, os, sys

pw = os.environ.get('SSHPASS', '')
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('104.64.128.103', username='root', password=pw)

# CRON_TOKEN 읽기
stdin, stdout, stderr = client.exec_command(
    "grep CRON_TOKEN /data/wwwroot/api.sajumoon.co.kr/.env | head -1"
)
token_line = stdout.read().decode().strip()
client.close()

token = ''
if '=' in token_line:
    token = token_line.split('=', 1)[1].strip().strip('"').strip("'")

mb_id = sys.argv[1] if len(sys.argv) > 1 else 'jackee'
print(f'[token] {token[:8]}...')
print(f'[firing for mb_id={mb_id}]')

import urllib.request, json
url = f'https://api.sajuplan.com/api/cron/test-inapp-alert?mb_id={mb_id}'
req = urllib.request.Request(url)
req.add_header('X-Cron-Token', token)
try:
    resp = urllib.request.urlopen(req, timeout=10)
    data = json.loads(resp.read())
    print(f'[OK] memberId={data.get("memberId")} nickname={data.get("nickname")}')
    print('팝업이 30초 이내 앱에 표시됩니다!')
except Exception as e:
    print(f'[ERROR] {e}')
