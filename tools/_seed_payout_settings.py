"""선지급 시스템 정책 시드 — setting 테이블 INSERT (2026-05-21).

명세: memory/project_payout_system_plan.md

사장님 8가지 정책 확정값:
  - 수수료 5% (정률) / 슈퍼어드민만 수정
  - 가용 비율 70%
  - 최소 신청금 30,000원
  - 신청 빈도 일 1회 / 처리 대기 중 차단
  - 예비파트너 차단
  - 계좌 변경 후 잠금 3일
  - 회사 일 한도 없음
  - 원천징수 3.3% (요청금 기준 단순화)

음수 정산: 회사가 임시 메움 → 다음 달 자동 차감 (회수 X)

ON CONFLICT (namespace, key) DO NOTHING — 재실행 안전 (기존 값 보존).
어드민에서 수정 가능 (수수료율은 슈퍼어드민만).
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
    # ── 활성화 ──
    ('payout', 'enabled', 'true'),                       # 시스템 전체 on/off

    # ── 수수료 (슈퍼어드민만 수정) ──
    ('payout', 'fee_rate', '0.05'),                      # 5%. 정률
    ('payout', 'withholding_rate', '0.033'),             # 3.3% 원천징수 (사업소득)

    # ── 가용 한도 ──
    ('payout', 'available_ratio', '0.7'),                # 누적 정산예상의 70%

    # ── 신청 제한 ──
    ('payout', 'min_amount', '30000'),                   # 최소 신청금 3만원
    ('payout', 'max_per_day_per_counselor', '1'),        # 상담사별 일 1회

    # ── 등급 제한 ──
    ('payout', 'block_preliminary', 'true'),             # 예비파트너 차단

    # ── 보안 ──
    ('payout', 'bank_lock_days', '3'),                   # 계좌 변경 후 출금 잠금 일수

    # ── 음수 정산 처리 ──
    ('payout', 'negative_carry_over', 'true'),           # true=다음달 이월 (회사 임시 메움)

    # ── 회사 한도 (사장님: 없음) ──
    # ('payout', 'daily_limit_company', '0'),            # 0=없음. 필요 시 활성화

    # ── health-check 임계값 ──
    ('payout', 'anomaly_paid_ratio_threshold', '1.5'),   # 누적 paid > 누적정산예상 × 1.5 = Critical
    ('payout', 'anomaly_pending_days', '30'),            # 30일+ pending = Warning
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
SELECT '=== payout settings ===' AS section;
SELECT key, value FROM setting
 WHERE namespace = 'payout'
 ORDER BY key;

SELECT '=== count ===' AS section;
SELECT COUNT(*)::int AS total FROM setting WHERE namespace = 'payout';
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
