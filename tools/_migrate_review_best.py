"""post_review 에 베스트 후기 컬럼 추가 (2026-05-15 Phase 1).

- is_best BOOLEAN DEFAULT false — 베스트 후기 여부
- best_at TIMESTAMPTZ — 베스트 선정 시각 (정렬용. 해제 시 NULL)
- partial index: 베스트만 조회 빠르게
- 상담사당 5개 제한은 백엔드에서 강제 (DB 제약 미설정 — 운영 정책 변동 가능성)
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
ALTER TABLE post_review ADD COLUMN IF NOT EXISTS is_best BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE post_review ADD COLUMN IF NOT EXISTS best_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_post_review_best
   ON post_review (counselor_id, best_at DESC)
   WHERE is_best = true;

SELECT 'post_review' AS table_name,
       (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_name = 'post_review' AND column_name IN ('is_best','best_at')) AS new_cols,
       (SELECT COUNT(*) FROM post_review WHERE is_best = true) AS current_best;
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
