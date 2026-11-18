"""대시보드 "지금 상담 켜기" 카드 데이터원(getMyConsultRequests SQL) 검증.
   BEGIN..ROLLBACK 이라 실DB 무오염. 상담사=91(찬물선생), 요청자=289(바다)."""
import os, sys, paramiko
pw = os.environ.get('SSHPASS')
if not pw: sys.exit(2)
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw, timeout=20,
          look_for_keys=False, allow_agent=False)
_, env, _ = c.exec_command('grep ^DATABASE_URL= /data/wwwroot/api.sajumoon.co.kr/.env')
db_url = env.read().decode().strip().split('=', 1)[1].strip().strip('"').strip("'")

SQL = r"""
BEGIN;
\echo '-- 준비: 91에게 미응답 2건(전화/채팅) + 이미콜백1건(제외돼야) + 24h초과1건(제외돼야)'
INSERT INTO counselor_request_alert (counselor_id, member_id, requested_at, channel, callback_sent_at) VALUES
  (91, 289, now() - interval '2 minutes',  'phone', NULL),
  (91, 289, now() - interval '40 minutes', 'chat',  NULL),
  (91, 289, now() - interval '10 minutes', 'phone', now()),                      -- 이미 콜백 발송됨 → 제외
  (91, 289, now() - interval '30 hours',   'chat',  NULL);                        -- 24h 초과 → 제외

\echo '-- getMyConsultRequests 와 동일한 SQL: 미응답 2건만, 최신순, 닉네임 조인 되어야'
SELECT cra.id, m.nickname, cra.channel,
       round(extract(epoch from (now() - cra.requested_at))/60)::int AS mins_ago
  FROM counselor_request_alert cra
  JOIN member m ON m.id = cra.member_id
 WHERE cra.counselor_id = 91
   AND cra.callback_sent_at IS NULL
   AND cra.requested_at > now() - interval '24 hours'
 ORDER BY cra.requested_at DESC
 LIMIT 10;

\echo '-- 최종 반환 건수: 정확히 2 여야'
SELECT count(*) AS returned_rows
  FROM counselor_request_alert cra
 WHERE cra.counselor_id = 91 AND cra.callback_sent_at IS NULL
   AND cra.requested_at > now() - interval '24 hours';
ROLLBACK;
"""
tmp = f'/tmp/vfy_cr_{os.getpid()}.sql'
i, o, _ = c.exec_command(f'cat > {tmp}')
i.write(SQL); i.channel.shutdown_write(); o.channel.recv_exit_status()
_, out, err = c.exec_command(f'psql "{db_url}" -f {tmp} && rm -f {tmp}', timeout=30)
print(out.read().decode(errors='replace'))
e = err.read().decode(errors='replace')
if e.strip(): print("STDERR:", e)
c.close()
