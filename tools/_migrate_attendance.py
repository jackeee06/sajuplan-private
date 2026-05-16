"""출석체크 시스템 — member_attendance 테이블 신설 (2026-05-16 Phase 1).

스키마 설계:
  - member_id: 출석한 회원
  - target_kind: 'user' or 'counselor' (정책 분리용)
  - attended_date: 출석 날짜 (DATE — 시간 무관)
  - base_coin: 일일 기본 코인 (정책 setting 값에서)
  - bonus_coin: 연속일 보너스 (0/5일/10일/.../30일)
  - consecutive_days: 연속 출석 일수 (1부터 시작, 끊기면 1로 리셋)
  - coupon_id: 30일 보상으로 발급된 쿠폰 ID (NULL 이면 미발급)
  - UNIQUE(member_id, attended_date) — 같은 날 중복 출석 차단
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
    ("prod", "104.64.128.103", "/data/wwwroot/api.sajumoon.co.kr/.env"),
]

SQL = """
CREATE TABLE IF NOT EXISTS member_attendance (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  target_kind VARCHAR(20) NOT NULL CHECK (target_kind IN ('user', 'counselor')),
  attended_date DATE NOT NULL,
  base_coin INTEGER NOT NULL DEFAULT 0,
  bonus_coin INTEGER NOT NULL DEFAULT 0,
  consecutive_days INTEGER NOT NULL DEFAULT 1,
  coupon_id BIGINT REFERENCES coupon(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT member_attendance_unique_per_day UNIQUE (member_id, attended_date)
);

CREATE INDEX IF NOT EXISTS idx_member_attendance_member_date
  ON member_attendance (member_id, attended_date DESC);

CREATE INDEX IF NOT EXISTS idx_member_attendance_target_date
  ON member_attendance (target_kind, attended_date);

-- 확인 출력
SELECT 'member_attendance' AS table_name,
       (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_name = 'member_attendance') AS col_count,
       (SELECT COUNT(*) FROM information_schema.table_constraints
         WHERE table_name = 'member_attendance') AS constraint_count;
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
