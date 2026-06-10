#!/usr/bin/env python3
import os, sys, requests
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

# 1. API 로그인
print("[1] jackee 로그인")
sess = requests.Session()
r = sess.post('https://api.sajuplan.com/api/user/auth/login',
              json={'mb_id': 'jackee', 'password': 'kunwoo77'}, timeout=10)
print(f"  status: {r.status_code}")
if r.status_code not in (200, 201):
    print(f"  {r.text[:200]}"); c.close(); sys.exit(1)

# 2. 사용내역 API 호출
print("\n[2] GET /api/user/points/history")
r2 = sess.get('https://api.sajuplan.com/api/user/points/history?page=1&limit=30', timeout=10)
data = r2.json()
items = data.get('items', [])
print(f"  total DB 건수: {data.get('total')}  반환: {len(items)}")

earning_keywords = ['상담코인 증가', '채팅코인 증가', '추천 수당 차감']
leaked = [it for it in items if any(k in it.get('title','') for k in earning_keywords)]
if leaked:
    print(f"\n  ⚠️ earning 항목 {len(leaked)}건 여전히 노출:")
    for it in leaked: print(f"    - {it['title']} {it['amount']}")
else:
    print("\n  ✅ earning 항목 없음 — 필터 정상 작동!")

print("\n  사용내역 항목 (최신순):")
for it in items[:8]:
    print(f"    [{it['direction']}] {it['amount']:>6,}코인 | {it['title'][:28]}")

# 3. 오늘 출석 상태
print("\n[3] 오늘 출석 상태")
r3 = sess.get('https://api.sajuplan.com/api/user/attendance/today', timeout=10)
print(f"  {r3.text[:200]}")

# 4. drift 상태
q("""
  SELECT m.point AS member_point, p.free_balance, p.paid_balance,
         m.point - (p.free_balance + p.paid_balance) AS drift
    FROM member m JOIN point p ON p.member_id = m.id
   WHERE m.id = 91
""", "4. jackee point drift")

c.close()
