"""최종 검증 — 올바른 경로로."""
import os, sys, paramiko, base64
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

def run(sql):
    b64 = base64.b64encode(sql.encode()).decode()
    cmd = ('export DATABASE_URL=$(grep -E "^DATABASE_URL=" '
           '/data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) && '
           f'echo {b64} | base64 -d | psql "$DATABASE_URL"')
    _, out, err = c.exec_command(f"bash -lc {repr(cmd)}", timeout=20)
    return out.read().decode("utf-8", errors="replace")

# sajumoon.co.kr = user 프론트 실제 경로
USER  = "/data/wwwroot/sajumoon.co.kr/assets"
MNG   = "/data/wwwroot/sajumoon.co.kr/mng/assets"
API   = "/data/wwwroot/api.sajumoon.co.kr/dist"
HB    = "/data/wwwroot/api.sajumoon.co.kr/_HANDBOOK"

print("=== ① DB: referral_code = mb_id (17명) ===")
print(run("SELECT COUNT(*) FILTER (WHERE referral_code=mb_id) ok, COUNT(*) FILTER (WHERE referral_code!=mb_id) bad FROM member WHERE role='counselor' AND left_at IS NULL;"))

print("=== ② API dist: mb_id + LOWER 존재 ===")
print("mb_id count:", sh(f"grep -c 'mb_id' {API}/admin/counselor-apply/counselor-apply.service.js 2>&1").strip())
print("LOWER count:", sh(f"grep -c 'LOWER' {API}/admin/counselor-apply/counselor-apply.service.js 2>&1").strip())

print("\n=== ③ mng 번들: PolicyPanel(추천정책) ===")
print("Settings2:", sh(f"grep -rl 'Settings2' {MNG}/*.js 2>&1 | wc -l").strip(), "files")
print("policy    :", sh(f"grep -rl 'policy' {MNG}/*.js 2>&1 | wc -l").strip(), "files")

print("\n=== ④ user 번들: 신청서 'jackee' placeholder ===")
print("jackee:", sh(f"grep -rl 'jackee' {USER}/*.js 2>&1 | wc -l").strip(), "files found")

print("\n=== ⑤ user 번들: 마이페이지 추천현황 ===")
print("referral:", sh(f"grep -rl 'referral' {USER}/*.js 2>&1 | wc -l").strip(), "files")
print("CounselorMyReferral:", sh(f"grep -rl 'CounselorMyReferral\\|counselor.mypage.referral' {USER}/*.js 2>&1 | wc -l").strip(), "files")

print("\n=== ⑥ 핸드북 MD ===")
print("02-referral.md    :", sh(f"wc -l {HB}/promotion/02-referral.md 2>&1").strip())
print("02-referral.tech.md:", sh(f"wc -l {HB}/promotion/02-referral.tech.md 2>&1").strip())

c.close()
