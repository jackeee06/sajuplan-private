"""prod dist 의 members.controller.js 가 새 fix 코드 포함하는지 확인."""
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)
print("=== members.controller.js 시점 ===")
_, o, _ = c.exec_command("ls -la /data/wwwroot/api.sajumoon.co.kr/dist/admin/members/members.controller.js", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
print()
print("=== 새 fix 코드 (canShowPhone is_super 우선) 포함 여부 ===")
_, o, _ = c.exec_command("grep -A3 'canShowPhone' /data/wwwroot/api.sajumoon.co.kr/dist/admin/members/members.controller.js | head -10", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
print()
print("=== pm2 sajumoon-api 마지막 reload 시점 ===")
_, o, _ = c.exec_command("pm2 jlist | python3 -c \"import sys,json; d=json.load(sys.stdin); [print(f'{p[\\\"name\\\"]}: uptime={p[\\\"pm2_env\\\"][\\\"pm_uptime\\\"]}, restart={p[\\\"pm2_env\\\"][\\\"restart_time\\\"]}') for p in d if p['name']=='sajumoon-api']\"", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
c.close()
