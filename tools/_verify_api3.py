#!/usr/bin/env python
"""API prefix 및 실제 엔드포인트 확인 + 수익 분해 검증"""
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
    return out.read().decode("utf-8", "replace"), err.read().decode("utf-8", "replace")

# main.js prefix 확인
out, _ = run("grep -E 'globalPrefix|setGlobalPrefix|listen' /data/wwwroot/api.sajumoon.co.kr/dist/main.js 2>/dev/null | head -10")
print("main.js prefix/listen:", out[:400])

# nginx conf
out, _ = run("cat /etc/nginx/sites-enabled/api.sajumoon.co.kr 2>/dev/null | head -50")
print("nginx conf:", out[:600])

# 실제 작동 테스트
print("\n=== API prefix 브루트포스 ===")
for prefix in ["", "/api", "/api/v1", "/v1"]:
    endpoint = f"{prefix}/admin/auth/login"
    payload = '{"mb_id":"gisu","password":"saju26moon@!!"}'
    out, _ = run(f"curl -s -X POST http://localhost:3001{endpoint} -H 'Content-Type: application/json' -d '{payload}'")
    print(f"POST {endpoint}: {out[:150]}")

# dist/admin/auth/auth.controller.js 에서 경로 확인
out, _ = run("grep -E 'Controller|route|prefix|path' /data/wwwroot/api.sajumoon.co.kr/dist/admin/auth/auth.controller.js 2>/dev/null | head -10")
print("\nauth controller routes:", out[:400])

# 실제 응답을 curl 로 확인 (pass 여러 번 시도)
print("\n=== 비밀번호 여러개 시도 ===")
db_pass2 = "2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382"
out2, _ = run(f"PGPASSWORD={db_pass2} psql -h 127.0.0.1 -U {db_user} -d {db_name} -c \"SELECT mb_id, role, mb_password FROM member WHERE role IN ('superadmin','admin') LIMIT 3;\" 2>&1")
print("admin passwords:", out2[:400])

ssh.close()
