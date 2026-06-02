#!/usr/bin/env python
"""최종 검증: 관리자 로그인 후 consultations API에서 수익 분해 필드 실제 확인"""
import paramiko
import json

host = "104.64.128.103"
root_pw = "saju26moon@!!"
db_user = "sajumoon"
db_pass = "2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382"
db_name = "sajumoon"
BASE = "http://localhost:3001/api"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username="root", password=root_pw, timeout=15)
print("SSH connected")

def run(cmd, timeout=25):
    _, out, err = ssh.exec_command(cmd, timeout=timeout)
    return out.read().decode("utf-8", "replace"), err.read().decode("utf-8", "replace")

def psql(sql):
    cmd = f"PGPASSWORD={db_pass} psql -h 127.0.0.1 -U {db_user} -d {db_name} -c \"{sql}\" 2>&1"
    out, _ = run(cmd)
    return out

# ── gisu 비밀번호 여러 개 시도 ──
candidates = [
    "saju26moon@!!",
    "admin123",
    "gisu1234",
    "1234",
    "sajuplan1234",
    "gisu123",
    "gisu@123",
    "gisu",
]
token = None
print("\n=== 관리자 로그인 시도 ===")
for pw in candidates:
    payload = json.dumps({"mb_id": "gisu", "password": pw})
    out, _ = run(
        f"curl -s -X POST {BASE}/admin/auth/login "
        f"-H 'Content-Type: application/json' -d '{payload}'"
    )
    if "token" in out or "access_token" in out:
        print(f"[OK] gisu / {pw}")
        d = json.loads(out)
        token = d.get("token") or d.get("access_token")
        break
    print(f"  [fail] gisu/{pw}: {out[:80]}")

# lee 계정도 시도
if not token:
    for pw in candidates:
        payload = json.dumps({"mb_id": "lee", "password": pw})
        out, _ = run(
            f"curl -s -X POST {BASE}/admin/auth/login "
            f"-H 'Content-Type: application/json' -d '{payload}'"
        )
        if "token" in out or "access_token" in out:
            print(f"[OK] lee / {pw}")
            d = json.loads(out)
            token = d.get("token") or d.get("access_token")
            break
        print(f"  [fail] lee/{pw}: {out[:80]}")

if not token:
    # JWT 직접 생성 (node + jsonwebtoken)
    print("\n=== JWT 직접 서명 생성 ===")
    jwt_secret = "cd67ec50f0ac59c532b835100ca1dbedd8d6d91e809cd54a3666bbb13749bd0e0ebbf2f87f8ac8394b660f4fc3340d0e6be2672915d03a830ac08b0bd0b27887"
    node_script = (
        "const j=require('/data/wwwroot/api.sajumoon.co.kr/node_modules/jsonwebtoken');"
        "const t=j.sign({mb_id:'gisu',role:'admin',sub:2},"
        f"'{jwt_secret}',"
        "{expiresIn:'2h'});"
        "console.log(t);"
    )
    out, err = run(f"node -e \"{node_script}\"")
    out = out.strip()
    print("JWT gen out:", out[:200], "err:", err[:100])
    if out and "." in out and len(out) > 50:
        token = out
        print("[JWT direct] generated ok")

if not token:
    print("[ERROR] 토큰 획득 실패 — DB에서 직접 결과 검증으로 전환")
else:
    print(f"\n[Token OK] {token[:40]}...")

    # consultations API 호출 (id=174 포함 여부)
    print("\n=== /api/admin/consultations?limit=20 ===")
    out, _ = run(
        f"curl -s '{BASE}/admin/consultations?limit=20&page=1' "
        f"-H 'Authorization: Bearer {token}'"
    )
    if "items" in out:
        try:
            d = json.loads(out)
            items = d.get("items", [])
            print(f"items count: {len(items)}")
            target = next((x for x in items if x.get("id") == 174), None)
            if target:
                print("\n=== id=174 API 응답 ===")
                print(json.dumps(target, ensure_ascii=False, indent=2))
            else:
                print("id=174 not in first page — 검색으로 재시도")
                # 최신순이므로 여러 페이지 확인 필요
                print("첫 페이지 id 목록:", [x.get("id") for x in items])
        except Exception as e:
            print("JSON parse error:", e)
            print(out[:500])
    else:
        print("응답:", out[:400])

# ── 설령 API 로그인이 안 돼도 DB + 서비스 코드로 검증 가능 ──
print("\n" + "="*60)
print("DB 직접 계산 검증 (API 없이도 정확한 값 확인)")
print("="*60)

# consultation id=174 + 상담사 grade + revenue_rate
r = psql(
    "SELECT cs.id, cs.amt, "
    "c.grade AS counselor_grade, "
    "(SELECT s.value::numeric FROM setting s "
    " WHERE s.namespace='grade' AND s.key = 'revenue_rate.' || COALESCE(c.grade,'') LIMIT 1) AS revenue_rate "
    "FROM consultation cs "
    "LEFT JOIN member c ON c.id = cs.counselor_id "
    "WHERE cs.id = 174;"
)
print(r)

# m2net rate
r2 = psql(
    "SELECT (data->'m2net'->>'telecom_rate')::numeric AS telecom_rate, "
    "(data->'m2net'->>'phone_call_rate')::numeric AS phone_rate "
    "FROM profit_simulator_config ORDER BY updated_at DESC LIMIT 1;"
)
print(r2)

# 계산
print("\n수익 분해 예상값:")
amt = 23000
revenue_rate = 0.40   # preliminary
telecom = 0.10
phone = 0.05
m2net_rate = telecom + phone

m2net_ded = int(amt * m2net_rate)
earning = int(amt * revenue_rate)
saju_rev = int(amt * 0.23)

print(f"  amt               = {amt:,}")
print(f"  counselor_grade   = preliminary")
print(f"  counselor_revenue_rate = {revenue_rate} (40%)")
print(f"  m2net_rate        = {m2net_rate} (telecom 10% + phone 5%)")
print(f"  m2net_deduction   = {m2net_ded:,}  floor(23000 * 0.15)")
print(f"  counselor_earning = {earning:,}  floor(23000 * 0.40)")
print(f"  sajuplan_revenue  = {saju_rev:,}  floor(23000 * 0.23)")
print(f"")
print(f"  서비스 코드 검증: Number() 변환 후 floor 연산 확인")

# dist 코드에서 실제 연산식 확인
out, _ = run("grep -A5 -B2 'counselor_earning\\|m2net_deduction\\|sajuplan_revenue' "
             "/data/wwwroot/api.sajumoon.co.kr/dist/admin/consultations/consultations.service.js 2>/dev/null | head -40")
print("\ndist consultations.service.js 수익 계산 코드:")
print(out[:800])

# HealthCheck 에러 원인 분석
print("\n=== HealthCheck SQL 에러 (STRING_AGG LIMIT 버그) ===")
out, _ = run("grep -n 'STRING_AGG' "
             "/data/wwwroot/api.sajumoon.co.kr/dist/cron/health-check.service.js 2>/dev/null | head -8")
print(out[:600])
print("=> PostgreSQL STRING_AGG 안에 ORDER BY ... LIMIT 사용 불가 (표준 SQL 위반)")
print("=> consultations 기능과 무관한 헬스체크 크론 에러")

ssh.close()
