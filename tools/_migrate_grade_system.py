"""등급/단가 시스템 — Phase 1 스키마 마이그레이션 (2026-05-16).

명세: _NEXT_SESSION_등급단가시스템.md F 섹션.

추가 항목:
  - member 테이블: grade, last_month_seconds, unit_cost_changeable_at, grade_recalculated_at
  - consultation 테이블: unit_cost_snapshot, grade_at_session (사후 검증/정산 안전망)
  - 신규 이력 테이블 3종: member_unit_cost_history, member_grade_history, setting_history

설계 메모:
  - grade 기본값 'preliminary' (예비파트너) — 신규 가입자 디폴트
  - unit_cost_changeable_at NULL = 즉시 변경 가능 (신규/락 해제 직후)
  - consultation.unit_cost_snapshot: 통화 시작 시점 단가. amt 가 이미 계산값이지만
    명시적 스냅샷이 있어야 사후 검증/분쟁 시 추적 가능
  - 이력 테이블 모두 BIGSERIAL PK + created_at 인덱스
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
BEGIN;

-- 1. member 컬럼 추가 (등급/누적시간/락/재산정시각)
ALTER TABLE member ADD COLUMN IF NOT EXISTS grade TEXT NOT NULL DEFAULT 'preliminary';
ALTER TABLE member ADD COLUMN IF NOT EXISTS last_month_seconds BIGINT NOT NULL DEFAULT 0;
ALTER TABLE member ADD COLUMN IF NOT EXISTS unit_cost_changeable_at TIMESTAMPTZ;
ALTER TABLE member ADD COLUMN IF NOT EXISTS grade_recalculated_at TIMESTAMPTZ;

-- grade 값 검증 (이미 있으면 SKIP)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE constraint_name = 'member_grade_check' AND table_name = 'member'
  ) THEN
    ALTER TABLE member ADD CONSTRAINT member_grade_check
      CHECK (grade IN ('preliminary', 'partner1', 'partner2', 'partner3', 'partner4', 'partner5'));
  END IF;
END $$;

-- 2. consultation 에 단가/등급 스냅샷 (정산 안전망 — amt 만으로는 추적 어려움)
ALTER TABLE consultation ADD COLUMN IF NOT EXISTS unit_cost_snapshot INTEGER;
ALTER TABLE consultation ADD COLUMN IF NOT EXISTS grade_at_session TEXT;

-- 3. 단가 변경 이력
CREATE TABLE IF NOT EXISTS member_unit_cost_history (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT NOT NULL REFERENCES member(id),
  grade_at_change TEXT NOT NULL,
  unit_cost_before INTEGER,
  unit_cost_after INTEGER,
  changed_by TEXT NOT NULL,            -- 'self' | 'admin:<id>' | 'system'
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_unit_cost_history_member
  ON member_unit_cost_history (member_id, created_at DESC);

-- 4. 등급 변동 이력
CREATE TABLE IF NOT EXISTS member_grade_history (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT NOT NULL REFERENCES member(id),
  grade_before TEXT,
  grade_after TEXT NOT NULL,
  last_month_seconds BIGINT,
  change_type TEXT NOT NULL,           -- 'promote' | 'demote' | 'manual' | 'initial'
  changed_by TEXT NOT NULL,            -- 'cron' | 'admin:<id>' | 'signup'
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_grade_history_member
  ON member_grade_history (member_id, created_at DESC);

-- 5. 정책 변경 이력
CREATE TABLE IF NOT EXISTS setting_history (
  id BIGSERIAL PRIMARY KEY,
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  value_before TEXT,
  value_after TEXT,
  changed_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_setting_history_ns_key
  ON setting_history (namespace, key, created_at DESC);

COMMIT;

-- ============================================
-- 검증 출력
-- ============================================
SELECT '=== member columns added ===' AS section;
SELECT column_name, data_type, column_default, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'member'
   AND column_name IN ('grade', 'last_month_seconds', 'unit_cost_changeable_at', 'grade_recalculated_at')
 ORDER BY column_name;

SELECT '=== consultation columns added ===' AS section;
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'consultation'
   AND column_name IN ('unit_cost_snapshot', 'grade_at_session')
 ORDER BY column_name;

SELECT '=== new tables ===' AS section;
SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name)::int AS col_count
  FROM information_schema.tables t
 WHERE table_name IN ('member_unit_cost_history', 'member_grade_history', 'setting_history')
 ORDER BY table_name;

SELECT '=== member grade distribution (after default) ===' AS section;
SELECT grade, COUNT(*)::int AS cnt FROM member GROUP BY grade ORDER BY grade;

SELECT '=== grade CHECK constraint ===' AS section;
SELECT constraint_name, check_clause
  FROM information_schema.check_constraints
 WHERE constraint_name = 'member_grade_check';
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
