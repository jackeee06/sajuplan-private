#!/usr/bin/env python
"""health-check API를 직접 호출해서 에러 없는지 확인"""
import paramiko
import sys
import json
import time

for s in (sys.stdout, sys.stderr):
    try:
        s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

host = "104.64.128.103"
root_pw = "saju26moon@!!"
JWT_SECRET = "cd67ec50f0ac59c532b835100ca1dbedd8d6d91e809cd54a3666bbb13749bd0e0ebbf2f87f8ac8394b660f4fc3340d0e6be2672915d03a830ac08b0bd0b27887"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username="root", password=root_pw, timeout=15)

def run(cmd, timeout=30):
    _, out, err = ssh.exec_command(cmd, timeout=timeout)
    return out.read().decode("utf-8", "replace"), err.read().decode("utf-8", "replace")

# node로 SUPER admin JWT 생성 (is_super=true)
node_code = (
    "const j=require('/data/wwwroot/api.sajumoon.co.kr/node_modules/jsonwebtoken');"
    f"const s='{JWT_SECRET}';"
    "const t=j.sign({sub:90, mb_id:'gisu', role:'admin', is_super:true},s,{expiresIn:'1h'});"
    "console.log(t);"
)
out, err = run(f"node -e \"{node_code}\"")
token = out.strip()
print(f"Token: {token[:60]}...")

# cron health-check API 호출 (GET /api/cron/health-check)
print("\n=== health-check API 호출 ===")
out, err = run(
    f"curl -s http://localhost:3001/api/cron/health-check "
    f"-H 'Authorization: Bearer {token}' 2>&1",
    timeout=30
)
print("Response:", out[:1000])

# 에러 로그 확인 (방금 전 이후)
print("\n=== 방금 에러 로그 ===")
out, _ = run("tail -10 /root/.pm2/logs/sajumoon-api-error-0.log 2>/dev/null")
has_syntax_err = "syntax error at or near" in out
print(f"syntax error 있음: {has_syntax_err}")
print("recent log tail:", out[-300:])

ssh.close()
