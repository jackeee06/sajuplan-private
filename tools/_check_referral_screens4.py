"""추천 코드 변경 화면 검증 — 인코딩 안전한 방식."""
import base64, os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"],
          allow_agent=False, look_for_keys=False, timeout=15)

def sh(cmd):
    _, out, err = c.exec_command(f"bash -c {repr(cmd)}", timeout=20)
    return out.read().decode("utf-8", errors="replace") + err.read().decode("utf-8", errors="replace")

# ① DB
def run(sql):
    b64 = base64.b64encode(sql.encode()).decode()
    cmd = ('export DATABASE_URL=$(grep -E "^DATABASE_URL=" '
           '/data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) && '
           f'echo {b64} | base64 -d | psql "$DATABASE_URL"')
    _, out, err = c.exec_command(f"bash -lc {repr(cmd)}", timeout=20)
    return out.read().decode("utf-8", errors="replace")

print("=== ① DB: 상담사 referral_code = mb_id ===")
print(run("SELECT COUNT(*) FILTER (WHERE referral_code=mb_id) AS ok, COUNT(*) FILTER (WHERE referral_code!=mb_id) AS bad FROM member WHERE role='counselor' AND left_at IS NULL;"))

print("=== ② API: mb_id 발급 로직 (base64 search) ===")
# 'mb_id' 문자열 base64
target = base64.b64encode(b'referral_code = mb_id').decode()
# 대신 직접 텍스트로
print(sh("grep -c 'mb_id' /data/wwwroot/api.sajumoon.co.kr/dist/admin/counselor-apply/counselor-apply.service.js 2>&1"))
print(sh("grep -c 'LOWER' /data/wwwroot/api.sajumoon.co.kr/dist/admin/counselor-apply/counselor-apply.service.js 2>&1"))

print("=== ③ user 번들 경로 확인 ===")
print(sh("ls /data/wwwroot/sajuplan.com/assets/ 2>&1 | head -3"))
print(sh("ls /data/wwwroot/sajumoon.co.kr/assets/ 2>&1 | head -3"))

print("=== ④ user 번들: 신청서 placeholder (ASCII로 검색) ===")
# "jackee" 검색 (추천인의 아이디 placeholder에 포함)
print(sh("grep -rl 'jackee' /data/wwwroot/sajuplan.com/assets/*.js 2>&1 | wc -l"))
print(sh("grep -c 'jackee' /data/wwwroot/sajuplan.com/assets/*.js 2>&1 | grep -v ':0' | head -3"))

print("=== ⑤ mng 번들: 정책 패널 (Settings2 아이콘 확인) ===")
print(sh("grep -rl 'Settings2' /data/wwwroot/sajuplan.com/mng/assets/*.js 2>&1 | wc -l"))

print("=== ⑥ 핸드북 MD ===")
print(sh("ls /data/wwwroot/api.sajumoon.co.kr/_HANDBOOK/promotion/ 2>&1"))
print(sh("wc -l /data/wwwroot/api.sajumoon.co.kr/_HANDBOOK/promotion/02-referral.md 2>&1"))
print(sh("wc -l /data/wwwroot/api.sajumoon.co.kr/_HANDBOOK/promotion/02-referral.tech.md 2>&1"))

c.close()
