"""등급/단가 시스템 정책 시드 — setting 테이블 INSERT (2026-05-16, Phase 1.2).

명세: _NEXT_SESSION_등급단가시스템.md F.4 (단가표 + 정산률).

값은 모두 어드민에서 수정 가능. 고객 확정 단가표 받으면 어드민에서 교체.

ON CONFLICT (namespace, key) DO NOTHING — 재실행 안전 (기존 값 보존).
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

# (namespace, key, default_value)
DEFAULTS = [
    # ── 등급별 단가 옵션 (30초당, 콤마 구분) ──
    ('grade', 'options.preliminary', '800,1000'),
    ('grade', 'options.partner1',    '800,1000'),
    ('grade', 'options.partner2',    '1000,1200'),
    ('grade', 'options.partner3',    '1000,1200,1300'),
    ('grade', 'options.partner4',    '1000,1200,1300,1400,1500'),
    ('grade', 'options.partner5',    '1000,1200,1300,1400,1500'),

    # ── 등급별 정산률 (상담사 수익 비율 = call_total × revenue_rate) ──
    ('grade', 'revenue_rate.preliminary', '0.35'),
    ('grade', 'revenue_rate.partner1',    '0.45'),
    ('grade', 'revenue_rate.partner2',    '0.55'),
    ('grade', 'revenue_rate.partner3',    '0.60'),
    ('grade', 'revenue_rate.partner4',    '0.65'),
    ('grade', 'revenue_rate.partner5',    '0.70'),

    # ── 등급 임계값 (시간 단위. 직전 1개월 통화 시간) ──
    ('grade', 'thresholds.partner1', '20'),
    ('grade', 'thresholds.partner2', '40'),
    ('grade', 'thresholds.partner3', '70'),
    ('grade', 'thresholds.partner4', '90'),
    ('grade', 'thresholds.partner5', '120'),

    # ── 락 정책 ──
    ('grade', 'lock_until_first_day', 'true'),    # 매월 1일에만 단가 변경
    ('grade', 'recalc_day_of_month',  '1'),       # 매월 1일 등급 재산정
    ('grade', 'recalc_hour_kst',      '0'),       # KST 0시 (자정)

    # ── 강등 정책 ──
    ('grade', 'demote_step_max',      '1'),       # 한 번에 최대 강등 단계 수 (한 단계씩)
]

values_sql = ',\n'.join(
    f"  ('{ns}', '{k}', '{v}')" for ns, k, v in DEFAULTS
)
SQL = f"""
INSERT INTO setting (namespace, key, value)
VALUES
{values_sql}
ON CONFLICT (namespace, key) DO NOTHING;

-- ============================================
-- 검증 출력
-- ============================================
SELECT '=== grade settings ===' AS section;
SELECT key, value FROM setting
 WHERE namespace = 'grade'
 ORDER BY key;

SELECT '=== count ===' AS section;
SELECT COUNT(*)::int AS total FROM setting WHERE namespace = 'grade';
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
    print(f"\n========== {label} ({host}) ==========")
    sys.stdout.write(out)
    if err.strip():
        sys.stderr.write(err)
    rc = stdout.channel.recv_exit_status()
    c.close()
    return rc


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS env var required", file=sys.stderr)
        return 1
    rc_total = 0
    for label, host, env_file in TARGETS:
        rc = apply_one(label, host, env_file, pw)
        if rc != 0:
            rc_total = rc
    return rc_total


if __name__ == "__main__":
    sys.exit(main())
