"""월아신녀 phone 복원 + 모든 회원 phone 길이 전수 검사."""
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)

sql = r"""
BEGIN;

\echo === [1] 모든 회원 phone 길이 검사 — 7자리 이하 (마스킹 손실 의심) ===
SELECT id, mb_id, name, nickname, role, phone, LENGTH(phone) AS len
  FROM member
 WHERE phone IS NOT NULL AND phone != '' AND LENGTH(phone) < 10
 ORDER BY id;

\echo
\echo === [2] 월아신녀 복원 ===
UPDATE member SET phone='01031773396', telno='01031773396', updated_at=NOW()
 WHERE id=134;

\echo
\echo === [3] 복원 검증 ===
SELECT id, mb_id, name, phone, LENGTH(phone) FROM member WHERE id=134;

COMMIT;

\echo
\echo === [4] 다른 손상된 phone 자동 복원 시도 — post_apply 의 정상 phone 으로 ===
\echo (수동 — 다음 세션에서 사장님 결정 후 처리)
SELECT m.id, m.mb_id, m.name, m.phone AS cur_phone, LENGTH(m.phone) AS cur_len,
       pa.extras->>'mb_id' AS apply_mb_id,
       pa.extras::text AS extras_preview
  FROM member m
  LEFT JOIN post_apply pa ON pa.member_id = m.id
 WHERE m.phone IS NOT NULL AND LENGTH(m.phone) < 10
 ORDER BY m.id;
"""
cmd = f'psql $(grep "^DATABASE_URL" /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) -v ON_ERROR_STOP=1 <<\'EOSQL\'\n{sql}\nEOSQL'
_, o, e = c.exec_command(cmd, get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
err = e.read().decode("utf-8", errors="replace")
if err: print("STDERR:", err[:500])
c.close()
