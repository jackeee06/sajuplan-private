"""추천 코드 변경 화면 검증 — 올바른 경로."""
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
           f'echo {b64} | base64 -d | psql "$DATABASE_URL"')
    _, out, err = c.exec_command(f"bash -lc {repr(cmd)}", timeout=20)
    return out.read().decode()

def sh(cmd):
    _, out, err = c.exec_command(f"bash -lc {repr(cmd)}", timeout=15)
    return out.read().decode() + err.read().decode()

USER_JS  = "/data/wwwroot/sajuplan.com/assets/*.js"
MNG_JS   = "/data/wwwroot/sajuplan.com/mng/assets/*.js"
API_DIST = "/data/wwwroot/api.sajumoon.co.kr/dist"
HANDBOOK = "/data/wwwroot/api.sajumoon.co.kr/_handbook"

print("=== ① DB: referral_code = mb_id (18명 전원) ===")
r = run("SELECT COUNT(*) FILTER (WHERE referral_code=mb_id) AS ok, COUNT(*) FILTER (WHERE referral_code!=mb_id) AS bad FROM member WHERE role='counselor' AND left_at IS NULL;")
print(r)

print("=== ② API dist: mb_id 발급 + LOWER 검색 ===")
print(sh(f"grep -c 'referral_code.*mb_id\\|LOWER.*referral' {API_DIST}/admin/counselor-apply/counselor-apply.service.js 2>&1"))

print("=== ③ mng 번들: 정책 설명 (수익금의) ===")
print(sh(f"grep -oh '수익금의[^<\"]*' {MNG_JS} 2>/dev/null | head -2 || echo '(minified — 직접 검색)'"))
print(sh(f"grep -c '추천 정책\\|referral_rate' {MNG_JS} 2>&1"))

print("=== ④ user 번들: 신청서 placeholder (추천인의 아이디) ===")
print(sh(f"grep -ohl '추천인의 아이디' {USER_JS} 2>&1 | head -1"))
FOUND = sh(f"grep -rl '추천인의 아이디' {USER_JS} 2>&1")
print("Found in bundle:", "YES ✅" if "추천인의 아이디" in sh(f"grep -h '추천인의 아이디' {USER_JS} 2>&1") else "NO ❌")

print("=== ⑤ user 번들: 마이페이지 '내 아이디를 입력' ===")
print("Found:", "YES ✅" if "내 아이디를 입력" in sh(f"grep -h '내 아이디를 입력' {USER_JS} 2>&1") else "NO ❌")

print("=== ⑥ 핸드북 MD: v2 내용 존재 ===")
print(sh(f"ls {HANDBOOK}/promotion/ 2>&1"))
print(sh(f"grep -c 'mb_id\\|rate_snapshot' {HANDBOOK}/promotion/02-referral.tech.md 2>&1"))

c.close()
print("\n검증 완료")
