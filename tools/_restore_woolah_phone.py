"""백업에서 월아신녀 phone 복원."""
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)

print("=== /data/backup/db 백업 파일 목록 ===")
_, o, _ = c.exec_command("ls -la /data/backup/db/", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))

print()
print("=== 각 백업 파일에서 월아신녀 phone 검색 ===")
_, o, _ = c.exec_command("for f in /data/backup/db/sajumoon_*.sql.gz; do echo \"--- $f ---\"; gunzip -c \"$f\" | grep -E \"tkarm|이세아\" | head -3; done", get_pty=False, timeout=60)
print(o.read().decode("utf-8", errors="replace"))

print()
print("=== post_apply 의 월아신녀 신청서 원본 phone ===")
sql = r"SELECT extras->>'mb_id' AS mb_id, extras->>'real_name' AS name, extras->>'phone' AS apply_phone FROM post_apply WHERE member_id=134;"
cmd = f'psql $(grep "^DATABASE_URL" /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) -c "{sql}"'
_, o, _ = c.exec_command(cmd, get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
c.close()
