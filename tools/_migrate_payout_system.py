"""선지급(early payout) 시스템 — Phase 1 스키마 마이그레이션 (2026-05-21).

명세: memory/project_payout_system_plan.md

추가 항목:
  - 신규 테이블 3종: payout_request, payout_request_log, counselor_bank_history
  - member 테이블: bank_locked_until, payout_blocked
  - settlement_monthly 테이블: early_payout_total, carry_over_negative, final_payout_amount

설계 메모:
  - 계좌 컬럼 (bank_name, bank_holder, bank_account) 은 member 에 이미 존재. 재사용.
  - is_super 도 이미 존재. 슈퍼어드민 권한은 코드 분기로.
  - payout_request.status 값: pending / paid / rejected / cancelled (approved 중간 상태 생략)
  - 신청 시점 정책 스냅샷 (fee_rate_snapshot, available_at_request) — 사후 분쟁 대비
  - 신청 시점 계좌 스냅샷 (bank_name/holder/account) — 계좌 변경 후에도 추적 가능
  - settlement_month: 'YYYY-MM'. 어느 달 정산에서 차감될지. cron 진입 시 채워짐.
  - settlement_monthly 의 early_payout_total: 그 달 paid 된 선지급 합. price 에서 차감.
  - carry_over_negative: 이전 달에서 이월된 음수 (다음 달 정산금에서 자동 차감).
  - final_payout_amount: 실 지급액 = price - early_payout_total + carry_over_negative
    (음수면 다음 달 carry_over_negative 로 이월)
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
BEGIN;

-- 1. member 테이블 — 선지급/계좌 보안 컬럼 추가
ALTER TABLE member ADD COLUMN IF NOT EXISTS bank_locked_until TIMESTAMPTZ;
ALTER TABLE member ADD COLUMN IF NOT EXISTS payout_blocked BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN member.bank_locked_until IS '계좌 변경 후 출금 잠금 해제 시각 (3일). NULL=잠금 없음';
COMMENT ON COLUMN member.payout_blocked IS '어드민이 수동 차단한 상담사. true=선지급 신청 거부';

-- 2. settlement_monthly — 선지급 차감 컬럼
ALTER TABLE settlement_monthly ADD COLUMN IF NOT EXISTS early_payout_total INT NOT NULL DEFAULT 0;
ALTER TABLE settlement_monthly ADD COLUMN IF NOT EXISTS carry_over_negative INT NOT NULL DEFAULT 0;
ALTER TABLE settlement_monthly ADD COLUMN IF NOT EXISTS final_payout_amount INT;

COMMENT ON COLUMN settlement_monthly.early_payout_total IS '그 달 paid 된 선지급 합 (정산금 차감용)';
COMMENT ON COLUMN settlement_monthly.carry_over_negative IS '이전 달에서 이월된 음수 (다음 달 정산금에서 자동 차감)';
COMMENT ON COLUMN settlement_monthly.final_payout_amount IS '실 지급액 = price - early_payout_total - carry_over_negative. 음수면 다음 달 carry_over_negative';

-- 3. 선지급 신청 마스터
CREATE TABLE IF NOT EXISTS payout_request (
  id BIGSERIAL PRIMARY KEY,
  counselor_id BIGINT NOT NULL REFERENCES member(id),

  -- 금액 분해
  requested_amount INT NOT NULL,             -- 상담사 요청액 (단위: 원)
  fee_amount INT NOT NULL,                   -- 수수료 (요청액 × fee_rate)
  withholding_amount INT NOT NULL,           -- 원천징수 3.3% (요청액 기준)
  actual_payout INT NOT NULL,                -- 실지급 = requested - fee - withholding

  -- 신청 시점 스냅샷 (분쟁 대비)
  fee_rate_snapshot NUMERIC(5,4) NOT NULL,   -- 신청 시점 수수료율 (0.0500 = 5%)
  available_at_request INT NOT NULL,         -- 신청 시점 가용 한도
  grade_at_request TEXT NOT NULL,            -- 신청 시점 등급

  -- 계좌 스냅샷 (변경 후에도 추적 가능)
  bank_name_snapshot TEXT NOT NULL,
  bank_holder_snapshot TEXT NOT NULL,
  bank_account_snapshot TEXT NOT NULL,

  -- 상태
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | paid | rejected | cancelled
  request_memo TEXT,                          -- 상담사 사유 (선택)
  admin_memo TEXT,                            -- 어드민 메모
  reject_reason TEXT,                         -- 반려 사유 (status='rejected' 시 필수)
  payment_proof TEXT,                         -- 송금 증빙 (이체 영수증 메모/파일경로)

  -- 정산 연결
  settlement_month TEXT,                      -- 'YYYY-MM' 어느 달 정산에서 차감될지
  settled_at TIMESTAMPTZ,                     -- 정산 cron 진입 후 차감 완료 시각

  -- 시각/주체
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by BIGINT,                          -- 처리한 admin member.id
  decided_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT payout_request_status_check CHECK (status IN ('pending', 'paid', 'rejected', 'cancelled')),
  CONSTRAINT payout_request_amount_positive CHECK (requested_amount > 0 AND actual_payout >= 0)
);

CREATE INDEX IF NOT EXISTS idx_payout_request_counselor ON payout_request (counselor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payout_request_status ON payout_request (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payout_request_settlement_month ON payout_request (settlement_month) WHERE settlement_month IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payout_request_pending_per_counselor
  ON payout_request (counselor_id) WHERE status = 'pending';

-- 4. 상태 변경 이력 (분쟁 대비)
CREATE TABLE IF NOT EXISTS payout_request_log (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES payout_request(id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,                  -- 'self' | 'admin:<id>' | 'cron'
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payout_request_log_request ON payout_request_log (request_id, created_at DESC);

-- 5. 계좌 변경 이력 (보안 / 분쟁 대비)
CREATE TABLE IF NOT EXISTS counselor_bank_history (
  id BIGSERIAL PRIMARY KEY,
  counselor_id BIGINT NOT NULL REFERENCES member(id),
  bank_name_before TEXT,
  bank_holder_before TEXT,
  bank_account_before TEXT,
  bank_name_after TEXT,
  bank_holder_after TEXT,
  bank_account_after TEXT,
  changed_by TEXT NOT NULL,                   -- 'self' | 'admin:<id>'
  changed_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_counselor_bank_history_counselor
  ON counselor_bank_history (counselor_id, created_at DESC);

COMMIT;

-- ============================================
-- 검증 출력
-- ============================================
SELECT '=== member columns added ===' AS section;
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_name = 'member'
   AND column_name IN ('bank_locked_until', 'payout_blocked')
 ORDER BY column_name;

SELECT '=== settlement_monthly columns added ===' AS section;
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_name = 'settlement_monthly'
   AND column_name IN ('early_payout_total', 'carry_over_negative', 'final_payout_amount')
 ORDER BY column_name;

SELECT '=== new tables ===' AS section;
SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name)::int AS col_count
  FROM information_schema.tables t
 WHERE table_name IN ('payout_request', 'payout_request_log', 'counselor_bank_history')
 ORDER BY table_name;

SELECT '=== payout_request indexes ===' AS section;
SELECT indexname FROM pg_indexes WHERE tablename = 'payout_request' ORDER BY indexname;

SELECT '=== payout_request CHECK constraints ===' AS section;
SELECT constraint_name, check_clause
  FROM information_schema.check_constraints
 WHERE constraint_name LIKE 'payout_request%';

SELECT '=== member.bank_locked_until / payout_blocked sample ===' AS section;
SELECT
  COUNT(*) FILTER (WHERE bank_locked_until IS NOT NULL)::int AS locked_count,
  COUNT(*) FILTER (WHERE payout_blocked = true)::int AS blocked_count,
  COUNT(*)::int AS total_members
  FROM member;
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
