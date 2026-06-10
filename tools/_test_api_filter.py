#!/usr/bin/env python3
"""API 응답을 직접 확인 — 필터 실제 동작 여부"""
import os, sys, json
import paramiko, requests

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
    if e.read(): pass
    print(out)

# 1. 현재 API에서 jackee 세션 쿠키 얻기 (로그인)
print("[1] jackee 로그인 → 쿠키 획득")
sess = requests.Session()
r = sess.post('https://api.sajuplan.com/api/user/auth/login',
              json={'mb_id': 'jackee', 'password': 'saju1234!'},
              timeout=10)
print(f"  status: {r.status_code}")
if r.status_code != 201:
    print(f"  body: {r.text[:200]}")
    c.close(); sys.exit(1)

# 2. /user/points/history 호출
print("\n[2] GET /api/user/points/history")
r2 = sess.get('https://api.sajuplan.com/api/user/points/history?page=1&limit=20', timeout=10)
print(f"  status: {r2.status_code}")
data = r2.json()
items = data.get('items', [])
print(f"  total: {data.get('total')}, 반환 건수: {len(items)}")
print("\n  항목 목록:")
for it in items:
    print(f"    [{it['direction']}] {it['amount']:,} | {it['title'][:30]} | {it['occurred_at'][:10]}")

# 3. earning 항목이 섞였는지 확인
earning_keywords = ['상담코인 증가', '채팅코인 증가', '추천 수당 차감']
leaked = [it for it in items if any(k in it.get('title','') for k in earning_keywords)]
if leaked:
    print(f"\n  ⚠️ earning 항목 {len(leaked)}건 여전히 노출:")
    for it in leaked: print(f"    - {it['title']}")
else:
    print("\n  ✅ earning 항목 없음 — 필터 정상")

# 4. 오늘 출석 체크
print("\n[3] 오늘 출석 상태")
r3 = sess.get('https://api.sajuplan.com/api/user/attendance/today', timeout=10)
print(f"  status: {r3.status_code}, body: {r3.text[:200]}")

# 5. DB에서 오늘 attendance 기록 확인
q("""
  SELECT attended_date, base_coin, bonus_coin, consecutive_days
    FROM member_attendance
   WHERE member_id = (SELECT id FROM member WHERE mb_id='jackee')
   ORDER BY attended_date DESC LIMIT 3
""", "4. member_attendance 최근 3건")

# 6. 오늘 point_history 출석 행 확인
q("""
  SELECT id, earn_point, content, balance_kind, created_at
    FROM point_history
   WHERE member_id = (SELECT id FROM member WHERE mb_id='jackee')
     AND rel_action LIKE 'attendance:%'
   ORDER BY created_at DESC LIMIT 3
""", "5. point_history 출석 기록")

c.close()
