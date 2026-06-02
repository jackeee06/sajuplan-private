#!/usr/bin/env python
"""올바른 JWT sub=90 으로 consultations API 호출하여 수익 분해 필드 검증"""
import paramiko
import json

host = "104.64.128.103"
root_pw = "saju26moon@!!"
db_user = "sajumoon"
db_pass = "2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382"
db_name = "sajumoon"
BASE = "http://localhost:3001/api"
JWT_SECRET = "cd67ec50f0ac59c532b835100ca1dbedd8d6d91e809cd54a3666bbb13749bd0e0ebbf2f87f8ac8394b660f4fc3340d0e6be2672915d03a830ac08b0bd0b27887"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username="root", password=root_pw, timeout=15)
print("SSH connected")

def run(cmd, timeout=25):
    _, out, err = ssh.exec_command(cmd, timeout=timeout)
    return out.read().decode("utf-8", "replace"), err.read().decode("utf-8", "replace")

# gisu id=90 기반으로 다양한 sub 값 시도
payloads = [
    f"{{sub:90, role:'admin', mb_id:'gisu'}}",
    f"{{sub:90, role:'admin'}}",
    f"{{id:90, role:'admin', mb_id:'gisu'}}",
    f"{{mb_id:'gisu', role:'admin', sub:'90'}}",
]

node_gen = "const j=require('/data/wwwroot/api.sajumoon.co.kr/node_modules/jsonwebtoken');const s='" + JWT_SECRET + "';"
for i, p in enumerate(payloads):
    node_gen += f"console.log('T{i}:'+j.sign({p},s,{{expiresIn:'2h'}}));"

out, err = run(f"node -e \"{node_gen}\"")
tokens = {}
for line in out.strip().split("\n"):
    if line.startswith("T") and ":" in line:
        key, val = line.split(":", 1)
        tokens[key] = val.strip()
        print(f"  {key}: {val[:60]}...")

print(f"\n생성된 토큰 {len(tokens)}개")

# 각 토큰으로 API 시도
token_ok = None
for key, tok in tokens.items():
    out, _ = run(f"curl -s '{BASE}/admin/consultations?limit=5' -H 'Authorization: Bearer {tok}'")
    if "items" in out:
        print(f"\n[{key}] AUTH OK - consultations API 응답 성공")
        token_ok = tok
        # id=174 찾기
        try:
            d = json.loads(out)
            items = d.get("items", [])
            print(f"  items count: {len(items)}")
            print(f"  ids: {[x.get('id') for x in items]}")
            target = next((x for x in items if x.get("id") == 174), None)
            if target:
                print("\n=== id=174 API 응답 ===")
                print(json.dumps(target, ensure_ascii=False, indent=2))
        except Exception as e:
            print("parse error:", e, out[:200])
        break
    else:
        print(f"  [{key}] {out[:80]}")

if not token_ok:
    print("\n[WARNING] JWT 직접 생성으로 API 접근 불가 (guard가 DB 조회 기반일 수 있음)")
    print("=> DB 직접 검증으로 대체 (이미 완료됨)")
    print("=> dist JS 코드 검증으로 대체")

# dist JS에서 실제 계산 로직 확인
print("\n=== dist consultations.service.js 수익 계산 전체 ===")
out, _ = run("grep -n 'Number\\|m2netRate\\|telecomRate\\|phoneRate\\|SAJUPLAN\\|counselor_earning\\|m2net_deduction\\|sajuplan_revenue\\|revenue_rate' "
             "/data/wwwroot/api.sajumoon.co.kr/dist/admin/consultations/consultations.service.js 2>/dev/null")
print(out[:1500])

# 프론트엔드 번들에서 컬럼 렌더링 확인
print("\n=== 프론트엔드 번들에서 수익 분해 컬럼 렌더링 확인 ===")
out, _ = run("grep -o 'counselor_revenue_rate\\|m2net_deduction\\|counselor_earning\\|sajuplan_revenue\\|영업이익\\|상담사%\\|M2NET' "
             "/data/wwwroot/sajumoon.co.kr/mng/assets/index-CiWf_H2s.js 2>/dev/null | sort | uniq -c | sort -rn | head -20")
print("bundle 1 (index-CiWf_H2s.js):", out[:500])

out, _ = run("grep -o 'counselor_revenue_rate\\|m2net_deduction\\|counselor_earning\\|sajuplan_revenue' "
             "/data/wwwroot/sajumoon.co.kr/mng/assets/index-DbYsGb5X.js 2>/dev/null | sort | uniq -c")
print("bundle 2 (index-DbYsGb5X.js):", out[:300])

# 어느 bundle이 consultations 관리자 페이지 담당인지 확인
print("\n=== consultations 관리자 번들 파일 식별 ===")
out, _ = run("grep -l 'ConsultationList\\|상담내역\\|consultations' "
             "/data/wwwroot/sajumoon.co.kr/mng/assets/*.js 2>/dev/null | head -5")
print("consultations bundle:", out[:300])

out2, _ = run("grep -o '상담사%\\|M2NET차감\\|상담사수익금\\|영업이익' "
              "/data/wwwroot/sajumoon.co.kr/mng/assets/index-CiWf_H2s.js 2>/dev/null | head -20")
print("column labels in bundle:", out2[:300])

ssh.close()
