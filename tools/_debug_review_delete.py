#!/usr/bin/env python3
"""JWT sub 확인 + review member_id 확인"""
import os, sys, json, base64, urllib.request, urllib.error, paramiko

for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

API = "https://api.sajuplan.com"
DB = "postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon"

# 1. 로그인해서 쿠키 확인
login_data = json.dumps({"mb_id": "e2e_member", "password": "e2e_test_2026"}).encode()
req = urllib.request.Request(f"{API}/api/user/auth/login", data=login_data,
    headers={"Content-Type": "application/json"}, method="POST")
with urllib.request.urlopen(req) as r:
    cookies = r.getheader("Set-Cookie", "")
    body = json.loads(r.read())

cookie_val = ""
for part in cookies.split(";"):
    p = part.strip()
    if p.startswith("sjm_user="):
        cookie_val = p
        break

# JWT 페이로드 디코딩
token = cookie_val.replace("sjm_user=", "")
parts = token.split(".")
if len(parts) >= 2:
    padded = parts[1] + "=" * (4 - len(parts[1]) % 4)
    payload = json.loads(base64.urlsafe_b64decode(padded))
    print(f"[JWT payload] sub={payload.get('sub')}, mb_id={payload.get('mb_id')}")

# 2. 최근 생성된 review(id=142)의 member_id 확인
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', os.environ['SSHPASS'], allow_agent=False, look_for_keys=False, timeout=15)

def q(sql):
    _, o, _ = c.exec_command(f'psql {DB} -c "{sql}"', timeout=10)
    return o.read().decode('utf-8','replace').strip()

print("\n[review id=142 확인]")
print(q("SELECT id, member_id, mb_id, counselor_id, NOW()-created_at AS age FROM post_review WHERE id = 142"))

print("\n[e2e_member DB id 확인]")
print(q("SELECT id, mb_id FROM member WHERE mb_id = 'e2e_member'"))

c.close()
