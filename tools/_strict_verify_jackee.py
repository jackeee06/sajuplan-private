#!/usr/bin/env python3
"""jackee 코인 내역 엄격검증"""
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

# ── API 로그인 ──
sess = requests.Session()
r = sess.post('https://api.sajuplan.com/api/user/auth/login',
              json={'mb_id': 'jackee', 'password': 'kunwoo77'}, timeout=10)
assert r.status_code in (200, 201), f"로그인 실패: {r.text[:100]}"
member = r.json()['member']
print(f"✅ 로그인 성공: {member['nickname']} | 보유 코인: {int(member['point']):,}")

# ── API 사용내역 ──
r2 = sess.get('https://api.sajuplan.com/api/user/points/history?page=1&limit=50', timeout=10)
data = r2.json()
items = data.get('items', [])
total = data.get('total', 0)
print(f"✅ 사용내역 {total}건 반환")

# ── 검증 1: earning 항목 노출 없는지 ──
earning_kw = ['상담코인 증가', '채팅코인 증가', '추천 수당 차감', '추천 수당']
leaked_earning = [it for it in items if any(k in it.get('title','') for k in earning_kw)]
if leaked_earning:
    print(f"❌ [V1] earning 노출 {len(leaked_earning)}건: {[it['title'] for it in leaked_earning]}")
else:
    print("✅ [V1] earning 항목 없음")

# ── 검증 2: 선결제 항목 노출 없는지 ──
leaked_prepaid = [it for it in items if '선결제' in it.get('title','')]
if leaked_prepaid:
    print(f"❌ [V2] 선결제 항목 {len(leaked_prepaid)}건 여전히 노출")
else:
    print("✅ [V2] 선결제 항목 없음")

# ── 검증 3: balance_after 연속성 ──
print("\n[V3] balance_after 연속성 검증 (최신→오래된순)")
errors = []
items_sorted = sorted(items, key=lambda x: x['occurred_at'], reverse=True)
for i in range(len(items_sorted) - 1):
    cur = items_sorted[i]
    nxt = items_sorted[i + 1]
    amt = cur['amount']
    direction = cur['direction']
    expected = nxt['balance_after'] - amt if direction == 'out' else nxt['balance_after'] + amt
    if abs(cur['balance_after'] - expected) > 1:
        errors.append(f"  ❌ #{i+1} {cur['title'][:20]} ({cur['occurred_at'][:10]}): "
                      f"기대={expected:,} 실제={cur['balance_after']:,}")

if errors:
    print(f"  ❌ {len(errors)}건 불일치:")
    for e in errors: print(e)
else:
    print(f"  ✅ {len(items_sorted)}건 모두 연속성 일치")

# ── 검증 4: 마지막 balance_after = member.point ──
if items_sorted:
    last_bal = items_sorted[0]['balance_after']
    mp = int(member['point'])
    if last_bal == mp:
        print(f"✅ [V4] 최신 balance_after({last_bal:,}) = member.point({mp:,})")
    else:
        print(f"❌ [V4] 불일치: balance_after={last_bal:,} vs member.point={mp:,}")

# ── 검증 5: DB drift 없는지 ──
q("""
  SELECT m.id, m.mb_id, m.point, p.free_balance, p.paid_balance,
         m.point - (p.free_balance + p.paid_balance) AS drift
    FROM member m JOIN point p ON p.member_id = m.id
   WHERE m.id = 91
""", "V5. DB drift 확인")

# ── 검증 6: 전체 회원 drift ──
q("""
  SELECT COUNT(*) AS drift_count
    FROM member m JOIN point p ON p.member_id = m.id
   WHERE m.point != (p.free_balance + p.paid_balance)
""", "V6. 전체 회원 drift 수")

print("\n" + "="*40)
print("엄격검증 완료")
c.close()
