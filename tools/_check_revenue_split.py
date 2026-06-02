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


# jackee 등급
print("=== jackee 등급 + royalty_pct ===")
print(run("""
SELECT m.mb_id, m.nickname, m.grade,
       m.free_royalty_pct, m.paid_royalty_pct
FROM member m
WHERE m.mb_id = 'jackee';
"""))

# 수익금 계산 시뮬레이션 (23,000원 기준)
print("=== 정산 시뮬레이션 — 23,000코인 기준 ===")
print(run("""
WITH rate AS (
  SELECT m.grade, m.free_royalty_pct, m.paid_royalty_pct,
         COALESCE(
           (SELECT NULLIF(s.value,'')::numeric
            FROM setting s
            WHERE s.namespace='grade' AND s.key='revenue_rate.' || m.grade
            LIMIT 1),
           m.paid_royalty_pct::numeric / 100
         ) AS revenue_rate
  FROM member m WHERE m.mb_id='jackee'
)
SELECT
  grade,
  revenue_rate,
  23000 AS 고객지불코인,
  FLOOR(23000 * revenue_rate) AS 상담사몫_priceTot,
  FLOOR(FLOOR(23000 * revenue_rate) / 1.1) AS supply,
  FLOOR(FLOOR(FLOOR(23000 * revenue_rate) / 1.1) * 0.033) AS 원천징수,
  FLOOR(FLOOR(23000 * revenue_rate) / 1.1) -
    FLOOR(FLOOR(FLOOR(23000 * revenue_rate) / 1.1) * 0.033) AS 실수령_예상,
  23000 - FLOOR(23000 * revenue_rate) AS 사주플랜_마진
FROM rate;
"""))

# 수익금 내역 화면이 쓰는 API — settlements.service.ts 쿼리 확인
# earning_balance vs 실제 정산 비교
print("=== 찬물선생 현재 earning vs 예상 정산액 ===")
print(run("""
SELECT p.earning_balance AS 현재_수익금_표시,
       m.grade,
       s.value::numeric AS revenue_rate,
       FLOOR(p.earning_balance * s.value::numeric) AS 실제_정산예상_counselor몫,
       p.earning_balance - FLOOR(p.earning_balance * s.value::numeric) AS 사주플랜_마진
FROM member m
JOIN point p ON p.member_id = m.id
LEFT JOIN setting s ON s.namespace='grade' AND s.key = 'revenue_rate.' || m.grade
WHERE m.mb_id = 'jackee';
"""))

c.close()
