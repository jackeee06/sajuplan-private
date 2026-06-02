"""서버의 실제 코드 상태 + PM2 로그 확인."""
import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"],
          allow_agent=False, look_for_keys=False, timeout=15)

def run(cmd):
    _, out, err = c.exec_command(f"bash -lc {repr(cmd)}", timeout=20)
    return out.read().decode() + err.read().decode()

# 서버의 consultations.service.ts에 Number() 픽스가 있는지
print("=== 서버 소스: Number() 변환 있는지 ===")
print(run("grep -n 'Number(row.amt)' /data/wwwroot/api.sajumoon.co.kr/src/admin/consultations/consultations.service.ts 2>&1 | head -5"))

# _patch_api.py의 FILES 목록 확인
print("=== _patch_api.py FILES 목록 ===")
print(run("grep -n 'consultations' /data/wwwroot/api.sajumoon.co.kr/src/admin/consultations/consultations.service.ts 2>&1 | head -3"))

# PM2 에러 로그
print("=== PM2 에러 로그 (최근 30줄) ===")
print(run("pm2 logs sajumoon-api --err --nostream --lines 30 2>&1 | tail -30"))

# dist 폴더의 compiled JS 확인
print("=== 컴파일된 JS에 Number 변환 있는지 ===")
print(run("grep -n 'Number(row' /data/wwwroot/api.sajumoon.co.kr/dist/admin/consultations/consultations.service.js 2>&1 | head -5"))

c.close()
