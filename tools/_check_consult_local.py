"""서버에서 직접 DB 조회 — consultations 수익 분해 API 로직 시뮬레이션."""
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


# API 로직과 동일한 쿼리 — consultations service 의 실제 SELECT 재현
print("=== consultation API 로직 시뮬 (상위 5건) ===")
print(run("""
SELECT
  cs.id,
  cs.amt,
  cs.reason,
  c.grade AS counselor_grade,
  (SELECT NULLIF(s.value,'')::numeric
     FROM setting s
    WHERE s.namespace='grade' AND s.key = 'revenue_rate.' || COALESCE(c.grade,'')
    LIMIT 1
  ) AS counselor_revenue_rate,
  -- 수익 분해 계산
  CASE WHEN cs.amt > 0 THEN FLOOR(cs.amt * 0.15) ELSE NULL END AS m2net_deduction,
  CASE WHEN cs.amt > 0 THEN
    FLOOR(cs.amt * COALESCE(
      (SELECT NULLIF(s.value,'')::numeric
         FROM setting s
        WHERE s.namespace='grade' AND s.key = 'revenue_rate.' || COALESCE(c.grade,'')
        LIMIT 1),
      0))
  ELSE NULL END AS counselor_earning,
  CASE WHEN cs.amt > 0 THEN FLOOR(cs.amt * 0.23) ELSE NULL END AS sajuplan_revenue
FROM consultation cs
LEFT JOIN member m ON m.id = cs.member_id
LEFT JOIN member c ON c.id = cs.counselor_id
WHERE cs.csrid IS NOT NULL AND cs.csrid <> ''
  AND cs.reason IN ('DISCONNECT','END_CHAT')
ORDER BY cs.created_at DESC, cs.id DESC
LIMIT 5;
"""))

# profit_simulator_config 테이블 존재 확인
print("=== profit_simulator_config 상태 ===")
print(run("""
SELECT admin_id,
       (data->'m2net'->>'telecom_rate')::text AS telecom_rate,
       (data->'m2net'->>'phone_call_rate')::text AS phone_call_rate,
       updated_at::date
FROM profit_simulator_config
ORDER BY updated_at DESC LIMIT 1;
"""))

c.close()
