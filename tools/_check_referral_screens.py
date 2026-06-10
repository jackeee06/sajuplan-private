"""추천 코드 mb_id 변경이 모든 화면에 반영됐는지 확인."""
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
    return out.read().decode()

# ① DB — 모든 상담사 코드가 mb_id와 일치하는지
print("=== ① DB: referral_code = mb_id 여부 ===")
print(run("""
SELECT
  COUNT(*) FILTER (WHERE referral_code = mb_id) AS matched,
  COUNT(*) FILTER (WHERE referral_code != mb_id) AS mismatched,
  COUNT(*) FILTER (WHERE referral_code IS NULL) AS null_code
FROM member WHERE role='counselor' AND left_at IS NULL;
"""))

# ② 서버 dist — 승인 로직에 mb_id 방식 반영됐는지
print("=== ② API dist: mb_id 발급 로직 ===")
print(sh("grep -c 'referral_code = mb_id\\|LOWER(referral' /data/wwwroot/api.sajumoon.co.kr/dist/admin/counselor-apply/counselor-apply.service.js 2>&1"))

# ③ mng 번들 — 정책 설명 업데이트 됐는지
print("=== ③ mng 번들: 정책 문구 ===")
print(sh("grep -oh '수익금의.*정산' /data/wwwroot/sajumoon.co.kr/mng/assets/*.js 2>&1 | head -2"))

# ④ user 번들 — 신청서 placeholder 업데이트 됐는지
print("=== ④ user 번들: 신청서 placeholder ===")
print(sh("grep -oh '추천인의 아이디\\|CSR-' /data/wwwroot/sajuplan.com/dist/assets/*.js 2>&1 | head -3"))

# ⑤ user 번들 — 마이페이지 추천 현황 문구
print("=== ⑤ user 번들: 마이페이지 '내 아이디' 문구 ===")
print(sh("grep -oh '내 아이디를 입력\\|이 코드를 상담사' /data/wwwroot/sajuplan.com/dist/assets/*.js 2>&1 | head -2"))

# ⑥ 핸드북 MD — 최신 내용 포함 여부
print("=== ⑥ 핸드북 MD: v2 내용 ===")
print(sh("grep -c 'mb_id\\|rate_snapshot\\|v2' /data/wwwroot/sajuplan.com/_handbook/promotion/02-referral.tech.md 2>&1"))

c.close()
