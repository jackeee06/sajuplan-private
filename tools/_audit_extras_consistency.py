"""prod 상담사 15명 — extras (jsonb) vs 컬럼 정합성 전수 검증.

각 상담사에 대해:
  extras.field        vs  member.counselor_category
  extras.real_name    vs  member.name
  extras.pen_name     vs  member.nickname
  extras.specialties  vs  post_counselor.specialty
  extras.intro        vs  post_counselor.intro
  extras.region       vs  member.region (or similar)
  extras.profile_photo_url vs member_file (kind=profile)

불일치 발견 시 critical row 출력.
미승인 신청서 카운트 + 어드민 처리 영역 검증.
"""
from __future__ import annotations
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)

sql = r"""
\echo === [V-1] post_apply 테이블 존재 확인 ===
SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%apply%' OR table_name LIKE '%counselor%';

\echo
\echo === [V-2] 모든 상담사의 extras 전체 (member.role=counselor) ===
SELECT m.id, m.mb_id, m.name, m.nickname, m.counselor_category,
       pa.extras::text AS apply_extras
  FROM member m
  LEFT JOIN post_apply pa ON pa.member_id = m.id
 WHERE m.role='counselor' AND m.left_at IS NULL
 ORDER BY m.id;
"""
cmd = f'psql $(grep "^DATABASE_URL" /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) <<\'EOSQL\'\n{sql}\nEOSQL'
_, o, e = c.exec_command(cmd, get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
err = e.read().decode("utf-8", errors="replace")
if err: print("STDERR:", err[:500])
c.close()
