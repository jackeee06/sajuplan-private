"""prod dist 의 canShowPhone 함수 본문 직접 확인."""
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)
print("=== members.controller.js 의 canShowPhone 정의 ===")
_, o, _ = c.exec_command("grep -n 'canShowPhone\\|is_super' /data/wwwroot/api.sajumoon.co.kr/dist/admin/members/members.controller.js", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
print()
print("=== 전체 함수 본문 (canShowPhone) ===")
_, o, _ = c.exec_command("sed -n '/function canShowPhone/,/^}/p' /data/wwwroot/api.sajumoon.co.kr/dist/admin/members/members.controller.js", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
c.close()
