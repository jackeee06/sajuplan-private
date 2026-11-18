"""배포된 콜백 원자 claim 로직 결정적 검증. BEGIN..ROLLBACK 이라 실DB 무오염, 실회원 알림 0.
   상담사=91(찬물선생), 요청 member_id 도 91(본인)로 세팅 → 어떤 실회원도 관여 안 함."""
import os, sys, paramiko
pw = os.environ.get('SSHPASS')
if not pw: sys.exit(2)
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw, timeout=20,
          look_for_keys=False, allow_agent=False)

# 배포된 counselors.service.ts 의 claim 쿼리와 100% 동일한 SQL 을 재현.
SQL = r"""
BEGIN;

-- 0) 테스트 상담사(91)로 24h 내 요청 2건 + 24h 초과 요청 1건(무시돼야) INSERT. member_id 도 91(본인).
INSERT INTO counselor_request_alert (counselor_id, member_id, requested_at, channel, callback_sent_at)
VALUES (91, 91, now(),                 'chat',  NULL),
       (91, 91, now() - interval '1 hour', 'phone', NULL),
       (91, 91, now() - interval '30 hours','chat', NULL);   -- 24h 초과 → claim 대상 아님

\echo '=== STEP1: 첫 claim (UPDATE..RETURNING) — 배포코드와 동일 쿼리. 24h내 2건만 잡혀야 ==='
UPDATE counselor_request_alert
   SET callback_sent_at = now()
 WHERE counselor_id = 91
   AND callback_sent_at IS NULL
   AND requested_at > now() - interval '24 hours'
RETURNING id, member_id, channel;

\echo '=== STEP2: 즉시 재실행 (동시토글/재켜기 시뮬) — 0건이어야(재발송 방지) ==='
UPDATE counselor_request_alert
   SET callback_sent_at = now()
 WHERE counselor_id = 91
   AND callback_sent_at IS NULL
   AND requested_at > now() - interval '24 hours'
RETURNING id, member_id, channel;

\echo '=== STEP3: claim 이후 신규 요청 1건 들어옴(레이스 시뮬) ==='
INSERT INTO counselor_request_alert (counselor_id, member_id, requested_at, channel, callback_sent_at)
VALUES (91, 91, now(), 'phone', NULL) RETURNING id AS new_req_id;

\echo '=== STEP4: 다음 상담가능 켜기 — 신규 1건만 잡혀야(유실 없음, BUG1 방지 증명) ==='
UPDATE counselor_request_alert
   SET callback_sent_at = now()
 WHERE counselor_id = 91
   AND callback_sent_at IS NULL
   AND requested_at > now() - interval '24 hours'
RETURNING id, member_id, channel;

\echo '=== STEP5: 24h 초과 건은 여전히 미마킹(NULL) — 다음 요청때 아니라 그냥 방치 확인 ==='
SELECT id, callback_sent_at IS NULL AS still_null, requested_at
  FROM counselor_request_alert
 WHERE counselor_id = 91 AND requested_at < now() - interval '24 hours'
 ORDER BY id DESC LIMIT 1;

ROLLBACK;
\echo '=== ROLLBACK 완료 — 실DB 무변경 ==='
"""
tmp = f'/tmp/vfy_cb_{os.getpid()}.sql'
i, o, _ = c.exec_command(f'cat > {tmp}')
i.write(SQL); i.channel.shutdown_write(); o.channel.recv_exit_status()
_, env, _ = c.exec_command('grep ^DATABASE_URL= /data/wwwroot/api.sajumoon.co.kr/.env')
db_url = env.read().decode().strip().split('=', 1)[1].strip().strip('"').strip("'")
_, out, err = c.exec_command(f'psql "{db_url}" -e -f {tmp} && rm -f {tmp}', timeout=30)
print(out.read().decode())
e = err.read().decode()
if e.strip(): print("STDERR:", e)
c.close()
