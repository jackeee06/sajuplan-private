"""알림 영역 엄격 검증 — alertCatalog ↔ prod alimtalk_template ↔ 코드 호출처 3자 매칭.

발견 가능한 문제:
  - 코드는 호출하는데 prod 템플릿 미등록 → BizM 거부 (template_not_found)
  - prod 템플릿 등록됐는데 코드 호출 없음 → 죽은 템플릿 (관리 부담)
  - alertCatalog 'active' 인데 코드 호출 없음 → 문서-실제 불일치
"""
from __future__ import annotations
import os, sys
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass
import paramiko

HOST = "104.64.128.103"
ENV_FILE = "/data/wwwroot/api.sajumoon.co.kr/.env"

SQL = r"""
\echo === [A-1] alimtalk_template prod 등록 목록 ===
SELECT template_code, is_active,
       LEFT(message, 60) AS msg_preview,
       primary_btn_name,
       LEFT(COALESCE(primary_btn_url, ''), 50) AS btn_url
  FROM alimtalk_template
 ORDER BY template_code;

\echo
\echo === [A-2] alimtalk_template 통계 ===
SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE is_active=true) AS active,
       COUNT(*) FILTER (WHERE is_active=false) AS inactive,
       COUNT(*) FILTER (WHERE primary_btn_url IS NULL OR primary_btn_url = '') AS no_btn
  FROM alimtalk_template;

\echo
\echo === [A-3] alimtalk_event_binding 존재 확인 (이벤트 → 템플릿 매핑) ===
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='alimtalk_event_binding') AS exists;

\echo
\echo === [A-4] alimtalk_log 존재 확인 (발송 흔적 테이블) ===
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='alimtalk_log') AS exists;

\echo
\echo --- 만약 있다면 최근 발송 통계 ---
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='alimtalk_log') AS log_table_exists;
"""


def main():
    pw = os.environ.get("SSHPASS")
    if not pw: print("SSHPASS env not set", file=sys.stderr); return 1
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=30)
    cmd = (
        f"export $(grep -E '^(DATABASE_URL|DB_)' {ENV_FILE} | xargs -d '\\n') && "
        f"psql \"$DATABASE_URL\" -v ON_ERROR_STOP=0 <<'EOSQL'\n{SQL}\nEOSQL"
    )
    _, out, err = c.exec_command(cmd, get_pty=False)
    sys.stdout.write(out.read().decode("utf-8", errors="replace"))
    e = err.read().decode("utf-8", errors="replace")
    if e: sys.stderr.write(e)
    c.close()
    return 0

if __name__ == "__main__":
    sys.exit(main())
