"""건우선생(member_id=55) wide_headline/subcaption 적용 — 일회성 데모용."""
import os, sys, paramiko

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

PROD_HOST = "104.64.128.103"
TEST_HOST = "172.235.211.75"
URL_PROD = "postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon"
URL_TEST = "postgresql://sajumoon:xPuabObdxTWyhNeq1aDaVGZlW5yBxO@127.0.0.1:5432/sajumoon"

SQL = (
    "UPDATE post_counselor "
    "SET wide_headline = '다시 시작하는 인연, 건우선생', "
    "    wide_subcaption = '재혼·재회 타로 · 30초 1,800원', "
    "    updated_at = now() "
    "WHERE member_id = 55 "
    "RETURNING member_id, wide_headline, wide_subcaption;"
)

password = os.environ["SSHPASS"]

for label, host, url in [("prod", PROD_HOST, URL_PROD), ("test", TEST_HOST, URL_TEST)]:
    print(f"\n── {label} ({host}) ──")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, username="root", password=password, allow_agent=False, look_for_keys=False, timeout=20)
    stdin, stdout, stderr = c.exec_command(f"bash -lc \"psql '{url}' -v ON_ERROR_STOP=1\"")
    stdin.write(SQL + "\n")
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    print(out)
    if err.strip():
        print("[stderr]", err)
    c.close()
