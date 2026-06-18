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

# 새 공식: estimated = priceTot - floor(priceTot*0.033),  priceTot = this_m + (other_plus - other_minus) (earning만)
print('=== 새 공식(부가세X·회선비X·원천세3.3%만) 결과 — 이번달 수익 있는 상담사 ===')
print(q("""
WITH b AS (
  SELECT m.id, m.nickname,
    (SELECT COALESCE(SUM(earn_point),0) FROM point_history p WHERE p.member_id=m.id AND earn_point>0
       AND rel_table='consultation' AND content LIKE '%상담코인 증가%'
       AND to_char(p.created_at,'YYYY-MM')=to_char(CURRENT_DATE,'YYYY-MM')) AS this_m,
    (SELECT COALESCE(SUM(earn_point),0) FROM point_history p WHERE p.member_id=m.id AND earn_point>0 AND balance_kind='earning'
       AND (rel_table IS NULL OR rel_table NOT IN ('consultation','member','@member','@thesaju_consulting','@platform_consulting'))
       AND to_char(p.created_at,'YYYY-MM')=to_char(CURRENT_DATE,'YYYY-MM')) AS op,
    (SELECT COALESCE(SUM(use_point),0) FROM point_history p WHERE p.member_id=m.id AND use_point>0 AND balance_kind='earning'
       AND (rel_table IS NULL OR rel_table NOT IN ('consultation','member','@member','@thesaju_consulting','@platform_consulting'))
       AND to_char(p.created_at,'YYYY-MM')=to_char(CURRENT_DATE,'YYYY-MM')) AS om
  FROM member m WHERE m.role='counselor' AND m.left_at IS NULL
)
SELECT id, nickname, this_m AS 상담수익, (op-om) AS 기타,
   (this_m+op-om) AS priceTot,
   floor((this_m+op-om)*0.033) AS 원천세,
   GREATEST(0,(this_m+op-om) - floor((this_m+op-om)*0.033)) AS 정산금액_신공식
FROM b WHERE this_m>0 OR op>0 OR om>0
ORDER BY priceTot DESC;
"""))
c.close()
