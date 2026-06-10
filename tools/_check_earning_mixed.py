#!/usr/bin/env python3
"""
point_history 에 earning(수익금)이 섞인 회원 전수 점검
- 상담사 역할이지만 소비 코인 내역에 수익금이 노출되는 케이스
"""
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
    _, o, e = c.exec_command(f"psql {DB} -c \"{sql}\"", timeout=30)
    out = o.read().decode('utf-8', errors='replace').strip()
    err = e.read().decode('utf-8', errors='replace').strip()
    if err: print(f"[STDERR] {err}")
    return out

print("=== point_history 소비/수익 혼재 전수 점검 ===\n")

print("[1] 수익금 관련 point_history 건수 (rel_action LIKE '%상담코인 증가%')")
print(q("""
  SELECT COUNT(*) AS earning_rows,
         COUNT(DISTINCT member_id) AS affected_members
    FROM point_history
   WHERE rel_action LIKE '%상담코인 증가%'
      OR rel_action LIKE '%채팅코인 증가%'
"""))

print("\n[2] 영향받는 상담사 목록 (수익금이 point_history에 있는 멤버)")
print(q("""
  SELECT m.id, m.mb_id, m.nickname, m.role,
         COUNT(ph.id) AS earning_rows,
         SUM(ph.earn_point) AS total_earning_in_history
    FROM point_history ph
    JOIN member m ON m.id = ph.member_id
   WHERE ph.rel_action LIKE '%상담코인 증가%'
      OR ph.rel_action LIKE '%채팅코인 증가%'
   GROUP BY m.id, m.mb_id, m.nickname, m.role
   ORDER BY total_earning_in_history DESC
"""))

print("\n[3] rel_action 전체 종류 (point_history 유형 파악)")
print(q("""
  SELECT rel_action, COUNT(*) AS cnt, SUM(earn_point) AS total_earn, SUM(use_point) AS total_use
    FROM point_history
   GROUP BY rel_action
   ORDER BY cnt DESC
   LIMIT 30
"""))

print("\n[4] rel_table 전체 종류")
print(q("""
  SELECT rel_table, COUNT(*) AS cnt
    FROM point_history
   GROUP BY rel_table
   ORDER BY cnt DESC
"""))

print("\n[5] 회원 모드 코인 내역 API 가 보여줘선 안 될 행 수 (earning 계열 전부)")
print(q("""
  SELECT COUNT(*) AS rows_to_hide
    FROM point_history
   WHERE rel_action LIKE '%상담코인 증가%'
      OR rel_action LIKE '%채팅코인 증가%'
      OR rel_action LIKE '%settlement%'
      OR rel_action LIKE '%payout%'
"""))

c.close()
print("\n완료")
