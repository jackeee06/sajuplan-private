#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import paramiko, os, json

pw = 'saju26moon@!!'
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('104.64.128.103', port=22, username='root', password=pw, timeout=20, look_for_keys=False, allow_agent=False)

token = "cVuF_58fQKmo6nTMEodbDu:APA91bFg5YUax71W_3n-K8rnreaHbPMCKS7WCt7nYyZR3mTOk7ai8F-QZtfELd4ff3lDgUrNNb0rFiGlrIdEhSX99ZHU0xQQ3d33hEw2EyN289huiSznMcw"

payload = {
    "token": token,
    "title": "채팅 상담 요청이 도착했습니다",
    "content": "김민지 님이 채팅상담을 신청했습니다. 3분 안에 입장해주세요."
}
json_bytes = json.dumps(payload, ensure_ascii=False).encode('utf-8')

# JSON 파일 서버에 업로드
sftp = ssh.open_sftp()
with sftp.open('/tmp/push_test.json', 'wb') as f:
    f.write(json_bytes)
sftp.close()
print("JSON 업로드:", json.dumps(payload, ensure_ascii=False))

# admin 로그인
_, stdout, _ = ssh.exec_command(
    "curl -s -c /tmp/admin_cookie.txt -X POST http://localhost:3001/api/admin/auth/login "
    "-H 'Content-Type: application/json' "
    "-d '{\"mb_id\":\"admin_e2e\",\"password\":\"1234!\"}'"
)
login = stdout.read().decode('utf-8', errors='replace')
print("LOGIN:", "ok" if '"ok":true' in login else login[:100])

# 푸시 발송
_, stdout, _ = ssh.exec_command(
    "curl -s -b /tmp/admin_cookie.txt -X POST http://localhost:3001/api/admin/notifications/push-test "
    "-H 'Content-Type: application/json' "
    "--data-binary @/tmp/push_test.json"
)
result = stdout.read().decode('utf-8', errors='replace')
print("PUSH:", result)
ssh.close()
