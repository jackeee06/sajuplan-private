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

def q(sql, label=""):
    if label: print(f"\n[{label}]")
    _, o, e = c.exec_command(f'psql {DB} -c "{sql}"', timeout=20)
    out = o.read().decode('utf-8', errors='replace').strip()
    err = e.read().decode('utf-8', errors='replace').strip()
    if err: print(f"STDERR: {err}")
    print(out)

# 1. 컬럼 실제 존재 여부 + DEFAULT 확인
q("""
  SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
   WHERE table_name='point_history' AND column_name='balance_kind'
""", "1. balance_kind 컬럼 스키마")

# 2. jackee 전체 point_history with balance_kind
q("""
  SELECT id, balance_kind, earn_point, use_point, content, created_at::date
    FROM point_history
   WHERE member_id = (SELECT id FROM member WHERE mb_id='jackee')
   ORDER BY created_at DESC
   LIMIT 15
""", "2. jackee point_history (balance_kind 포함)")

# 3. consumer 필터 시뮬레이션 (API가 반환해야 할 것)
q("""
  SELECT id, balance_kind, earn_point, use_point, content
    FROM point_history
   WHERE member_id = (SELECT id FROM member WHERE mb_id='jackee')
     AND balance_kind = 'consumer'
   ORDER BY created_at DESC
   LIMIT 10
""", "3. consumer 필터 결과 (API 기대값)")

# 4. 오늘 출석 코인 여부
q("""
  SELECT id, earn_point, content, rel_action, balance_kind, created_at
    FROM point_history
   WHERE member_id = (SELECT id FROM member WHERE mb_id='jackee')
     AND created_at::date = CURRENT_DATE
   ORDER BY created_at DESC
""", "4. 오늘(CURRENT_DATE) jackee point_history")

# 5. NULL 체크 — balance_kind가 NULL인 행이 있는가?
q("""
  SELECT COUNT(*) AS null_rows FROM point_history WHERE balance_kind IS NULL
""", "5. balance_kind NULL 행 수")

# 6. 전체 balance_kind 분포
q("""
  SELECT balance_kind, COUNT(*) FROM point_history GROUP BY balance_kind
""", "6. balance_kind 분포")

c.close()
