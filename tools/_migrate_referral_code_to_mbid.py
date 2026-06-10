"""기존 상담사 referral_code → mb_id 일괄 교체."""
import base64, os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"],
          allow_agent=False, look_for_keys=False, timeout=15)

def run(sql):
    b64 = base64.b64encode(sql.encode()).decode()
    cmd = ('export DATABASE_URL=$(grep -E "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) && '
           f'echo {b64} | base64 -d | psql "$DATABASE_URL" -v ON_ERROR_STOP=1')
    _, out, err = c.exec_command(f"bash -lc {repr(cmd)}", timeout=20)
    return out.read().decode() + err.read().decode()

print("=== 변경 전 현황 ===")
print(run("""
SELECT mb_id, nickname, referral_code FROM member
WHERE role='counselor' AND left_at IS NULL
ORDER BY id LIMIT 10;
"""))

print("=== referral_code → mb_id 일괄 교체 ===")
print(run("""
UPDATE member
SET referral_code = mb_id
WHERE role = 'counselor'
RETURNING mb_id, referral_code;
"""))

print("=== 변경 후 확인 ===")
print(run("""
SELECT mb_id, nickname, referral_code,
       (mb_id = referral_code) AS matched
FROM member
WHERE role='counselor' AND left_at IS NULL
ORDER BY id LIMIT 10;
"""))

c.close()
