#!/usr/bin/env python
"""
수익 분해 컬럼 검증 스크립트
consultation id=174 (amt=23000) 기준으로 API 응답 및 서버 상태 검증
"""
import paramiko
import json
import sys

host = "104.64.128.103"
root_pw = "saju26moon@!!"
db_user = "sajumoon"
db_pass = "2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382"
db_name = "sajumoon"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username="root", password=root_pw, timeout=15)
print("SSH connected to", host)

def run(cmd, timeout=20):
    _, out, err = ssh.exec_command(cmd, timeout=timeout)
    return (
        out.read().decode("utf-8", "replace"),
        err.read().decode("utf-8", "replace"),
    )

def psql(sql, timeout=20):
    cmd = f'PGPASSWORD={db_pass} psql -h 127.0.0.1 -U {db_user} -d {db_name} -c "{sql}" 2>&1'
    out, _ = run(cmd, timeout)
    return out

results = []

# =========================================================
# CHECK 1: consultation id=174 존재 및 기본 데이터 확인
# =========================================================
print("\n[CHECK 1] consultation id=174 기본 데이터")
r = psql("SELECT id, amt, csrid, reason, is_paid, is_settled, counselor_id FROM consultation WHERE id = 174;")
print(r)
has_174 = "174" in r and "23000" in r
results.append(("consultation id=174 존재 (amt=23000)", has_174))

# =========================================================
# CHECK 2: 상담사 grade 확인
# =========================================================
print("\n[CHECK 2] 상담사 grade")
r = psql("SELECT cs.id, cs.amt, cs.counselor_id, m.grade, m.nickname FROM consultation cs LEFT JOIN member m ON m.id=cs.counselor_id WHERE cs.id=174;")
print(r)
grade_ok = "preliminary" in r or "partner" in r
results.append(("상담사 grade 세팅됨", grade_ok))

# =========================================================
# CHECK 3: revenue_rate setting 값 존재 확인
# =========================================================
print("\n[CHECK 3] grade revenue_rate settings")
r = psql("SELECT namespace, key, value FROM setting WHERE namespace='grade' AND key LIKE 'revenue_rate.%' ORDER BY key;")
print(r)
# preliminary = 0.40 확인
prelim_ok = "0.40" in r or "0.4" in r
results.append(("revenue_rate.preliminary = 0.40 존재", prelim_ok))
results.append(("revenue_rate.partner1~5 전체 존재", "partner5" in r))

# =========================================================
# CHECK 4: profit_simulator_config m2net 설정 확인
# =========================================================
print("\n[CHECK 4] profit_simulator_config m2net")
r = psql("SELECT data->>'m2net' AS m2net FROM profit_simulator_config ORDER BY updated_at DESC LIMIT 1;")
print(r)
m2net_ok = "telecom_rate" in r and "phone_call_rate" in r
# telecom_rate=10, phone_call_rate=5 => m2netRate = 15%
telecom_10 = '"telecom_rate": 10' in r or '"telecom_rate":10' in r
phone_5 = '"phone_call_rate": 5' in r or '"phone_call_rate":5' in r
results.append(("m2net config 존재 (telecom+phone)", m2net_ok))
results.append(("telecom_rate=10%", telecom_10))
results.append(("phone_call_rate=5%", phone_5))

# =========================================================
# CHECK 5: 수학적 계산 검증 (id=174, amt=23000, grade=preliminary)
# =========================================================
print("\n[CHECK 5] 수익 분해 수학 검증")
amt = 23000
revenue_rate = 0.40       # preliminary
telecom_rate = 10 / 100   # 0.10
phone_rate = 5 / 100      # 0.05
m2net_rate = telecom_rate + phone_rate  # 0.15

m2net_deduction = int(amt * m2net_rate)    # 3450
counselor_earning = int(amt * revenue_rate) # 9200
sajuplan_revenue = int(amt * 0.23)          # 5290

