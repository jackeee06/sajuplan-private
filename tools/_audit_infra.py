"""prod infra: crontab + backup + disk + ops_alert 설정."""
from __future__ import annotations
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")
import paramiko

HOST = "104.64.128.103"


def main():
    pw = os.environ.get("SSHPASS")
    if not pw: return 1
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=15)

    for label, cmd in [
        ("crontab", "crontab -l 2>&1"),
        ("system cron.d", "ls /etc/cron.d/ /etc/cron.daily/ 2>&1 | head -30"),
        ("backup paths", "ls -la /data/backup/ /var/backups/ /root/backup 2>&1 | head -30"),
        ("pg_dump", "which pg_dump 2>&1; ls /usr/local/oneinstack/postgres*/bin/pg_dump 2>&1; ls /usr/lib/postgresql/*/bin/pg_dump 2>&1 | head -5"),
        ("disk", "df -h / /data 2>&1 | head -5"),
        ("pm2 list", "pm2 list 2>&1 | head -15"),
        ("ops_alert setting", "psql $(grep '^DATABASE_URL' /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) -c \"SELECT namespace,key,value FROM setting WHERE namespace='ops' ORDER BY key\" 2>&1"),
        ("recent ops_alert ho log", "pm2 logs sajumoon-api --lines 100 --nostream --raw 2>&1 | grep -i 'OpsAlert' | tail -10"),
    ]:
        print(f"\n=== {label} ===")
        _, out, _ = c.exec_command(cmd, get_pty=False)
        print(out.read().decode("utf-8", errors="replace"))
    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
