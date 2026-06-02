#!/usr/bin/env python3
"""prod consultation #64 (라온선생 7초 통화) 상담사 적립 수동 보전.

회사 정책 (2026-05-22 재확인):
  단기통화환불 정책으로 회원 차감은 skip 됐으나 상담사 적립이 누락된 상태.
  amt=1000 (라온선생 단가 그대로) 만큼 보전.

멱등성: point_history.UNIQUE(rel_table, rel_id, rel_action) — 같은 rel_action 으로
재실행해도 INSERT 안 됨.
"""
import os, sys, paramiko
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('104.64.128.103', port=22, username='root',
            password=os.environ['SSHPASS'],
            timeout=15, look_for_keys=False, allow_agent=False)

sql = r"""
\pset border 2
\pset format aligned

BEGIN;

-- 1. point 행 확보 (idempotent — 이미 있으면 NOOP)
INSERT INTO point (member_id, free_balance, paid_balance, total_earned, total_used)
VALUES (123, 0, 0, 0, 0)
ON CONFLICT (member_id) DO NOTHING;

-- 2. 적립 INSERT — rel_action UNIQUE 로 멱등성 보장
WITH cur AS (
  SELECT free_balance, paid_balance FROM point WHERE member_id = 123 FOR UPDATE
),
ins AS (
  INSERT INTO point_history (
    member_id, content, earn_point, use_point, balance_after,
    rel_table, rel_id, rel_action,
    is_paid, is_expired, expire_date, actor_type
  )
  SELECT 123, '전화상담코인 증가 (단기통화 적립 보전 - 2026-05-22)',
         1000, 0, free_balance + paid_balance + 1000,
         'consultation', '64', '64@상담코인 증가@backfill-2026-05-22',
         false, false, NULL, 'system'
    FROM cur
  ON CONFLICT (rel_table, rel_id, rel_action)
    WHERE rel_table IN ('payment','payment_autopay','consultation')
    DO NOTHING
  RETURNING id
)
UPDATE point SET
  paid_balance = paid_balance + 1000,
  total_earned = total_earned + 1000,
  updated_at = now()
 WHERE member_id = 123
   AND EXISTS (SELECT 1 FROM ins);

-- 3. 결과 확인
SELECT '== 보전 결과 ==' AS section;
SELECT member_id, free_balance, paid_balance, total_earned, total_used,
       to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at
  FROM point WHERE member_id = 123;

SELECT id, content, earn_point, balance_after, rel_table, rel_id, rel_action,
       to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at
  FROM point_history
 WHERE rel_table = 'consultation' AND rel_id = '64'
 ORDER BY id;

COMMIT;
"""

sftp = ssh.open_sftp()
with sftp.open('/tmp/_backfill_64.sql', 'w') as f:
    f.write(sql)
sftp.close()

script = '''
set -e
cd /data/wwwroot/api.sajumoon.co.kr
DBURL=$(grep -E "^DATABASE_URL=" .env | head -1 | sed "s/^DATABASE_URL=//; s/^['\\"]//; s/['\\"]\\$//")
psql "$DBURL" -f /tmp/_backfill_64.sql
rm -f /tmp/_backfill_64.sql
'''
stdin, stdout, stderr = ssh.exec_command(script, timeout=30)
print(stdout.read().decode('utf-8', errors='replace'))
err = stderr.read().decode('utf-8', errors='replace')
if err.strip(): print('STDERR:', err)
ssh.close()
