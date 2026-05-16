"""footer.business_name 키 추가 (양 서버) — 상호명 '주식회사 오리진하우스'."""
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

# setting 테이블 (단수) — namespace + key 분리 스키마.
# footer.business_name = '주식회사 오리진하우스' UPSERT.
SQL = """
-- 기존 footer.* 키 확인 (참조용)
SELECT namespace, key, value FROM setting WHERE namespace = 'footer' ORDER BY key;

-- UPSERT: 이미 있으면 값 갱신, 없으면 신규 INSERT
INSERT INTO setting (namespace, key, value)
VALUES ('footer', 'business_name', '주식회사 오리진하우스')
ON CONFLICT (namespace, key) DO UPDATE SET value = EXCLUDED.value
RETURNING namespace, key, value;
"""


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        return 1
    b64 = base64.b64encode(SQL.encode("utf-8")).decode("ascii")
    rc_total = 0
    for label, host, env_file in TARGETS:
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
        inner = (
            f'export DATABASE_URL=$(grep -E "^DATABASE_URL=" {env_file} | cut -d= -f2-) && '
            f'echo {b64} | base64 -d | psql "$DATABASE_URL"'
        )
        _, stdout, stderr = c.exec_command(f"bash -lc {repr(inner)}", get_pty=False)
        print(f"========== {label} ({host}) ==========")
        sys.stdout.write(stdout.read().decode("utf-8", errors="replace"))
        err = stderr.read().decode("utf-8", errors="replace")
        if err.strip():
            sys.stderr.write(err)
        rc = stdout.channel.recv_exit_status()
        if rc != 0:
            rc_total = rc
        c.close()
    return rc_total


if __name__ == "__main__":
    sys.exit(main())
