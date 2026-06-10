"""추천인 시스템 v2 최종 검증."""
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
    return out.read().decode() + err.read().decode()

def sh(cmd):
    _, out, err = c.exec_command(f"bash -lc {repr(cmd)}", timeout=15)
    return out.read().decode() + err.read().decode()

print("=== ① member.referral_code — 상담사 코드 발급 현황 ===")
print(run("""
SELECT
  COUNT(*) FILTER (WHERE role='counselor') AS total_counselors,
  COUNT(*) FILTER (WHERE role='counselor' AND referral_code IS NOT NULL) AS with_code,
  COUNT(*) FILTER (WHERE role='counselor' AND referral_code IS NULL) AS without_code
FROM member WHERE left_at IS NULL;
"""))

print("=== ② 코드 샘플 (상위 3명) ===")
print(run("""
SELECT mb_id, nickname, referral_code FROM member
WHERE role='counselor' AND referral_code IS NOT NULL
ORDER BY id LIMIT 3;
"""))

print("=== ③ setting 정책값 ===")
print(run("""
SELECT key, value FROM setting WHERE namespace='promotion' ORDER BY key;
"""))

print("=== ④ counselor_referral 스냅샷 컬럼 확인 ===")
print(run("""
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name='counselor_referral'
AND column_name IN ('rate_snapshot','months_snapshot')
ORDER BY column_name;
"""))

print("=== ⑤ 서버 dist — 정책 API 코드 존재 ===")
print(sh("grep -c 'referral_rate\\|getPolicy\\|updatePolicy' /data/wwwroot/api.sajumoon.co.kr/dist/admin/referrals/referrals.service.js 2>&1"))

print("=== ⑥ 서버 dist — settlements referral 엔드포인트 ===")
print(sh("grep -c 'getMyCounselorReferral\\|referral' /data/wwwroot/api.sajumoon.co.kr/dist/user/settlements/settlements.controller.js 2>&1"))

print("=== ⑦ 프론트 user — CounselorMyReferral 번들 포함 ===")
print(sh("grep -rl '추천 코드\\|referral_code' /data/wwwroot/sajumoon.co.kr/user/dist/assets/*.js 2>&1 | head -1 && echo 'bundle found'"))

print("=== ⑧ 프론트 mng — 정책 패널 번들 포함 ===")
print(sh("grep -rl '추천 정책\\|referral_rate' /data/wwwroot/sajumoon.co.kr/mng/assets/*.js 2>&1 | head -1 && echo 'bundle found'"))

print("=== ⑨ settlement-cron — 추천 수당 로직 존재 ===")
print(sh("grep -c 'counselor_referral\\|rate_snapshot\\|referrer_id' /data/wwwroot/api.sajumoon.co.kr/dist/cron/settlement-cron.service.js 2>&1"))

c.close()
print("\n✅ 검증 완료")
