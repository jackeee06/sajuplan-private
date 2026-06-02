"""extras vs 컬럼 매칭 엄격 검증 — 6명 신청자 전수."""
from __future__ import annotations
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)

sql = r"""
\echo === [V-1] member 의 region/birth 컬럼 존재 확인 ===
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name='member' AND column_name IN ('region','birth','birth_date','agree_sms','agree_email','agree_privacy','agree_terms','push_all');

\echo
\echo === [V-2] 6명 신청자 매핑 — extras vs 컬럼 ===
SELECT
  m.id, m.mb_id, m.name AS m_name, m.nickname AS m_nick, m.counselor_category AS m_cat,
  pa.extras->>'real_name' AS e_name,
  pa.extras->>'pen_name' AS e_nick,
  pa.extras->>'field' AS e_cat,
  pa.extras->>'region' AS e_region,
  pa.extras->>'birth' AS e_birth,
  CASE WHEN m.name = pa.extras->>'real_name' THEN '✅' ELSE '❌' END AS name_match,
  CASE WHEN m.nickname = pa.extras->>'pen_name' THEN '✅' ELSE '❌' END AS nick_match,
  CASE WHEN m.counselor_category = pa.extras->>'field' THEN '✅' ELSE '❌' END AS cat_match
  FROM member m
  JOIN post_apply pa ON pa.member_id = m.id
 WHERE m.role='counselor'
 ORDER BY m.id;

\echo
\echo === [V-3] 6명 신청자 — extras.specialties vs post_counselor.specialty ===
SELECT m.id, m.mb_id, m.nickname,
       array_to_string(ARRAY(SELECT jsonb_array_elements_text(pa.extras->'specialties')), '|') AS e_specs,
       pc.specialty AS pc_specialty,
       CASE WHEN array_to_string(ARRAY(SELECT jsonb_array_elements_text(pa.extras->'specialties')), '|') = pc.specialty
            THEN '✅' ELSE '❌' END AS match
  FROM member m
  JOIN post_apply pa ON pa.member_id = m.id
  LEFT JOIN post_counselor pc ON pc.member_id = m.id
 WHERE m.role='counselor'
 ORDER BY m.id;

\echo
\echo === [V-4] 6명 신청자 — extras.intro vs post_counselor.intro ===
SELECT m.id, m.nickname,
       LEFT(pa.extras->>'intro', 50) AS e_intro_50,
       LEFT(pc.intro, 50) AS pc_intro_50,
       CASE WHEN pa.extras->>'intro' = pc.intro THEN '✅' ELSE '❌' END AS match
  FROM member m
  JOIN post_apply pa ON pa.member_id = m.id
  LEFT JOIN post_counselor pc ON pc.member_id = m.id
 WHERE m.role='counselor'
 ORDER BY m.id;

\echo
\echo === [V-5] 신청자 사진 — extras.profile_photo_url vs member_file ===
SELECT m.id, m.nickname,
       (pa.extras->>'profile_photo_url') IS NOT NULL AS has_extras_photo,
       (SELECT COUNT(*) FROM member_file mf WHERE mf.member_id=m.id AND mf.kind='profile') AS member_file_cnt
  FROM member m
  JOIN post_apply pa ON pa.member_id = m.id
 WHERE m.role='counselor'
 ORDER BY m.id;

\echo
\echo === [V-6] 미승인 신청서 (status != approved) ===
SELECT id, mb_id, extras->>'status' AS status, extras->>'approved_at' AS approved_at,
       extras->>'rejected_at' AS rejected_at, created_at::date
  FROM post_apply
 WHERE extras->>'approved_at' IS NULL OR extras->>'status' != '상담사 지원'
 ORDER BY id DESC LIMIT 10;

\echo
\echo === [V-7] dummy 9명 — post_apply 없이 어드민 직접 입력 (예상) ===
SELECT m.id, m.mb_id, m.nickname, m.counselor_category,
       (pa.id IS NULL) AS no_apply
  FROM member m
  LEFT JOIN post_apply pa ON pa.member_id = m.id
 WHERE m.role='counselor' AND pa.id IS NULL
 ORDER BY m.id;
"""
cmd = f'psql $(grep "^DATABASE_URL" /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) <<\'EOSQL\'\n{sql}\nEOSQL'
_, o, e = c.exec_command(cmd, get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
err = e.read().decode("utf-8", errors="replace")
if err: print("STDERR:", err[:500])
c.close()
