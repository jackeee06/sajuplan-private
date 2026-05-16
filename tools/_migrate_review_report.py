"""후기 신고 시스템 — review_report 테이블 신설 마이그레이션 (test + prod 일괄 적용).

2026-05-15 — Phase 2 (후기 신고 기능) DB 작업.
한 사용자가 같은 후기를 중복 신고하지 못하도록 UNIQUE(review_id, reporter_member_id).
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

try:
    import paramiko
except ImportError:
    print("paramiko 필요. (pip install paramiko)", file=sys.stderr)
    sys.exit(2)

TARGETS = [
    {
        "label": "test",
        "host": "172.235.211.75",
        "env_file": "/data/wwwroot/api.sajumoon.kr/.env",
    },
    {
        "label": "prod",
        "host": "104.64.128.103",
        "env_file": "/data/wwwroot/api.sajumoon.co.kr/.env",
    },
]

SQL = """
-- 이름 통일: 컨벤션에 맞춰 post_ prefix 사용 (post_review, post_qna 와 일관). 이전 review_report 는 제거.
DROP TABLE IF EXISTS review_report;

CREATE TABLE IF NOT EXISTS post_review_report (
  id BIGSERIAL PRIMARY KEY,
  review_id BIGINT NOT NULL REFERENCES post_review(id) ON DELETE CASCADE,
  reporter_member_id BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  reason_category VARCHAR(50) NOT NULL,
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  admin_memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by BIGINT REFERENCES member(id),
  CONSTRAINT post_review_report_unique_per_reporter UNIQUE (review_id, reporter_member_id)
);

-- 기존 테이블에 resolved_by 컬럼이 없으면 추가 (idempotent — 이미 적용된 환경 대응)
ALTER TABLE post_review_report ADD COLUMN IF NOT EXISTS resolved_by BIGINT REFERENCES member(id);

CREATE INDEX IF NOT EXISTS idx_post_review_report_review_id ON post_review_report (review_id);
CREATE INDEX IF NOT EXISTS idx_post_review_report_status ON post_review_report (status);
CREATE INDEX IF NOT EXISTS idx_post_review_report_created_at ON post_review_report (created_at DESC);

-- 확인 출력
SELECT 'post_review_report' AS table_name,
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'post_review_report') AS column_count,
       (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_name = 'post_review_report') AS constraint_count;
"""


def apply_one(target: dict, password: str) -> int:
    label = target["label"]
    host = target["host"]
    env_file = target["env_file"]
    b64 = base64.b64encode(SQL.encode("utf-8")).decode("ascii")
    inner = (
        f'export DATABASE_URL=$(grep -E "^DATABASE_URL=" {env_file} | cut -d= -f2-) && '
        f'echo {b64} | base64 -d | psql "$DATABASE_URL"'
    )
    cmd = f"bash -lc {repr(inner)}"

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, 22, "root", password, allow_agent=False, look_for_keys=False, timeout=20)
    try:
        _, stdout, stderr = client.exec_command(cmd, get_pty=False)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        print(f"========== {label} ({host}) ==========")
        sys.stdout.write(out)
        if err.strip():
            sys.stderr.write(err)
        rc = stdout.channel.recv_exit_status()
        print(f"---------- {label} exit code: {rc} ----------\n")
        return rc
    finally:
        client.close()


def main() -> int:
    password = os.environ.get("SSHPASS")
    if not password:
        print("SSHPASS env var 필요", file=sys.stderr)
        return 1
    overall = 0
    for t in TARGETS:
        rc = apply_one(t, password)
        if rc != 0:
            overall = rc
    return overall


if __name__ == "__main__":
    sys.exit(main())
