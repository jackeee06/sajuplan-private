"""월아신녀 흔적 전수 검색 (모든 컬럼)."""
from __future__ import annotations
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)

sql = r"""
\echo === [1] specialty 가 비어있는 상담사 9건 ===
SELECT m.id, m.mb_id, m.name, m.nickname, m.state,
       COALESCE(pc.title, '(없음)') AS title,
       COALESCE(pc.specialty, '(없음)') AS specialty,
       COALESCE(pc.hashtag1, '(없음)') AS h1,
       COALESCE(pc.hashtag2, '(없음)') AS h2
  FROM member m
  LEFT JOIN post_counselor pc ON pc.member_id = m.id
 WHERE m.role = 'counselor' AND m.left_at IS NULL
 ORDER BY m.id;

\echo
\echo === [2] member / post_counselor 의 모든 텍스트 컬럼에서 '월아' '신녀' '신점' 검색 ===
SELECT m.id, m.mb_id, m.name, m.nickname,
       pc.title, pc.headline, pc.intro, pc.specialty, pc.hashtag1, pc.hashtag2,
       pc.bio
  FROM member m
  LEFT JOIN post_counselor pc ON pc.member_id = m.id
 WHERE m.role = 'counselor'
   AND (
     m.name LIKE '%월아%' OR m.nickname LIKE '%월아%' OR m.name LIKE '%신녀%' OR m.nickname LIKE '%신녀%'
     OR pc.title LIKE '%월아%' OR pc.title LIKE '%신녀%' OR pc.title LIKE '%신점%'
     OR pc.headline LIKE '%월아%' OR pc.headline LIKE '%신점%'
     OR pc.intro LIKE '%월아%' OR pc.intro LIKE '%신점%'
     OR pc.bio LIKE '%월아%' OR pc.bio LIKE '%신점%'
   );
"""
cmd = f'psql $(grep "^DATABASE_URL" /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) <<\'EOSQL\'\n{sql}\nEOSQL'
_, o, _ = c.exec_command(cmd, get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
c.close()
