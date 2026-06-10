#!/usr/bin/env python3
"""jackee point drift 원인 추적"""
import os, sys
import paramiko

for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

DB   = "postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon"
HOST = "104.64.128.103"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, 22, 'root', os.environ['SSHPASS'], allow_agent=False, look_for_keys=False, timeout=20)

def q(sql, label=""):
    if label: print(f"\n[{label}]")
    _, o, _ = c.exec_command(f'psql {DB} -c "{sql}"', timeout=20)
    print(o.read().decode('utf-8', errors='replace').strip())

# 1. 현재 상태
q("""
  SELECT m.point AS member_point, p.free_balance, p.paid_balance,
         m.point - (p.free_balance + p.paid_balance) AS drift
    FROM member m JOIN point p ON p.member_id = m.id
   WHERE m.id = 91
""", "1. 현재 상태")

# 2. 전체 point_history 시간순 (balance_after 추적)
q("""
  SELECT id, earn_point, use_point, balance_after,
         LEFT(content, 25) AS content, rel_action, balance_kind,
         created_at::date AS dt
    FROM point_history
   WHERE member_id = 91
   ORDER BY created_at ASC, id ASC
""", "2. jackee 전체 point_history (오래된 순)")

# 3. 결제(충전) 이력
q("""
  SELECT pay.id, pay.amount, pay.coin_amount, pay.status, pay.created_at::date
    FROM payment pay
   WHERE pay.member_id = 91
   ORDER BY pay.created_at
""", "3. jackee 결제(충전) 이력")

# 4. 채팅 선결제 코드에서 point 테이블 업데이트 여부 확인
# chat_room prepaid: member.point만 업데이트하고 point.paid_balance는 미업데이트?
q("""
  SELECT ph.id, ph.use_point, ph.balance_after, ph.rel_action, ph.content
    FROM point_history ph
   WHERE ph.member_id = 91
     AND ph.rel_action LIKE 'chat_room%prepaid%'
   ORDER BY ph.created_at
""", "4. 채팅 선결제 이력")

# 5. member_attendance 이력 (member.point만 업데이트했던 것들)
q("""
  SELECT attended_date, base_coin, consecutive_days
    FROM member_attendance
   WHERE member_id = 91
   ORDER BY attended_date
""", "5. 출석 이력 (member.point만 올리고 point 테이블 미반영)")

c.close()
