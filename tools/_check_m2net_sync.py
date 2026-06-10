#!/usr/bin/env python3
"""m2net 잔액 미동기화 사용자 점검 + 동기화 실행."""
import os, sys
import paramiko

for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

DB = "postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon"
HOST = "104.64.128.103"

def ssh():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, 'root', os.environ['SSHPASS'],
              allow_agent=False, look_for_keys=False, timeout=20)
    return c

def run(c, sql):
    _, o, e = c.exec_command(f"psql {DB} -t -A -F'|' -c \"{sql}\"", timeout=30)
    out = o.read().decode('utf-8', errors='replace').strip()
    err = e.read().decode('utf-8', errors='replace').strip()
    if err: print(f"[WARN] {err[:200]}", file=sys.stderr)
    return [r.split('|') for r in out.splitlines() if r]

c = ssh()

# 1) 쿠폰/비결제 코인 보유자 (m2net_membid 있음 = m2net 등록자)
print("=== 쿠폰으로 코인 받은 사용자 ===")
rows = run(c, """
  SELECT DISTINCT ON (m.id)
         m.id, m.mb_id, m.nickname, m.point, m.m2net_membid,
         ph.earn_point, ph.content, ph.created_at::date
    FROM point_history ph
    JOIN member m ON m.id = ph.member_id
   WHERE ph.rel_action = 'coupon_use'
     AND m.point > 0
     AND m.m2net_membid IS NOT NULL
   ORDER BY m.id, ph.created_at DESC
""")
print(f"{'ID':>6} {'mb_id':>20} {'닉네임':>10} {'코인':>7} {'m2net_membid':>12} {'쿠폰코인':>8} {'날짜'}")
print("-"*80)
for r in rows:
    print(f"{r[0]:>6} {r[1]:>20} {r[2]:>10} {r[3]:>7} {r[4]:>12} {r[5]:>8} {r[7]}")

print(f"\n총 {len(rows)}명")

# 2) 관리자 수동 지급 (admin_adjust) 코인 보유자
print("\n=== 관리자 수동 지급 코인 보유자 ===")
rows2 = run(c, """
  SELECT DISTINCT ON (m.id)
         m.id, m.mb_id, m.nickname, m.point, m.m2net_membid,
         ph.earn_point, ph.created_at::date
    FROM point_history ph
    JOIN member m ON m.id = ph.member_id
   WHERE ph.rel_action = 'admin_adjust'
     AND ph.earn_point > 0
     AND m.point > 0
     AND m.m2net_membid IS NOT NULL
   ORDER BY m.id, ph.created_at DESC
""")
print(f"{'ID':>6} {'mb_id':>20} {'닉네임':>10} {'코인':>7} {'m2net_membid':>12} {'지급코인':>8} {'날짜'}")
print("-"*80)
for r in rows2:
    print(f"{r[0]:>6} {r[1]:>20} {r[2]:>10} {r[3]:>7} {r[4]:>12} {r[5]:>8} {r[6]}")

print(f"\n총 {len(rows2)}명")

# 3) 전체 member.point > 0 이고 paid 결제 없는 사람 (순 무료 코인 보유)
print("\n=== 결제 없이 코인 보유 (m2net 미동기화 위험군) ===")
rows3 = run(c, """
  SELECT m.id, m.mb_id, m.nickname, m.point, m.m2net_membid
    FROM member m
   WHERE m.point > 0
     AND m.m2net_membid IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM payment p
        WHERE p.member_id = m.id AND p.status = 'paid'
     )
   ORDER BY m.point DESC
""")
print(f"{'ID':>6} {'mb_id':>20} {'닉네임':>10} {'코인':>7} {'m2net_membid':>12}")
print("-"*60)
for r in rows3:
    print(f"{r[0]:>6} {r[1]:>20} {r[2]:>10} {r[3]:>7} {r[4]:>12}")
print(f"\n총 {len(rows3)}명")

c.close()
