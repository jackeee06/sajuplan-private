"""와룡선생 phone 백업에서 복원."""
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)

print("=== 백업에서 와룡선생 (more2502) phone 검색 ===")
_, o, _ = c.exec_command("for f in /data/backup/db/sajumoon_*.sql.gz; do echo \"--- $f ---\"; gunzip -c \"$f\" | grep -E 'more2502|전영하' | grep -oE '01[0-9]{8,10}' | sort -u; done", get_pty=False, timeout=60)
print(o.read().decode("utf-8", errors="replace"))
c.close()
