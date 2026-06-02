#!/usr/bin/env python
"""JWT 구조 확인 및 올바른 토큰 생성"""
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

def psql(sql):
    cmd = f"PGPASSWORD={db_pass} psql -h 127.0.0.1 -U {db_user} -d {db_name} -c \"{sql}\" 2>&1"
    out, _ = run(cmd)
    return out

# auth guard / strategy 파일 찾기
out, _ = run("find /data/wwwroot/api.sajumoon.co.kr/dist -name '*.js' | xargs grep -l 'JwtStrategy\\|validateToken\\|fromAuthHeader' 2>/dev/null | head -5")
print("JWT related files:", out[:300])

# auth service login 확인
out, _ = run("grep -A 15 'async login' /data/wwwroot/api.sajumoon.co.kr/dist/admin/auth/auth.service.js 2>/dev/null | head -25")
print("login method:", out[:600])

# JWT sign 확인 (payload 구조)
out, _ = run("grep -A5 'sign\\|payload\\|jwtService' /data/wwwroot/api.sajumoon.co.kr/dist/admin/auth/auth.service.js 2>/dev/null | head -30")
print("sign payload:", out[:500])

# gisu 계정 상세
r = psql("SELECT id, mb_id, role, level FROM member WHERE mb_id='gisu' LIMIT 1;")
print("gisu account:", r)

# JWT secret 재확인
out, _ = run("grep ADMIN_JWT /data/wwwroot/api.sajumoon.co.kr/.env 2>/dev/null | head -3")
print("JWT env:", out[:300])

# node로 올바른 payload 로 토큰 생성
node_code = r"""
const j = require('/data/wwwroot/api.sajumoon.co.kr/node_modules/jsonwebtoken');
const secret = 'cd67ec50f0ac59c532b835100ca1dbedd8d6d91e809cd54a3666bbb13749bd0e0ebbf2f87f8ac8394b660f4fc3340d0e6be2672915d03a830ac08b0bd0b27887';
// 다양한 payload 구조 시도
const payloads = [
  {mb_id:'gisu', role:'admin', sub:'gisu'},
  {mb_id:'gisu', role:'admin', id:2},
  {id:2, role:'admin'},
  {sub:2, role:'admin'},
  {mb_id:'gisu', role:'admin'},
];
payloads.forEach((p,i) => {
  const t = j.sign(p, secret, {expiresIn:'2h'});
  console.log('P'+i+':', t);
});
"""
out, err = run(f"node -e \"{node_code.strip()}\"")
print("tokens:", out[:800])
print("err:", err[:100])

ssh.close()
