#!/usr/bin/env python3
import os, sys, paramiko
for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

DB = "postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', os.environ['SSHPASS'], allow_agent=False, look_for_keys=False, timeout=15)

def q(sql, label=""):
    if label: print(f"\n[{label}]")
    _, o, e = c.exec_command(f'psql {DB} -c "{sql}"', timeout=20)
    out = o.read().decode('utf-8','replace').strip()
    err = e.read().decode('utf-8','replace').strip()
    if out: print(out)
    if err and 'NOTICE' not in err: print("ERR:", err[:200])

# coupon 관련 테이블
q("SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%coupon%' ORDER BY table_name", "쿠폰 관련 테이블")
q("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'coupon_zone' ORDER BY ordinal_position", "coupon_zone 컬럼")
q("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'coupon' ORDER BY ordinal_position", "coupon 컬럼")
q("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'member_coupon' ORDER BY ordinal_position LIMIT 20", "member_coupon 컬럼 (2)")

# point 테이블
q("SELECT * FROM point WHERE member_id IN (140, 141)", "point (e2e_member, e2e_dual)")

# member 컬럼 (csrid 관련)
q("SELECT column_name FROM information_schema.columns WHERE table_name = 'member' AND column_name ILIKE '%csrid%'", "member.csrid 컬럼")
q("SELECT id, mb_id, csrid, m2net_membid FROM member WHERE mb_id IN ('e2e_member','e2e_dual','dummy_01')", "e2e 계정 m2net ID")

# consultation 최신 구조
q("SELECT column_name FROM information_schema.columns WHERE table_name='consultation' ORDER BY ordinal_position", "consultation 컬럼")

# post_review 구조
q("SELECT column_name FROM information_schema.columns WHERE table_name='post_review' ORDER BY ordinal_position", "post_review 컬럼")

c.close()
