#!/usr/bin/env python3
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

def q(sql):
    _, o, _ = c.exec_command(f"psql {DB} -c \"{sql}\"", timeout=20)
    return o.read().decode('utf-8', errors='replace').strip()

print("=== jackee(찬물선생) 코인 내역 분석 ===\n")

# 기본 정보
print("[1] 회원 정보")
print(q("SELECT m.id, m.mb_id, m.nickname, m.role, m.point, p.free_balance, p.paid_balance, p.earning_balance FROM member m JOIN point p ON p.member_id=m.id WHERE m.mb_id='jackee'"))

# 2026-06-02 전후 point_history
print("\n[2] 2026-06-02 전후 코인 내역")
print(q("""
  SELECT id, earn_point, use_point, balance_after, content, rel_table, rel_id, rel_action, created_at
    FROM point_history
   WHERE member_id = (SELECT id FROM member WHERE mb_id='jackee')
     AND created_at BETWEEN '2026-06-01' AND '2026-06-05'
   ORDER BY created_at
"""))

# 6월 2일 16:12 전화 코인 증가의 정체
print("\n[3] [전화]코인증가 상세")
print(q("""
  SELECT ph.id, ph.earn_point, ph.use_point, ph.content, ph.rel_table, ph.rel_id, ph.rel_action,
         ph.created_at,
         c.member_id, c.counselor_id, c.usetm, c.amt, c.amt_free, c.preflag
    FROM point_history ph
    LEFT JOIN consultation c ON c.id::text = ph.rel_id
   WHERE ph.member_id = (SELECT id FROM member WHERE mb_id='jackee')
     AND ph.earn_point > 0
     AND ph.created_at > '2026-06-01'
   ORDER BY ph.created_at
"""))

c.close()
