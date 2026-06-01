"""월아신녀 + 신점 카테고리 필터 매칭 진단."""
from __future__ import annotations
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)

sql = r"""
\echo === [1] 월아신녀 + 신점 전문 상담사 전수 조회 ===
SELECT m.id, m.mb_id, m.name, m.nickname, m.role, m.state,
       pc.specialty, pc.hashtag1, pc.hashtag2,
       pc.use_phone, pc.use_chat
  FROM member m
  LEFT JOIN post_counselor pc ON pc.member_id = m.id
 WHERE m.role = 'counselor'
   AND (m.nickname LIKE '%월아%' OR m.name LIKE '%월아%' OR pc.specialty LIKE '%신점%')
 ORDER BY m.id;

\echo
\echo === [2] 전체 상담사 specialty 분포 ===
SELECT pc.specialty, COUNT(*) AS cnt
  FROM member m
  JOIN post_counselor pc ON pc.member_id = m.id
 WHERE m.role = 'counselor' AND m.left_at IS NULL
 GROUP BY pc.specialty
 ORDER BY cnt DESC;

\echo
\echo === [3] hashtag 분포 (신점/타로/사주 검색) ===
SELECT pc.hashtag1, pc.hashtag2, COUNT(*) AS cnt
  FROM member m
  JOIN post_counselor pc ON pc.member_id = m.id
 WHERE m.role = 'counselor' AND m.left_at IS NULL
   AND (pc.hashtag1 ~ '신점|타로|사주' OR pc.hashtag2 ~ '신점|타로|사주' OR pc.specialty ~ '신점|타로|사주')
 GROUP BY pc.hashtag1, pc.hashtag2
 ORDER BY cnt DESC;
"""
cmd = f'psql $(grep "^DATABASE_URL" /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) -v ON_ERROR_STOP=0 <<\'EOSQL\'\n{sql}\nEOSQL'
_, o, _ = c.exec_command(cmd, get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
c.close()