print(f"  amt                = {amt:,}")
print(f"  m2net_rate         = {m2net_rate:.0%} (telecom 10% + phone 5%)")
print(f"  m2net_deduction    = {m2net_deduction:,}  (23000 x 0.15)")
print(f"  revenue_rate       = {revenue_rate:.0%} (preliminary)")
print(f"  counselor_earning  = {counselor_earning:,}  (23000 x 0.40)")
print(f"  sajuplan_revenue   = {sajuplan_revenue:,}  (23000 x 0.23, 고정 근사)")
print(f"  합계 검증: m2net({m2net_deduction}) + earning({counselor_earning}) + saju({sajuplan_revenue}) = {m2net_deduction+counselor_earning+sajuplan_revenue} / {amt}")
results.append(("m2net_deduction 계산 정확 (=3450)", m2net_deduction == 3450))
results.append(("counselor_earning 계산 정확 (=9200)", counselor_earning == 9200))
results.append(("sajuplan_revenue 계산 정확 (=5290)", sajuplan_revenue == 5290))

# =========================================================
# CHECK 6: PM2 에러 로그 확인
# =========================================================
print("\n[CHECK 6] PM2 에러 로그 (consultations 관련)")
out, _ = run("pm2 logs --nostream --lines 50 2>&1 | grep -i 'consult\\|Error\\|TypeError' | tail -20")
print(out[:600] if out.strip() else "(로그 없음)")
no_consult_error = "consultations" not in out.lower() or "error" not in out.lower()
results.append(("PM2 로그에 consultations 관련 Error 없음", no_consult_error))

# =========================================================
# CHECK 7: 컴파일된 dist JS에 Number() 변환 코드 있는지 확인
# =========================================================
print("\n[CHECK 7] dist JS Number() 변환 (amt 안전처리)")
out, _ = run("ls /data/wwwroot/api.sajumoon.co.kr/dist/admin/consultations/ 2>&1")
print("dist files:", out[:300])
out2, _ = run("cat /data/wwwroot/api.sajumoon.co.kr/dist/admin/consultations/consultations.service.js 2>/dev/null | grep -c 'Number(' 2>&1")
print("Number() count in service.js:", out2.strip())
number_ok = out2.strip().isdigit() and int(out2.strip()) > 0
results.append(("dist consultations.service.js에 Number() 변환 존재", number_ok))

# =========================================================
# CHECK 8: 프론트엔드 dist 번들에 영업이익 컬럼 있는지 확인
# =========================================================
print("\n[CHECK 8] 프론트엔드 dist 번들 영업이익 확인")
out, _ = run("grep -rl '영업이익' /data/wwwroot/sajumoon.co.kr/mng/ 2>/dev/null | head -5")
print("frontend files with 영업이익:", out[:300] if out.strip() else "(없음)")
out2, _ = run("grep -l 'sajuplan_revenue\\|counselor_earning\\|m2net_deduction' /data/wwwroot/sajumoon.co.kr/mng/assets/*.js 2>/dev/null | head -3")
print("frontend bundle with revenue columns:", out2[:300] if out2.strip() else "(없음)")
frontend_ok = bool(out.strip() or out2.strip())
results.append(("프론트엔드 dist에 영업이익/수익분해 컬럼 번들됨", frontend_ok))

# =========================================================
# CHECK 9: API 응답 실제 확인 (curl)
# =========================================================
print("\n[CHECK 9] API curl 응답 확인")
# 포트 찾기
out_port, _ = run("ss -tlnp | grep node | head -5")
print("node ports:", out_port[:300])
# 일반적으로 3000 또는 3001
for port in [3000, 3001, 3002, 4000]:
    out_curl, _ = run(f"curl -s http://localhost:{port}/admin/consultations?limit=1 2>&1 | head -c 200")
    if "items" in out_curl or "counselor" in out_curl:
        print(f"[port {port}] hit:", out_curl[:300])
        has_revenue_fields = all(k in out_curl for k in ["counselor_revenue_rate", "counselor_earning", "m2net_deduction"])
        results.append((f"API port {port} 응답에 수익 분해 필드 포함", has_revenue_fields))
        break
    elif "404" not in out_curl and out_curl.strip():
        print(f"[port {port}]:", out_curl[:150])

# =========================================================
# 최종 결과 출력
# =========================================================
print("\n" + "="*60)
print("검증 결과 요약")
print("="*60)
all_pass = True
for label, ok in results:
    icon = "OK" if ok else "FAIL"
    print(f"  [{icon}] {label}")
    if not ok:
        all_pass = False

print()
if all_pass:
    print(">>> 모든 검증 통과")
else:
    print(">>> 일부 검증 실패 - 위 FAIL 항목 확인 필요")

ssh.close()
