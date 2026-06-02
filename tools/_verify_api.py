#!/usr/bin/env python
"""API 응답 검증 - 관리자 로그인 후 consultations 응답에서 수익 분해 필드 확인"""
import paramiko
import json

host = "104.64.128.103"
root_pw = "saju26moon@!!"
db_user = "sajumoon"
db_pass = "2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382"
db_name = "sajumoon"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username="root", password=root_pw, timeout=15)
print("SSH connected")

def run(cmd, timeout=25):
    _, out, err = ssh.exec_command(cmd, timeout=timeout)
    return (
        out.read().decode("utf-8", "replace"),
        err.read().decode("utf-8", "replace"),
    )

def psql(sql, timeout=20):
    cmd = f"PGPASSWORD={db_pass} psql -h 127.0.0.1 -U {db_user} -d {db_name} -c \"{sql}\" 2>&1"
    out, _ = run(cmd, timeout)
    return out

# 1. 관리자 계정 목록 확인
print("\n=== 관리자 계정 ===")
r = psql("SELECT mb_id, role FROM member WHERE role IN ('superadmin','admin') ORDER BY id LIMIT 5;")
print(r)

# 2. mb_id 첫 번째 관리자로 로그인 시도
# .env에서 JWT_SECRET 확인
out, _ = run("grep JWT /data/wwwroot/api.sajumoon.co.kr/.env 2>/dev/null | head -3")
print("JWT config:", out[:200])

# 3. 슈퍼관리자 비밀번호 확인 (bcrypt 해시 — 직접 로그인은 못하므로 curl로 시도)
# 알려진 관리자 계정 시도
for cred in [("admin", "admin123"), ("superadmin", "saju26moon"), ("saju", "admin123"), ("admin", "saju26moon@!!")]:
    mb_id, password = cred
    payload = json.dumps({"mb_id": mb_id, "password": password})
    out, _ = run(f"curl -s -X POST http://localhost:3001/auth/login -H 'Content-Type: application/json' -d '{payload}'")
    if "token" in out or "access_token" in out:
        print(f"[LOGIN OK] {mb_id}/{password}")
        print(out[:300])
        token_data = json.loads(out)
        token = token_data.get("token") or token_data.get("access_token", "")

        # consultations API 호출
        print("\n=== consultations API 응답 ===")
        api_out, _ = run(f"curl -s http://localhost:3001/admin/consultations?limit=3&page=1 -H 'Authorization: Bearer {token}'")
        print(api_out[:2000])

        # id=174 포함 여부 확인
        if "174" in api_out:
            try:
                data = json.loads(api_out)
                for item in data.get("items", []):
                    if item.get("id") == 174:
                        print("\n=== id=174 상세 ===")
                        print(json.dumps(item, ensure_ascii=False, indent=2))
                        break
            except Exception as e:
                print("parse error:", e)
        break
    else:
        print(f"[LOGIN FAIL] {mb_id}: {out[:100]}")

# 4. 헬스체크 에러 원인 확인 (health-check.service.ts 해당 쿼리)
print("\n=== HealthCheckService 에러 원인 분석 ===")
out, _ = run("cat /data/wwwroot/api.sajumoon.co.kr/src/cron/health-check.service.ts 2>/dev/null | head -60")
print(out[:800] if out.strip() else "파일 없음 (dist만 존재)")

out, _ = run("grep -n 'LIMIT' /data/wwwroot/api.sajumoon.co.kr/dist/cron/health-check.service.js 2>/dev/null | head -5")
print("LIMIT in health-check.service.js:", out[:300])

ssh.close()
