"""추천인 시스템 DB 마이그레이션 적용 (prod)."""
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
    cmd = (
        'export DATABASE_URL=$(grep -E "^DATABASE_URL=" '
        '/data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) && '
        f'echo {b64} | base64 -d | psql "$DATABASE_URL" -v ON_ERROR_STOP=1'
    )
    _, out, err = c.exec_command(f"bash -lc {repr(cmd)}", timeout=30)
    result = out.read().decode()
    e = err.read().decode()
    if e: print("ERR:", e, file=sys.stderr)
    return result

sql = open("c:/claudeworkspace/sajumoon/api/db/migrations/20260604000000_referral_system.sql",
           encoding="utf-8").read()

print("=== 마이그레이션 실행 ===")
print(run(sql))

print("=== 결과 확인 ===")
print(run("""
SELECT
  (SELECT COUNT(*) FROM member WHERE referral_code IS NOT NULL) AS members_with_code,
  (SELECT COUNT(*) FROM member WHERE role='counselor' AND referral_code IS NOT NULL) AS counselors_with_code,
  (SELECT value FROM setting WHERE namespace='promotion' AND key='referral_rate') AS rate,
  (SELECT value FROM setting WHERE namespace='promotion' AND key='referral_months') AS months;
"""))

print("=== counselor_referral 컬럼 확인 ===")
print(run("""
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'counselor_referral'
ORDER BY ordinal_position;
"""))

c.close()
