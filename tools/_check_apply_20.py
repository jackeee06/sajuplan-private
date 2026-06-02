#!/usr/bin/env python3
"""prod 의 post_apply #20 + 관련 member 상태를 정확히 조회 — 라온선생 검증용."""
import os, sys, paramiko
for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding="utf-8", errors="replace")
    except: pass

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('104.64.128.103', port=22, username='root',
            password=os.environ['SSHPASS'],
            timeout=15, look_for_keys=False, allow_agent=False)

# 원격에 임시 SQL 스크립트 만들고 psql 호출 — escape 지옥 회피
sql = r"""
\pset border 2
\pset format aligned

SELECT '== post_apply #20 ==' AS section;
SELECT id, status, member_id, applicant_phone,
       extras->>'mb_id'                     AS mb_id,
       length(extras->>'password_hash')     AS pw_hash_len,
       extras->>'pen_name'                  AS pen_name,
       extras->>'real_name'                 AS real_name,
       category
  FROM post_apply WHERE id = 20;

SELECT '== member by applicant_phone of #20 ==' AS section;
SELECT id, mb_id, role, length(password) AS pw_len,
       social_provider, phone, left_at IS NULL AS active
  FROM member
 WHERE phone = (SELECT applicant_phone FROM post_apply WHERE id = 20)
   AND left_at IS NULL;

SELECT '== counselor m2net link state ==' AS section;
SELECT id, mb_id, nickname, role, state,
       csrid, dtmfno, telno, counselor_category,
       call_070_unit_cost, chat_unit_cost
  FROM member WHERE id = 123;

SELECT '== post_apply 승인 후 extras 변동 ==' AS section;
SELECT extras->>'created_member_id' AS created_member_id,
       extras->>'accepted_at'       AS accepted_at,
       extras->>'m2net_csrid'       AS m2net_csrid,
       extras->>'m2net_error'       AS m2net_error
  FROM post_apply WHERE id = 20;
"""

# 1) SQL 파일 업로드
sftp = ssh.open_sftp()
with sftp.open('/tmp/_check_apply_20.sql', 'w') as f:
    f.write(sql)
sftp.close()

# 2) DATABASE_URL 추출 후 psql
script = '''
set -e
cd /data/wwwroot/api.sajumoon.co.kr
if [ -f .env ]; then ENVFILE=.env
elif [ -f .env.production ]; then ENVFILE=.env.production
else echo "NO .env"; exit 1; fi
DBURL=$(grep -E "^DATABASE_URL=" $ENVFILE | head -1 | sed "s/^DATABASE_URL=//; s/^['\\\"]//; s/['\\\"]\\$//")
if [ -z "$DBURL" ]; then echo "NO DATABASE_URL in $ENVFILE"; exit 1; fi
echo "[env file: $ENVFILE]"
psql "$DBURL" -f /tmp/_check_apply_20.sql
rm -f /tmp/_check_apply_20.sql
'''
stdin, stdout, stderr = ssh.exec_command(script, timeout=30)
out = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
print(out)
if err.strip(): print('STDERR:', err)
ssh.close()
