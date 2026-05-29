"""prod .env 의 시크릿 키 이름만 확인 (값 X) + pm2 로그 BIZM 상태."""
from __future__ import annotations
import os, sys
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass
import paramiko

HOST = "104.64.128.103"
ENV_FILE = "/data/wwwroot/api.sajumoon.co.kr/.env"


def main():
    pw = os.environ.get("SSHPASS")
    if not pw: return 1
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=15)

    print("=== prod .env 시크릿 키 (이름 + 길이) ===")
    _, out, _ = c.exec_command(f"cat {ENV_FILE}", get_pty=False)
    text = out.read().decode("utf-8", errors="replace")
    interesting_prefixes = ("BIZM_", "AG9_", "M2NET_", "FCM_", "ALIGO_", "SMTP_", "GOOGLE_", "ADMIN_", "USER_JWT", "CRON_", "CARD_", "DATABASE_", "REDIS_", "SAJUMOON_")
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"): continue
        if "=" not in line: continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip("'\"")
        if any(k.startswith(p) for p in interesting_prefixes):
            # 발신번호, ENV, USER_ID 같이 공개 가능한 건 값 보임
            if k in ("ALIGO_SENDER", "SAJUMOON_ENV", "FCM_PROJECT_ID", "AG9_CPID", "BIZM_USER_ID", "M2NET_CPID", "BIZM_TPL_SIGNUP_AUTH", "BIZM_TPL_FIND_PW", "M2NET_API_URL", "AG9_HOST", "SMTP_HOST", "SMTP_PORT", "MAIL_FROM_NAME") or k.startswith("FCM_CRED"):
                print(f"  {k:30s} = {v}")
            else:
                print(f"  {k:30s} (len={len(v)})")

    print()
    print("=== pm2 logs sajumoon-api (최근 BIZM/SmsService 라인) ===")
    _, out, _ = c.exec_command(
        "pm2 logs sajumoon-api --lines 50 --nostream --raw 2>&1 | grep -i 'bizm\\|smsservice\\|alimtalk' | tail -15",
        get_pty=False,
    )
    print(out.read().decode("utf-8", errors="replace"))
    c.close()
    return 0

if __name__ == "__main__":
    sys.exit(main())
