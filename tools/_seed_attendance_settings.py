"""출석체크 정책 기본값 INSERT (양 서버, Phase 1.2).

회원/상담사 별도 정책. 모든 값은 어드민에서 수정 가능.
보수적인 시작 값 — 운영 보면서 조정.
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

# (namespace, key, default_value)
# 회원: day1 100원, 5/10/15/20일 보너스 200/300/400/500원, 30일째 1만원 쿠폰
# 상담사: 절반 수준 + 쿠폰 없음
DEFAULTS = [
    # ── 회원 ──
    ('attendance', 'user.enabled', 'true'),
    ('attendance', 'user.day1', '100'),
    ('attendance', 'user.day5_bonus', '200'),
    ('attendance', 'user.day10_bonus', '300'),
    ('attendance', 'user.day15_bonus', '400'),
    ('attendance', 'user.day20_bonus', '500'),
    ('attendance', 'user.day30_coupon_amount', '10000'),
    ('attendance', 'user.coupon_expire_days', '14'),
    ('attendance', 'user.daily_total_limit', '1000000'),
    ('attendance', 'user.min_signup_days', '3'),
    # ── 상담사 ──
    ('attendance', 'counselor.enabled', 'true'),
    ('attendance', 'counselor.day1', '50'),
    ('attendance', 'counselor.day5_bonus', '100'),
    ('attendance', 'counselor.day10_bonus', '150'),
    ('attendance', 'counselor.day15_bonus', '200'),
    ('attendance', 'counselor.day20_bonus', '250'),
    ('attendance', 'counselor.day30_coupon_amount', '0'),   # 상담사는 쿠폰 없음
    ('attendance', 'counselor.coupon_expire_days', '14'),
    ('attendance', 'counselor.daily_total_limit', '500000'),
    ('attendance', 'counselor.min_signup_days', '3'),
]

# 동적 SQL — VALUES 다중 행 UPSERT
values_sql = ',\n'.join(
    f"  ('{ns}', '{k}', '{v}')" for ns, k, v in DEFAULTS
)
SQL = f"""
INSERT INTO setting (namespace, key, value)
VALUES
{values_sql}
ON CONFLICT (namespace, key) DO NOTHING;

-- 확인
SELECT namespace, key, value FROM setting
 WHERE namespace = 'attendance'
 ORDER BY key;
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
