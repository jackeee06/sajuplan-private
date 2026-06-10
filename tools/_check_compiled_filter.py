#!/usr/bin/env python3
"""서버의 컴파일된 JS에 balance_kind 필터가 실제로 있는지 확인"""
import os, sys
import paramiko

for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

DB   = "postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon"
HOST = "104.64.128.103"
API  = "/data/wwwroot/api.sajumoon.co.kr"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, 22, 'root', os.environ['SSHPASS'], allow_agent=False, look_for_keys=False, timeout=20)

def run(cmd, label=""):
    if label: print(f"\n[{label}]")
    _, o, e = c.exec_command(cmd, timeout=20)
    out = o.read().decode('utf-8', errors='replace').strip()
    err = e.read().decode('utf-8', errors='replace').strip()
    if err: print(f"STDERR: {err[:200]}")
    print(out[:1000] if out else "(empty)")

def q(sql, label=""):
    if label: print(f"\n[{label}]")
    _, o, e = c.exec_command(f'psql {DB} -c "{sql}"', timeout=20)
    print(o.read().decode('utf-8', errors='replace').strip()[:500])

# 1. 컴파일된 JS에 balance_kind 필터 있는지
run(f"grep -n 'balance_kind' {API}/dist/user/points/points.service.js 2>/dev/null | head -20",
    "1. 컴파일된 points.service.js에 balance_kind 있는지")

# 2. 컴파일된 JS에 attendance point_history INSERT 있는지
run(f"grep -n 'attendance' {API}/dist/user/attendance/attendance.service.js 2>/dev/null | grep -i 'point_history\\|INSERT' | head -10",
    "2. attendance.service.js point_history INSERT 있는지")

# 3. 빌드 시각 vs 패치 시각
run(f"ls -la {API}/dist/user/points/points.service.js {API}/dist/user/attendance/attendance.service.js 2>/dev/null",
    "3. 컴파일 파일 수정 시각")

# 4. pm2 로그에서 최근 attendance 로그
run("pm2 logs sajumoon-api --lines 30 --nostream 2>/dev/null | grep -i 'attendance\\|balance_kind' | tail -10",
    "4. pm2 로그 attendance 관련")

# 5. 오늘 jackee attendance DB 상태
q("""
  SELECT attended_date, base_coin, consecutive_days
    FROM member_attendance
   WHERE member_id = 91
   ORDER BY attended_date DESC LIMIT 3
""", "5. jackee member_attendance 최근")

# 6. 오늘 point_history 출석 행
q("""
  SELECT id, earn_point, content, balance_kind, created_at
    FROM point_history
   WHERE member_id = 91
     AND rel_action LIKE 'attendance:%'
   ORDER BY created_at DESC LIMIT 5
""", "6. jackee point_history 출석 기록")

# 7. member.point vs point 테이블 현재 상태
q("""
  SELECT m.point AS member_point, p.free_balance, p.paid_balance,
         m.point - (p.free_balance + p.paid_balance) AS drift
    FROM member m JOIN point p ON p.member_id = m.id
   WHERE m.id = 91
""", "7. jackee point drift 확인")

c.close()
