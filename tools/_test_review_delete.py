#!/usr/bin/env python3
"""후기 생성 → 즉시 삭제 테스트 (정확한 에러 메시지 확인)"""
import os, sys, json, urllib.request, urllib.error
for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

API = "https://api.sajuplan.com"

# 1. e2e_member 로그인
login_data = json.dumps({"mb_id": "e2e_member", "password": "e2e_test_2026"}).encode()
req = urllib.request.Request(f"{API}/api/user/auth/login", data=login_data,
    headers={"Content-Type": "application/json"}, method="POST")
with urllib.request.urlopen(req) as r:
    cookie = r.getheader("Set-Cookie", "")
    body = json.loads(r.read())
    print(f"[로그인] status=200, point={body.get('point')}")

# 쿠키 추출
cookie_val = ""
for part in cookie.split(";"):
    part = part.strip()
    if part.startswith("sjm_user="):
        cookie_val = part
        break
print(f"[쿠키] {cookie_val[:60]}...")

# 2. 후기 생성
review_data = json.dumps({
    "counselor_id": 102,
    "consultation_id": 194,
    "content": "삭제 테스트용 후기입니다.",
    "rating": 5,
    "title": "삭제 테스트"
}).encode()
req2 = urllib.request.Request(f"{API}/api/user/reviews", data=review_data,
    headers={"Content-Type": "application/json", "Cookie": cookie_val}, method="POST")
try:
    with urllib.request.urlopen(req2) as r:
        review = json.loads(r.read())
        print(f"[후기 생성] status=201, id={review.get('id')}")
        review_id = review.get('id')
except urllib.error.HTTPError as e:
    body = json.loads(e.read())
    print(f"[후기 생성 실패] status={e.code}, msg={body}")
    sys.exit(1)

# 3. 즉시 삭제 시도
req3 = urllib.request.Request(f"{API}/api/user/reviews/{review_id}",
    headers={"Cookie": cookie_val}, method="DELETE")
try:
    with urllib.request.urlopen(req3) as r:
        result = json.loads(r.read())
        print(f"[후기 삭제] status=200, result={result}")
except urllib.error.HTTPError as e:
    body_raw = e.read()
    try:
        body = json.loads(body_raw)
        print(f"[후기 삭제 실패] status={e.code}, message={body.get('message')}")
    except:
        print(f"[후기 삭제 실패] status={e.code}, raw={body_raw[:200]}")
