#!/usr/bin/env python3
"""member.point drift 수정 + 배포 + 검증"""
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

def q(sql, label=""):
    if label: print(f"\n[{label}]")
    _, o, _ = c.exec_command(f'psql {DB} -c "{sql}"', timeout=20)
    print(o.read().decode('utf-8', errors='replace').strip())

def run(cmd, label=""):
    if label: print(f"\n[{label}]")
    _, o, e = c.exec_command(cmd, timeout=120)
    out = o.read().decode('utf-8', errors='replace').strip()
    err = e.read().decode('utf-8', errors='replace').strip()
    if out: print(out[-300:])
    if err and 'warning' not in err.lower(): print(f"ERR: {err[-200:]}")

# 1. drift 있는 회원 전수 확인
q("""
  SELECT m.id, m.mb_id, m.nickname, m.point AS member_point,
         (p.free_balance + p.paid_balance) AS actual,
         m.point - (p.free_balance + p.paid_balance) AS drift
    FROM member m
    JOIN point p ON p.member_id = m.id
   WHERE m.point != (p.free_balance + p.paid_balance)
   ORDER BY ABS(m.point - (p.free_balance + p.paid_balance)) DESC
""", "1. drift 있는 전체 회원")

# 2. jackee drift 수정
q("""
  UPDATE member
     SET point = (SELECT free_balance + paid_balance FROM point WHERE member_id = member.id),
         updated_at = now()
   WHERE id IN (
     SELECT m.id FROM member m JOIN point p ON p.member_id = m.id
      WHERE m.point != (p.free_balance + p.paid_balance)
   )
  RETURNING id, mb_id, point AS new_point
""", "2. drift 있는 회원 일괄 수정")

# 3. 수정 후 검증
q("""
  SELECT m.id, m.mb_id, m.point, p.free_balance, p.paid_balance,
         m.point - (p.free_balance + p.paid_balance) AS drift
    FROM member m JOIN point p ON p.member_id = m.id
   WHERE m.id IN (91)
""", "3. jackee 수정 결과")

# 4. 코드 업로드 + 빌드
sftp = c.open_sftp()
sftp.put("api/src/pg-callbacks/m2net-push.service.ts",
         f"{API}/src/pg-callbacks/m2net-push.service.ts")
print(f"\n[4] m2net-push.service.ts 업로드 완료")
sftp.close()

run(f"cd {API} && npm run build 2>&1 | tail -5", "5. 빌드")
run("pm2 reload sajumoon-api", "6. PM2 reload")

# 7. 코드 검증: 절대값 방식으로 변경됐는지
run(f"grep -n 'free_balance + paid_balance' {API}/dist/pg-callbacks/m2net-push.service.js | head -3",
    "7. 컴파일된 JS 절대값 동기화 확인")

c.close()
print("\n완료")
