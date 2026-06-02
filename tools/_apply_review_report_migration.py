"""post_review_report 테이블 신설 — 양 서버(test + prod) 동시 적용 (2026-05-15).

* 사용자 후기 신고 시스템 Phase 2.
* SQL 안의 한글/quote 안전을 위해 base64 인코딩 후 디코딩 파이프 사용.
* 양 서버 모두 적용 — 한쪽만 적용 시 코드 배포 시 500 에러 발생.
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

SERVERS = [
    ("test", "172.235.211.75", "/data/wwwroot/api.sajumoon.kr/.env"),
    ("prod", "104.64.128.103", "/data/wwwroot/api.sajuplan.com/.env"),
]

SQL = """
-- 후기 신고 테이블 — 사용자가 비방·악성 후기를 신고하면 어드민이 검토.
CREATE TABLE IF NOT EXISTS post_review_report (
  id BIGSERIAL PRIMARY KEY,
  review_id BIGINT NOT NULL REFERENCES post_review(id) ON DELETE CASCADE,
  reporter_member_id BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  -- 카테고리: 'abuse'(욕설/비방), 'false'(허위), 'ad'(광고/스팸), 'privacy'(개인정보), 'other'(기타)
  reason_category VARCHAR(50) NOT NULL DEFAULT 'other',
  -- 자유 입력 신고 사유 (선택)
  reason TEXT,
  -- 처리 상태: 'pending'/'reviewed'/'hidden'/'dismissed'
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- 어드민 처리 메모
  admin_memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by BIGINT REFERENCES member(id),
  -- 한 사용자가 같은 후기를 중복 신고 못함
  CONSTRAINT post_review_report_unique UNIQUE (review_id, reporter_member_id)
);

CREATE INDEX IF NOT EXISTS idx_post_review_report_review ON post_review_report (review_id);
CREATE INDEX IF NOT EXISTS idx_post_review_report_status ON post_review_report (status);
CREATE INDEX IF NOT EXISTS idx_post_review_report_created ON post_review_report (created_at DESC);
"""


def apply(server_name: str, host: str, env_file: str, pw: str) -> int:
    b64 = base64.b64encode(SQL.encode("utf-8")).decode("ascii")
    inner = (
        f'export DATABASE_URL=$(grep -E "^DATABASE_URL=" {env_file} | cut -d= -f2-) && '
        f'echo {b64} | base64 -d | psql "$DATABASE_URL"'
    )
    cmd = f"bash -lc {repr(inner)}"

    print(f"\n=== {server_name} ({host}) ===")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    try:
        _, stdout, stderr = client.exec_command(cmd, get_pty=False)
        sys.stdout.write(stdout.read().decode("utf-8", errors="replace"))
        err = stderr.read().decode("utf-8", errors="replace")
        if err.strip():
            sys.stderr.write(err)
        return stdout.channel.recv_exit_status()
    finally:
        client.close()


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS env var 필요", file=sys.stderr)
        return 1
    rc_total = 0
    for name, host, env_file in SERVERS:
        rc = apply(name, host, env_file, pw)
        if rc != 0:
            print(f"✗ {name} 적용 실패 rc={rc}", file=sys.stderr)
            rc_total = rc
    return rc_total


if __name__ == "__main__":
    sys.exit(main())
