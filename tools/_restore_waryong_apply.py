"""와룡선생 phone 복원."""
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)
sql = "UPDATE member SET phone='01031312501', telno='01031312501', updated_at=NOW() WHERE id=124; SELECT id, mb_id, name, phone, LENGTH(phone) FROM member WHERE id=124;"
cmd = f'psql $(grep "^DATABASE_URL" /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) -c "{sql}"'
_, o, _ = c.exec_command(cmd, get_pty=False)
print(o.read().decode("utf-8", errors="replace"))

# 최종 — 모든 손상 phone 0건 확인
print("=== 최종 검증 — 손상 phone 0건 ===")
_, o, _ = c.exec_command("psql $(grep '^DATABASE_URL' /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) -c \"SELECT COUNT(*) AS damaged FROM member WHERE phone IS NOT NULL AND phone != '' AND LENGTH(phone) < 10\"", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
c.close()
