"""상담사에게 가는 후기 알림 템플릿 찾기."""
import os, sys, paramiko

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except: pass

pw = os.environ.get("SSHPASS")
if not pw: sys.exit(1)
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
_, out, _ = c.exec_command(
    "grep '^DATABASE_URL=' /data/wwwroot/api.sajumoon.co.kr/.env | head -1 | cut -d= -f2- | tr -d \"'\\\"\"",
    timeout=15,
)
url = out.read().decode().strip()

# 후기 관련 본문 검색
print("=== 후기 관련 alimtalk_template 본문 모두 ===")
_, out, _ = c.exec_command(
    f"psql '{url}' -c \"SELECT template_code, message FROM alimtalk_template WHERE message ILIKE '%후기%' OR message ILIKE '%선생님%'\"",
    timeout=30,
)
print(out.read().decode("utf-8", "replace"))

# 전체 template_code + message 첫 50자
print("\n=== 전체 template 목록 + 본문 50자 ===")
_, out, _ = c.exec_command(
    f"psql '{url}' -At -F'|' -c \"SELECT template_code, substring(message, 1, 80) FROM alimtalk_template ORDER BY template_code\"",
    timeout=30,
)
print(out.read().decode("utf-8", "replace"))
c.close()
