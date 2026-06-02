"""dist 의 autoCancelStaleChats 가 created_at 을 쓰는지 확인."""
import os, paramiko
pw = os.environ['SSHPASS']
for label, host, api_remote in [
    ('test','172.235.211.75','/data/wwwroot/api.sajumoon.kr'),
    ('prod','104.64.128.103','/data/wwwroot/api.sajumoon.co.kr'),
]:
    print(f'\n=== [{label}] {host} ===')
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)

    # autoCancelStaleChats 함수 SQL 부분
    _, o, _ = c.exec_command(
        f"grep -n -A20 'autoCancelStaleChats' "
        f"{api_remote}/dist/user/consult/consult.service.js | head -40"
    )
    print(o.read().decode()[:3500])
    print('---')
    # created_at 패턴 확인
    _, o, _ = c.exec_command(
        f"grep -nE 'created_at.{{0,30}}3 minutes|3 minutes.{{0,30}}created_at|status.{{0,5}}STAY.{{0,200}}created_at' "
        f"{api_remote}/dist/user/consult/consult.service.js | head -10"
    )
    body = o.read().decode().strip()
    print(f'created_at + STAY 흔적: {body or "(없음 ✅)"}')
    c.close()
