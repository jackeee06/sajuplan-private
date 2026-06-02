"""Phase 13 — 알림톡 발송 로그 테이블 마이그레이션 (2026-05-16).

발송 시도 / 성공 / 실패 모두 추적. 사후 분석 + 실패 재발송 근거.
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
    ("prod", "104.64.128.103", "/data/wwwroot/api.sajuplan.com/.env"),
]

SQL = """
BEGIN;

CREATE TABLE IF NOT EXISTS alimtalk_send_log (
  id BIGSERIAL PRIMARY KEY,
  template_code TEXT NOT NULL,
  phone TEXT NOT NULL,
  vars JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL,                  -- 'success' | 'failed' | 'dev_skip'
  failure_reason TEXT,                   -- 실패 원인 (BizM error code 등)
  bizm_response JSONB,                   -- BizM 원문 응답 (디버깅용)
  initiated_by TEXT,                     -- 'system' | 'admin:<id>' | 'cron'
  bulk_job_id BIGINT,                    -- 일괄 발송 시 그룹 ID
  member_id BIGINT REFERENCES member(id),-- 수신자 회원 ID (있으면)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alimtalk_send_log_created
  ON alimtalk_send_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alimtalk_send_log_status
  ON alimtalk_send_log (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alimtalk_send_log_template
  ON alimtalk_send_log (template_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alimtalk_send_log_bulk
  ON alimtalk_send_log (bulk_job_id) WHERE bulk_job_id IS NOT NULL;

COMMIT;

SELECT '=== alimtalk_send_log ===' AS section;
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name='alimtalk_send_log'
 ORDER BY ordinal_position;
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
    _, stdout, _ = c.exec_command(f"bash -lc {repr(inner)}", get_pty=False)
    out = stdout.read().decode("utf-8", errors="replace")
    rc = stdout.channel.recv_exit_status()
    print(f"\n========== {label} ({host}) ==========")
    print(out)
    c.close()
    return rc


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        return 1
    rc = 0
    for label, host, env_file in TARGETS:
        r = apply_one(label, host, env_file, pw)
        if r != 0:
            rc = r
    return rc


if __name__ == "__main__":
    sys.exit(main())
