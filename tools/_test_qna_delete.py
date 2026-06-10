#!/usr/bin/env python3
"""QnA 삭제 실제 테스트"""
import os, sys, json, urllib.request, urllib.error, paramiko

for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

API = "https://api.sajuplan.com"
DB = "postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon"

# DB: 4875978218_K 계정 id 확인
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', os.environ['SSHPASS'], allow_agent=False, look_for_keys=False, timeout=15)
_, o, _ = c.exec_command(f"psql {DB} -c \"SELECT id, mb_id, password IS NOT NULL AS has_pw FROM member WHERE mb_id LIKE '4875978218%'\"", timeout=10)
print("[DB] 4875978218_K 계정:")
print(o.read().decode('utf-8','replace').strip())
c.close()

# jackee 로그인
login_data = json.dumps({"mb_id": "jackee", "password": "kunwoo77"}).encode()
req = urllib.request.Request(f"{API}/api/user/auth/login", data=login_data,
    headers={"Content-Type": "application/json"}, method="POST")
with urllib.request.urlopen(req) as r:
    cookie_raw = r.getheader("Set-Cookie", "")
    body = json.loads(r.read())
    print(f"\n[jackee 로그인] point={body.get('point')}")

cookie = ""
for part in cookie_raw.split(";"):
    p = part.strip()
    if p.startswith("sjm_user="):
        cookie = p
        break

# 내 QnA 목록 조회
req2 = urllib.request.Request(f"{API}/api/user/my-qnas?limit=10",
    headers={"Cookie": cookie}, method="GET")
with urllib.request.urlopen(req2) as r:
    data = json.loads(r.read())
    items = data.get("items", [])
    print(f"\n[내 QnA 목록] {len(items)}건")
    for q in items:
        print(f"  id={q['id']} counselor={q.get('counselor_name')} has_reply={q.get('has_reply')} content={str(q.get('content',''))[:15]}")

# 삭제 가능한 QnA (has_reply=False) 찾아서 삭제 시도
deletable = [q for q in items if not q.get('has_reply')]
if deletable:
    target = deletable[0]
    print(f"\n[삭제 시도] id={target['id']}, counselor_id={target['counselor_id']}, has_reply={target['has_reply']}")
    req3 = urllib.request.Request(
        f"{API}/api/user/counselors/{target['counselor_id']}/qna/{target['id']}",
        headers={"Cookie": cookie}, method="DELETE")
    try:
        with urllib.request.urlopen(req3) as r:
            result = json.loads(r.read())
            print(f"[삭제 결과] status=200 → {result}")
    except urllib.error.HTTPError as e:
        body = json.loads(e.read())
        print(f"[삭제 실패] status={e.code}, message={body.get('message')}")
else:
    print("\n삭제 가능한 QnA 없음 (모두 답변 달림)")
