"""prod — 활동(상담+후기)이 가장 많은 회원(role=member)의 비번을 '1234' 로 reset.

테스트 편의용 (2026-05-15).
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

SSH_HOST = "104.64.128.103"
API_REMOTE = "/data/wwwroot/api.sajuplan.com"
NEW_PASSWORD = "1234"
COST = 12  # auth.service.ts 와 동일


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS env 필요", file=sys.stderr)
        return 1

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(SSH_HOST, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)

    # Step 1: bcrypt 해시 생성 (서버의 node + bcrypt 사용).
    # node -e 의 quote escape 회피를 위해 base64 인코딩 후 디코드 트릭 사용.
    node_code = f"console.log(require('bcrypt').hashSync('{NEW_PASSWORD}', {COST}))"
    node_b64 = base64.b64encode(node_code.encode("utf-8")).decode("ascii")
    node_cmd = (
        f"cd {API_REMOTE} && "
        f"node -e \"$(echo {node_b64} | base64 -d)\""
    )
    _, stdout, stderr = client.exec_command(f"bash -lc {repr(node_cmd)}")
    bcrypt_hash = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace")
    if not bcrypt_hash or "$2" not in bcrypt_hash:
        print(f"✗ bcrypt 해시 생성 실패: {err}", file=sys.stderr)
        client.close()
        return 2
    print(f"✓ bcrypt 해시 생성 완료 ({len(bcrypt_hash)} chars)")

    # Step 2: 활동 많은 회원 찾기 + UPDATE (한 번에)
    sql = f"""
-- 혜안선생(sample_c07) 비번을 1234 로 reset
UPDATE member
   SET password = '{bcrypt_hash}',
       updated_at = now()
 WHERE mb_id = 'sample_c07'
RETURNING id, mb_id, nickname, name, role;
"""
    b64 = base64.b64encode(sql.encode("utf-8")).decode("ascii")
    sql_cmd = (
        f'export DATABASE_URL=$(grep -E "^DATABASE_URL=" {API_REMOTE}/.env | cut -d= -f2-) && '
        f'echo {b64} | base64 -d | psql "$DATABASE_URL"'
    )
    _, stdout, stderr = client.exec_command(f"bash -lc {repr(sql_cmd)}")
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    sys.stdout.write(out)
    if err.strip():
        sys.stderr.write(err)
    client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
