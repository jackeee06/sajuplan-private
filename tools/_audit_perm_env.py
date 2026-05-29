"""권한/시크릿 검증 — env 키 길이만 (값 노출 X)."""
from __future__ import annotations
import os, sys
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass
import paramiko

HOST = "104.64.128.103"
ENV_FILE = "/data/wwwroot/api.sajumoon.co.kr/.env"
KEYS = [
    "ADMIN_JWT_SECRET","USER_JWT_SECRET","CRON_TOKEN",
    "BIZM_USER_ID","BIZM_PROFILE_KEY","M2NET_AUTH_HEADER",
    "AG9_API_KEY","ALIGO_SENDER","FCM_PROJECT_ID","DATABASE_URL",
    "REDIS_URL","SAJUMOON_ENV",
]


def main():
    pw = os.environ.get("SSHPASS")
    if not pw: print("SSHPASS env not set", file=sys.stderr); return 1
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=15)
    _, out, _ = c.exec_command(f"cat {ENV_FILE}", get_pty=False)
    env_text = out.read().decode("utf-8", errors="replace")
    found = {}
    for line in env_text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        # strip surrounding quotes
        v = v.strip().strip("'\"")
        found[k.strip()] = v
    for k in KEYS:
        v = found.get(k)
        if v is None:
            print(f"  {k:25s} → MISSING")
        else:
            # 시크릿 종류는 길이만, 보내는 번호는 보임 (안전)
            if k in ("ALIGO_SENDER", "FCM_PROJECT_ID", "SAJUMOON_ENV", "BIZM_USER_ID"):
                print(f"  {k:25s} → {v} (len={len(v)})")
            else:
                print(f"  {k:25s} → len={len(v)} {'(⚠️ 32자 미만)' if len(v) < 32 else 'OK'}")
    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
