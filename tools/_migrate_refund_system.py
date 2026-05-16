"""Phase 10 — 환불 시스템 스키마 마이그레이션 (2026-05-16).

추가 항목:
  - refund_request 테이블 신규
  - consultation 컬럼: refunded_amount, refund_status

설계:
  - refund_request: 환불 요청/승인 이력. status='pending'|'approved'|'rejected'
  - consultation.refunded_amount: 누적 환불 금액 (부분 환불 가능)
  - consultation.refund_status: NULL / 'partial' / 'full' (UI 표시용)
  - 정산 cron 은 refunded_amount 를 amt 에서 차감해서 계산
"""
from __future__ import annotations
import base64
import os
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import paramiko

TARGETS = [
    ("test", "172.235.211.75", "/data/wwwroot/api.sajumoon.kr/.env"),
    ("prod", "104.64.128.103", "/data/wwwroot/api.sajumoon.co.kr/.env"),
]

SQL = """
BEGIN;

-- 1. consultation 에 환불 추적 컬럼 추가
ALTER TABLE consultation ADD COLUMN IF NOT EXISTS refunded_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE consultation ADD COLUMN IF NOT EXISTS refund_status TEXT;

-- 2. refund_request 테이블 신규
CREATE TABLE IF NOT EXISTS refund_request (
  id BIGSERIAL PRIMARY KEY,
  consultation_id BIGINT NOT NULL REFERENCES consultation(id),
  member_id BIGINT NOT NULL REFERENCES member(id),
  counselor_id BIGINT REFERENCES member(id),
  amount INTEGER NOT NULL,                    -- 환불 총 금액 (포인트)
  amount_free INTEGER NOT NULL DEFAULT 0,     -- 무료 코인 환불 분
  amount_pro INTEGER NOT NULL DEFAULT 0,      -- 유료 코인 환불 분
  reason TEXT NOT NULL,                       -- 신청 사유
  status TEXT NOT NULL DEFAULT 'approved',    -- pending | approved | rejected
  requested_by TEXT NOT NULL,                 -- 'admin:<id>' | 'user:<id>'
  decided_by TEXT,                            -- 'admin:<id>'
  decided_reason TEXT,
  point_history_id BIGINT,                    -- 회원 환불 적립 이력 ID (역추적용)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  CONSTRAINT refund_amount_positive CHECK (amount > 0),
  CONSTRAINT refund_status_valid CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_refund_request_consultation
  ON refund_request (consultation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refund_request_member
  ON refund_request (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refund_request_status
  ON refund_request (status, created_at DESC);

COMMIT;

-- 검증
SELECT '=== consultation 컬럼 추가 ===' AS section;
SELECT column_name, data_type, column_default
  FROM information_schema.columns
 WHERE table_name='consultation' AND column_name IN ('refunded_amount', 'refund_status')
 ORDER BY column_name;

SELECT '=== refund_request 테이블 ===' AS section;
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name='refund_request'
 ORDER BY ordinal_position;

SELECT '=== refund_request 인덱스 ===' AS section;
SELECT indexname FROM pg_indexes WHERE tablename='refund_request' ORDER BY indexname;
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
        return 1
    rc_total = 0
    for label, host, env_file in TARGETS:
        rc = apply_one(label, host, env_file, pw)
        if rc != 0:
            rc_total = rc
    return rc_total


if __name__ == "__main__":
    sys.exit(main())
