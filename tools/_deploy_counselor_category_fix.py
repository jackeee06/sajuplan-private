"""counselors.service.js (counselor_category 진실원 fix) 배포 + 검증."""
import os, sys, time
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=30)
s = c.open_sftp()
local = r"C:\claudeworkspace\sajumoon\api\dist\user\counselors\counselors.service.js"
remote = "/data/wwwroot/api.sajumoon.co.kr/dist/user/counselors/counselors.service.js"
s.put(local, remote)
print(f"[uploaded] size={s.stat(remote).st_size}")
s.close()
_, o, _ = c.exec_command("pm2 restart sajumoon-api > /tmp/pm2.log 2>&1; echo done", get_pty=False)
print("[restart]", o.read().decode("utf-8", errors="replace").strip())
time.sleep(5)

# 검증 — 신점 카테고리 API 호출
_, o, _ = c.exec_command('curl -s "https://api.sajuplan.com/api/user/counselors?category=%EC%8B%A0%EC%A0%90&limit=20" | python3 -c "import sys, json; d=json.load(sys.stdin); print(f\\"신점 카테고리 결과 {len(d.get(\\\"items\\\",[]))}건:\\"); [print(f\\" - {i.get(\\\"nickname\\\",\\\"?\\\")} (id={i.get(\\\"id\\\")}, csrid={i.get(\\\"csrid\\\")})\\") for i in d.get(\\"items\\",[])]"', get_pty=False, timeout=15)
print(o.read().decode("utf-8", errors="replace"))

print()
_, o, _ = c.exec_command('curl -s "https://api.sajuplan.com/api/user/counselors?category=%ED%83%80%EB%A1%9C&limit=20" | python3 -c "import sys, json; d=json.load(sys.stdin); print(f\\"타로 카테고리 결과 {len(d.get(\\\"items\\\",[]))}건:\\"); [print(f\\" - {i.get(\\\"nickname\\\",\\\"?\\\")} (id={i.get(\\\"id\\\")})\\") for i in d.get(\\"items\\",[])]"', get_pty=False, timeout=15)
print(o.read().decode("utf-8", errors="replace"))

c.close()
