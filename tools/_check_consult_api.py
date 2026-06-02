"""prod 어드민 consultation API 응답에서 수익 분해 컬럼 확인."""
import json, os, sys
import urllib.request, urllib.parse

BASE = "https://api.sajuplan.com/api"

def post_json(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        BASE + path, data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"error": e.code, "body": e.read().decode()}

def get_json(path, token):
    req = urllib.request.Request(
        BASE + path,
        headers={"Authorization": f"Bearer {token}"},
        method="GET"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"error": e.code, "body": e.read().decode()}

# 로그인 (비번은 환경변수로)
admin_pw = os.environ.get("ADMIN_PW", "saju26moon@!!")
login = post_json("/admin/auth/login", {"mb_id": "admin", "password": admin_pw})
token = login.get("access_token")
if not token:
    print("LOGIN FAILED:", login)
    sys.exit(1)
print(f"✅ 로그인 OK")

# consultation 목록 조회
data = get_json("/admin/consultations?page=1&limit=5", token)
if "error" in data:
    print("API ERROR:", data)
    sys.exit(1)

items = data.get("items", [])
print(f"\n=== consultation 목록 ({len(items)}건) ===")
for item in items:
    amt = item.get("amt", 0)
    rate = item.get("counselor_revenue_rate")
    m2net = item.get("m2net_deduction")
    earning = item.get("counselor_earning")
    sajuplan = item.get("sajuplan_revenue")
    print(f"  id={item['id']:4d}  amt={amt:6}  rate={rate}  m2net={m2net}  earning={earning}  sajuplan={sajuplan}")
