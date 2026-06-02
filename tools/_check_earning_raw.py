"""jackee point_history + consultation 원본 데이터 확인 (읽기 전용)."""
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
        f'echo {b64} | base64 -d | psql "$DATABASE_URL"'
    )
    _, out, err = c.exec_command(f"bash -lc {repr(cmd)}", timeout=30)
    result = out.read().decode()
    e = err.read().decode()
    if e: print("ERR:", e, file=sys.stderr)
    return result


# jackee가 상담사로 받은 point_history 전체
print("=== jackee 상담사 적립 point_history ===")
print(run("""
SELECT ph.id, ph.earn_point, ph.balance_after,
       ph.rel_id, ph.content
FROM point_history ph
WHERE ph.member_id = 91
  AND ph.earn_point > 0
ORDER BY ph.id;
"""))

# jackee가 상담사로 한 consultation 내역
print("=== jackee 상담사 consultation 내역 ===")
print(run("""
SELECT cs.id, cs.amt, cs.amt_free, cs.amt_pro,
       cs.reason, cs.usetm,
       FLOOR(cs.amt * 0.40) as expected_earn,
       cs.created_at::date
FROM consultation cs
WHERE cs.counselor_id = 91
  AND cs.reason IN ('DISCONNECT','END_CHAT')
ORDER BY cs.id;
"""))

# 현재 point 테이블 상태
print("=== jackee 현재 point 잔액 ===")
print(run("""
SELECT m.mb_id, m.nickname, m.grade,
       p.paid_balance, p.free_balance, p.earning_balance, p.total_earned
FROM member m JOIN point p ON p.member_id=m.id
WHERE m.id=91;
"""))

c.close()
