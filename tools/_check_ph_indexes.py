#!/usr/bin/env python3
import os, sys, paramiko
for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

DB = "postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', os.environ['SSHPASS'],
          allow_agent=False, look_for_keys=False, timeout=15)

def q(sql, label=""):
    if label: print(f"\n[{label}]")
    _, o, _ = c.exec_command(f"psql {DB} -c \"{sql}\"", timeout=15)
    print(o.read().decode('utf-8', 'replace').strip())

# 현재 point_history 인덱스
q("SELECT indexname, indexdef FROM pg_indexes WHERE tablename='point_history' ORDER BY indexname", "point_history 인덱스")

# rel_action 중복 현황
q("""
  SELECT rel_action, member_id, COUNT(*) AS cnt
    FROM point_history
   WHERE rel_action LIKE 'review_best:%'
   GROUP BY rel_action, member_id
   ORDER BY cnt DESC
""", "review_best 중복 현황")

c.close()
