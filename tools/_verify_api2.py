#!/usr/bin/env python
"""API 엔드포인트 탐색 및 수익 분해 필드 검증"""
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
print("SSH connected")

def run(cmd, timeout=25):
    _, out, err = ssh.exec_command(cmd, timeout=timeout)
    o = out.read().decode("utf-8", "replace")
    e = err.read().decode("utf-8", "replace")
    return o, e

def psql(sql, timeout=20):
    cmd = f"PGPASSWORD={db_pass} psql -h 127.0.0.1 -U {db_user} -d {db_name} -c \"{sql}\" 2>&1"
    out, _ = run(cmd, timeout)
    return out

# auth 라우트 확인
print("\n=== auth routes in dist ===")
out, _ = run("grep -r 'login\\|auth' /data/wwwroot/api.sajumoon.co.kr/dist/admin/ 2>/dev/null | grep 'Post\\|route\\|path' | head -10")
print(out[:400])

out, _ = run("ls /data/wwwroot/api.sajumoon.co.kr/dist/ 2>/dev/null")
print("\ndist dirs:", out[:300])

out, _ = run("ls /data/wwwroot/api.sajumoon.co.kr/dist/admin/ 2>/dev/null | head -20")
print("dist/admin:", out[:300])

# 로그인 endpoint 탐색
out, _ = run("grep -r 'login' /data/wwwroot/api.sajumoon.co.kr/dist/admin/ 2>/dev/null | grep -i 'post\\|route' | head -5")
print("login route:", out[:300])

# 관리자 로그인 직접 시도 (여러 경로)
print("\n=== login endpoint 탐색 ===")
for endpoint in ["/admin/auth/login", "/mng/auth/login", "/api/admin/login", "/auth/admin/login"]:
    payload = '{"mb_id":"gisu","password":"saju26moon@!!"}'
    out, _ = run(f"curl -s -X POST http://localhost:3001{endpoint} -H 'Content-Type: application/json' -d '{payload}'")
    status_line = out[:200]
    if "404" not in status_line and "Cannot" not in status_line:
        print(f"[HIT] {endpoint}: {status_line}")
    else:
        print(f"[404] {endpoint}")

# ADMIN_JWT_SECRET으로 직접 토큰 생성
print("\n=== JWT 직접 생성 시도 ===")
jwt_secret = "cd67ec50f0ac59c532b835100ca1dbedd8d6d91e809cd54a3666bbb13749bd0e0ebbf2f87f8ac8394b660f4fc3340d0e6be2672915d03a830ac08b0bd0b27887"
out, _ = run("node -e \"const jwt=require('/data/wwwroot/api.sajumoon.co.kr/node_modules/jsonwebtoken'); const t=jwt.sign({mb_id:'gisu',role:'admin'}, process.env.SECRET, {expiresIn:'1h'}); console.log(t);\" SECRET=" + jwt_secret)
print("generated token:", out[:200])

# consultations 엔드포인트 직접 curl (토큰 없이)
print("\n=== consultations API (no auth) ===")
out, _ = run("curl -s http://localhost:3001/admin/consultations?limit=2 2>&1")
print(out[:400])

# HealthCheck 에러 원인 - src 확인
print("\n=== HealthCheck SQL 에러 원인 ===")
out, _ = run("grep -n 'LIMIT' /data/wwwroot/api.sajumoon.co.kr/dist/cron/health-check.service.js 2>/dev/null | head -5")
print("health-check LIMIT:", out[:400])

out, _ = run("grep -n 'LIMIT\\|sql' /data/wwwroot/api.sajumoon.co.kr/dist/cron/health-check.service.js 2>/dev/null | head -20")
print("health-check queries:", out[:600])

ssh.close()
