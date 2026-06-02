"""더미 상담사 등급/통화 데이터 시드 — 선지급 신청 가능하게 (2026-05-21).

사장님 시연용:
  - 더미 10명 모두 preliminary 라 [예비파트너 차단] 정책에 걸려 신청 자체 X
  - 5명에게 등급 다양화 + 이번 달 가짜 통화 데이터 INSERT
  - 결과: 그 5명은 가용 한도 채워져서 신청 모달 시연 가능

다른 5명 (sample_c06/c08/c09/c10) 은 preliminary 유지 — "차단 메시지" 시연용.

⚠️ 더미 식별:
  - consultation 의 unit_cost_snapshot 가 8888 (현실에 없는 값) → 일괄 삭제 식별자
  - 삭제 SQL:
      DELETE FROM consultation WHERE unit_cost_snapshot = 8888;
      UPDATE member SET grade='preliminary'
        WHERE mb_id IN ('sample_c01','sample_c03','sample_c04','sample_c05','sample_c07');

⚠️ 재실행 안전: 멱등성 (이미 8888 데이터 있으면 SKIP).
"""
from __future__ import annotations
import base64
import os
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

import paramiko

TARGETS = [
    ("test", "172.235.211.75", "/data/wwwroot/api.sajumoon.kr/.env"),
    ("prod", "104.64.128.103", "/data/wwwroot/api.sajumoon.co.kr/.env"),
]


# (mb_id, grade, 통화_건수_amt합)
# revenue_rate: preliminary 35% / partner1 45% / partner2 55% / partner3 60% / partner4 65% / partner5 70%
# 가용 = amt × revenue_rate × 0.7
ASSIGNMENTS = [
    ('sample_c01', 'partner1', 400000),  # → 가용 약 126,000원
    ('sample_c03', 'partner2', 600000),  # → 가용 약 231,000원
    ('sample_c04', 'partner3', 800000),  # → 가용 약 336,000원
    ('sample_c05', 'partner4', 1000000), # → 가용 약 455,000원
    ('sample_c07', 'partner5', 1500000), # → 가용 약 735,000원 (큰 금액 시연용)
]


def build_sql() -> str:
    lines: list[str] = ["BEGIN;"]

    # 멱등성: 이미 8888 시드 있으면 SKIP
    lines.append("""
DO $do$
DECLARE
  cnt INT;
BEGIN
  SELECT COUNT(*) INTO cnt FROM consultation WHERE unit_cost_snapshot = 8888;
  IF cnt > 0 THEN
    RAISE NOTICE '이미 데모 통화 % 건 있음. SKIP.', cnt;
    RETURN;
  END IF;
""")

    for mb_id, grade, total_amt in ASSIGNMENTS:
        # member.grade UPDATE
        lines.append(f"""
  UPDATE member SET grade = '{grade}' WHERE mb_id = '{mb_id}';
""")
        # consultation 3건 INSERT (총합 = total_amt)
        # 각자 amt_free / amt_pro 적절히 분배 (대부분 paid 통화로)
        per_call = total_amt // 3
        for i in range(3):
            # 매번 다른 날짜로 (이번 달 5/8/12일)
            day = 5 + i * 3
            amt = per_call
            amt_free = amt // 5   # 20% 무료 (가입 보너스 등)
            amt_pro = amt - amt_free
            usetm = 600 + i * 300  # 10분, 15분, 20분
            lines.append(f"""
  INSERT INTO consultation (
    member_id, counselor_id, reason, amt, amt_free, amt_pro, usetm,
    unit_cost_snapshot, grade_at_session,
    created_at, refund_status
  )
  SELECT
    1, m.id, 'DISCONNECT', {amt}, {amt_free}, {amt_pro}, {usetm},
    8888, '{grade}',
    (date_trunc('month', NOW() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul')
      + INTERVAL '{day} days' + INTERVAL '14 hours',
    NULL
  FROM member m WHERE m.mb_id = '{mb_id}';
""")

    lines.append("END $do$;")
    lines.append("COMMIT;")

    # 검증
    lines.append("""
SELECT '=== member grades updated ===' AS section;
SELECT mb_id, name, grade
  FROM member
 WHERE mb_id IN ('sample_c01','sample_c02','sample_c03','sample_c04','sample_c05',
                 'sample_c06','sample_c07','sample_c08','sample_c09','sample_c10')
 ORDER BY mb_id;

SELECT '=== 이번달 더미 통화 합산 (가용 한도 계산 source) ===' AS section;
SELECT m.mb_id, m.grade,
       COUNT(*)::int AS cnt,
       SUM(c.amt)::int AS amt_total,
       SUM(c.amt_free)::int AS amt_free,
       SUM(c.amt_pro)::int AS amt_pro
  FROM consultation c JOIN member m ON m.id = c.counselor_id
 WHERE c.unit_cost_snapshot = 8888
 GROUP BY m.mb_id, m.grade
 ORDER BY m.mb_id;
""")

    return '\n'.join(lines)


def apply_one(label: str, host: str, env_file: str, pw: str) -> int:
    sql = build_sql()
    b64 = base64.b64encode(sql.encode("utf-8")).decode("ascii")
    inner = (
        f'export DATABASE_URL=$(grep -E "^DATABASE_URL=" {env_file} | cut -d= -f2-) && '
        f'echo {b64} | base64 -d | psql "$DATABASE_URL"'
    )
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    _, stdout, stderr = c.exec_command(f"bash -lc {repr(inner)}", get_pty=False)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    print(f"\n========== {label} ({host}) ==========")
    sys.stdout.write(out)
    if err.strip():
        sys.stderr.write(err)
    rc = stdout.channel.recv_exit_status()
    c.close()
    return rc


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS env var required", file=sys.stderr)
        return 1
    rc_total = 0
    for label, host, env_file in TARGETS:
        rc = apply_one(label, host, env_file, pw)
        if rc != 0:
            rc_total = rc
    return rc_total


if __name__ == "__main__":
    sys.exit(main())
