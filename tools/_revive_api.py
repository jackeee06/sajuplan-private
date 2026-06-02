import os, sys, time
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)

print("=== pm2 sajumoon-api 상태 ===")
_, o, _ = c.exec_command("pm2 list | grep sajumoon", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))

print("=== ext health 응답 ===")
_, o, _ = c.exec_command('curl -s -o /dev/null -w "%{http_code}" https://api.sajuplan.com/api/health', get_pty=False)
print(o.read().decode("utf-8", errors="replace").strip())

print()
print("=== pm2 logs 최근 에러 (사고 원인) ===")
_, o, _ = c.exec_command("pm2 logs sajumoon-api --lines 30 --nostream --err 2>&1 | tail -30", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))

print()
print("=== pm2 restart 시도 ===")
_, o, _ = c.exec_command("pm2 restart sajumoon-api 2>&1 | tail -5", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))

time.sleep(5)
print()
print("=== restart 후 health ===")
_, o, _ = c.exec_command('curl -s -o /dev/null -w "%{http_code}" https://api.sajuplan.com/api/health', get_pty=False)
print(o.read().decode("utf-8", errors="replace").strip())
c.close()
