"""읽기전용: 상담사→운영자 고객센터 문의 관련 테이블/데이터 실재 확인."""
import os, sys, re, paramiko

# .env.local 에서 SSHPASS 로드
pw = None
with open(os.path.join(os.path.dirname(__file__), "..", ".env.local"), encoding="utf-8") as f:
    for line in f:
        m = re.match(r"\s*SSHPASS\s*=\s*'?([^'\n]+)'?", line)
        if m:
            pw = m.group(1)
pw = pw or os.environ.get("SSHPASS")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=25)

SQL = r"""
\echo '===== 1) qna/qa/inquiry/문의 관련 테이블 목록 ====='
SELECT table_name FROM information_schema.tables
 WHERE table_schema='public'
   AND (table_name ILIKE '%qna%' OR table_name ILIKE '%qa%' OR table_name ILIKE '%inquir%'
        OR table_name ILIKE '%cs%' OR table_name ILIKE '%문의%' OR table_name ILIKE '%post%')
 ORDER BY table_name;

\echo ''
\echo '===== 2) counselor_qna 컬럼 + 건수 ====='
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_schema='public' AND table_name='counselor_qna' ORDER BY ordinal_position;
SELECT count(*) AS counselor_qna_total FROM counselor_qna;

\echo ''
\echo '===== 3) post_qa(회원 상담문의) 건수 ====='
SELECT count(*) AS post_qa_total FROM post_qa;

\echo ''
\echo '===== 4) 화면 더미 문구가 DB에 실제로 있나 ====='
SELECT 'counselor_qna' AS src, count(*) FROM counselor_qna
  WHERE title ILIKE '%상담 예약도 되나요%' OR title ILIKE '%상담 가격 관련%' OR content ILIKE '%문의드립니다%';
"""

cmd = (
    "cd /data/wwwroot/api.sajumoon.co.kr && "
    "DBURL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '\"') && "
    "psql \"$DBURL\" -v ON_ERROR_STOP=0 <<'EOSQL'\n" + SQL + "\nEOSQL"
)
_, out, err = client.exec_command(cmd, get_pty=False)
sys.stdout.write(out.read().decode("utf-8", errors="replace"))
e = err.read().decode("utf-8", errors="replace")
if e:
    sys.stderr.write("\n[stderr]\n" + e)
client.close()
