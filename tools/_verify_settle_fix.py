# -*- coding: utf-8 -*-
import os, io, sys
from pathlib import Path
import paramiko
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

pw = os.environ.get('SSHPASS')
if not pw:
    for l in Path('.env.local').read_text(encoding='utf-8').splitlines():
        l = l.strip()
        if l.startswith('SSHPASS='):
            pw = l.split('=', 1)[1].strip('\'"'); break

c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)
_, out, _ = c.exec_command('grep DATABASE_URL /data/wwwroot/api.sajumoon.co.kr/.env | head -1')
db = out.read().decode().strip().replace('DATABASE_URL=', '').strip('\'"')

def q(sql):
    _, o, e = c.exec_command('psql "%s" -P pager=off -c "%s"' % (db, sql.replace(chr(10), ' ').replace('"', '\\"')))
    return o.read().decode('utf-8', 'replace') + e.read().decode('utf-8', 'replace')

# 코드 공식 그대로: payout = max(0, floor(priceTot/1.1) - floor(floor(priceTot/1.1)*0.033) - (priceTot>=50000?20000:0))
# priceTot = thisMonth(상담earning) + other(기타). other_old = balance_kind 무시 / other_new = earning 만
print('=== 수정 전(버그) vs 수정 후 정산예상 — 이번달 적립 있는 상담사 ===')
print(q("""
WITH base AS (
  SELECT m.id, m.nickname,
    (SELECT COALESCE(SUM(earn_point),0) FROM point_history p
       WHERE p.member_id=m.id AND earn_point>0 AND rel_table='consultation'
         AND content LIKE '%상담코인 증가%' AND to_char(p.created_at,'YYYY-MM')=to_char(CURRENT_DATE,'YYYY-MM')) AS this_m,
    (SELECT COALESCE(SUM(earn_point),0) FROM point_history p
       WHERE p.member_id=m.id AND earn_point>0
         AND (rel_table IS NULL OR rel_table NOT IN ('consultation','member','@member','@thesaju_consulting','@platform_consulting'))
         AND to_char(p.created_at,'YYYY-MM')=to_char(CURRENT_DATE,'YYYY-MM')) AS other_old,
    (SELECT COALESCE(SUM(earn_point),0) FROM point_history p
       WHERE p.member_id=m.id AND earn_point>0 AND balance_kind='earning'
         AND (rel_table IS NULL OR rel_table NOT IN ('consultation','member','@member','@thesaju_consulting','@platform_consulting'))
         AND to_char(p.created_at,'YYYY-MM')=to_char(CURRENT_DATE,'YYYY-MM')) AS other_new
  FROM member m WHERE m.role='counselor' AND m.left_at IS NULL
), calc AS (
  SELECT id, nickname, this_m, other_old, other_new,
    (this_m+other_old) AS tot_old, (this_m+other_new) AS tot_new
  FROM base WHERE this_m>0 OR other_old>0
)
SELECT id, nickname, this_m AS 상담earning, other_old AS 기타_버그, other_new AS 기타_수정,
  GREATEST(0, floor(tot_old/1.1) - floor(floor(tot_old/1.1)*0.033) - CASE WHEN tot_old>=50000 THEN 20000 ELSE 0 END) AS 정산_버그전,
  GREATEST(0, floor(tot_new/1.1) - floor(floor(tot_new/1.1)*0.033) - CASE WHEN tot_new>=50000 THEN 20000 ELSE 0 END) AS 정산_수정후
FROM calc ORDER BY other_old DESC;
"""))
c.close()
