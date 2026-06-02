"""출석 IP 제한 — Phase 3 안전장치 (2026-05-16).

1) member_attendance.ip 컬럼 추가 (INET, NULL 허용 — 레거시 행은 NULL)
2) (ip, attended_date) 인덱스
3) Settings 키 추가 — attendance.user.ip_daily_limit / counselor.ip_daily_limit
"""
from __future__ import annotations
import base64
import os
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

import paramiko

TARGETS = [
    ("test", "172.235.211.75", "/data/wwwroot/api.sajumoon.kr/.env"),
    ("prod", "104.64.128.103", "/data/wwwroot/api.sajuplan.com/.env"),
]

SQL = """
ALTER TABLE member_attendance ADD COLUMN IF NOT EXISTS ip INET;
CREATE INDEX IF NOT EXISTS idx_member_attendance_ip_date
   ON member_attendance (ip, attended_date) WHERE ip IS NOT NULL;

-- 같은 IP 하루 출석 가능한 최대 계정 수 (어뷰징 차단). 기본 3개.
INSERT INTO setting (namespace, key, value) VALUES
  ('attendance', 'user.ip_daily_limit', '3'),
  ('attendance', 'counselor.ip_daily_limit', '3')
ON CONFLICT (namespace, key) DO NOTHING;

-- 확인
SELECT 'ip column' AS check,
       (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_name = 'member_attendance' AND column_name = 'ip') AS exists;

SELECT namespace, key, value FROM setting
 WHERE key LIKE '%ip_daily_limit%' ORDER BY key;
"""


def apply_one(label: str, host: str, env_file: str, pw: str) -> int:
    b64 = base64.b64encode(SQL.encode("utf-8")).decode("ascii")
    inner = (
        f'export DATABASE_URL=$(grep -E "^DATABASE_URL=" {env_file} | cut -d= -f2-) && '
        f'echo {b64} | base64 -d | psql "$DATABASE_URL"'
    )
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    _, stdout, stderr = c.exec_command(f"bash -lc {repr(inner)}", get_pty=False)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    print(f"========== {label} ({host}) ==========")
    sys.stdout.write(out)
    if err.strip():
        sys.stderr.write(err)
    rc = stdout.channel.recv_exit_status()
    c.close()
    return rc


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        return 1
    rc_total = 0
    for label, host, env_file in TARGETS:
        rc = apply_one(label, host, env_file, pw)
        if rc != 0:
            rc_total = rc
    return rc_total


if __name__ == "__main__":
    sys.exit(main())
