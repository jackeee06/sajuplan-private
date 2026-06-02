"""D: ubuub1234 member.point drift 현재 상태 확인."""
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)

sql = """
SELECT m.id, m.mb_id, m.name, m.role, m.point AS member_point,
       p.free_balance, p.paid_balance, p.earning_balance,
       (p.free_balance + p.paid_balance) AS computed_consumer,
       m.point - (p.free_balance + p.paid_balance) AS drift_vs_consumer
  FROM member m
  JOIN point p ON p.member_id = m.id
 WHERE m.mb_id = 'ubuub1234';

-- 전체 C-8 drift 재확인 (오늘 정리 후 0이어야 함)
SELECT COUNT(*) AS c8_drift_cnt
  FROM member m JOIN point p ON p.member_id = m.id
 WHERE m.point != (p.free_balance + p.paid_balance);
"""
cmd = f'psql $(grep "^DATABASE_URL" /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) -c "{sql}"'
_, o, _ = c.exec_command(cmd, get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
c.close()
