"""읽기전용: inquiry 테이블 정체 확인."""
import os, sys, re, paramiko

pw = None
with open(os.path.join(os.path.dirname(__file__), "..", ".env.local"), encoding="utf-8") as f:
    for line in f:
        m = re.match(r"\s*SSHPASS\s*=\s*'?([^'\n]+)'?", line)
        if m:
            pw = m.group(1)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=25)

SQL = r"""
\echo '===== inquiry 컬럼 ====='
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_schema='public' AND table_name='inquiry' ORDER BY ordinal_position;
\echo ''
\echo '===== inquiry 전체 건수 ====='
SELECT count(*) AS inquiry_total FROM inquiry;
\echo ''
\echo '===== inquiry 최근 10건 (개인정보 최소) ====='
SELECT * FROM inquiry ORDER BY 1 DESC LIMIT 10;
\echo ''
\echo '===== counselor_qna_reply 건수 (상담사 문의 답변?) ====='
SELECT count(*) FROM counselor_qna_reply;
"""

cmd = (
    "cd /data/wwwroot/api.sajumoon.co.kr && "
    "DBURL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '\"') && "
    "PGCLIENTENCODING=UTF8 psql \"$DBURL\" -v ON_ERROR_STOP=0 -x <<'EOSQL'\n" + SQL + "\nEOSQL"
)
_, out, err = client.exec_command(cmd, get_pty=False)
sys.stdout.write(out.read().decode("utf-8", errors="replace"))
e = err.read().decode("utf-8", errors="replace")
if e:
    sys.stderr.write("\n[stderr]\n" + e)
client.close()
