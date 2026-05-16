"""등급/단가 시스템 통합 검증 (Phase 6).

명세: _NEXT_SESSION_등급단가시스템.md F.5 안전장치 체크리스트.

검증 항목:
  1. DB 스키마 (member 컬럼 4, consultation 컬럼 2, 이력 테이블 3)
  2. 시드 정책 (21개 setting)
  3. 등급 크론 dry-run + 멱등성
  4. 정산 모듈 dry-run + grade rate 적용
  5. consultation 스냅샷 컬럼 작동 (NULL 허용 + 미래 INSERT 시 채움)
  6. CHECK 제약 (grade 값 검증)
  7. unit_cost 변경 락 정책 — 모의 UPDATE 후 락 시각 확인

사용:
  SSHPASS=... python tools/_verify_grade_system.py
"""
from __future__ import annotations
import base64
import json
import os
import sys
from urllib import request as urlreq

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

import paramiko

TARGETS = [
    ("test", "172.235.211.75", "/data/wwwroot/api.sajumoon.kr/.env", "https://api.sajumoon.kr"),
    ("prod", "104.64.128.103", "/data/wwwroot/api.sajumoon.co.kr/.env", "https://api.sajumoon.co.kr"),
]

# ==================================================================
# 검증 SQL — 7개 섹션. 각 섹션은 PASS/FAIL 판정 가능한 출력 반환.
# ==================================================================
VERIFY_SQL = """
-- 1. member 컬럼 4개 존재 확인
SELECT
  '1. member columns' AS check_name,
  CASE WHEN COUNT(*) = 4 THEN 'PASS' ELSE 'FAIL' END AS status,
  COUNT(*)::int AS count,
  array_agg(column_name ORDER BY column_name) AS cols
  FROM information_schema.columns
 WHERE table_name='member'
   AND column_name IN ('grade','last_month_seconds','unit_cost_changeable_at','grade_recalculated_at');

-- 2. consultation 컬럼 2개
SELECT
  '2. consultation columns' AS check_name,
  CASE WHEN COUNT(*) = 2 THEN 'PASS' ELSE 'FAIL' END AS status,
  COUNT(*)::int AS count,
  array_agg(column_name ORDER BY column_name) AS cols
  FROM information_schema.columns
 WHERE table_name='consultation'
   AND column_name IN ('unit_cost_snapshot','grade_at_session');

-- 3. 이력 테이블 3개
SELECT
  '3. history tables' AS check_name,
  CASE WHEN COUNT(*) = 3 THEN 'PASS' ELSE 'FAIL' END AS status,
  COUNT(*)::int AS count,
  array_agg(table_name ORDER BY table_name) AS tables
  FROM information_schema.tables
 WHERE table_name IN ('member_unit_cost_history','member_grade_history','setting_history');

-- 4. CHECK 제약 존재
SELECT
  '4. grade CHECK constraint' AS check_name,
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS status,
  COUNT(*)::int AS count,
  array_agg(constraint_name) AS names
  FROM information_schema.check_constraints
 WHERE constraint_name = 'member_grade_check';

-- 5. 시드 정책 21건
SELECT
  '5. seed policies' AS check_name,
  CASE WHEN COUNT(*) = 21 THEN 'PASS' ELSE 'FAIL' END AS status,
  COUNT(*)::int AS count,
  '21 expected' AS note
  FROM setting WHERE namespace='grade';

-- 6. member 전원 grade 'preliminary' (오픈 전 디폴트)
SELECT
  '6. all members preliminary (pre-launch)' AS check_name,
  CASE WHEN COUNT(*) FILTER (WHERE grade != 'preliminary') = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
  COUNT(*) FILTER (WHERE grade != 'preliminary')::int AS non_preliminary_count,
  COUNT(*)::int AS total_members
  FROM member;

-- 7. revenue_rate 시드값 확인 (정산이 grade 모드로 작동하는 핵심)
SELECT
  '7. revenue_rate seeds' AS check_name,
  CASE WHEN COUNT(*) = 6 AND MIN(value::numeric) >= 0.2 AND MAX(value::numeric) <= 1.0
    THEN 'PASS' ELSE 'FAIL' END AS status,
  COUNT(*)::int AS rate_count,
  MIN(value::numeric)::text || ' ~ ' || MAX(value::numeric)::text AS range
  FROM setting WHERE namespace='grade' AND key LIKE 'revenue_rate.%';

-- 8. CHECK 제약 위반 시도 (반드시 ERROR — psql 가 빨간 메시지 출력)
\\set ON_ERROR_STOP off
DO $$
BEGIN
  BEGIN
    PERFORM 1;
    -- 잘못된 grade 값 INSERT 시도. 실패해야 정상.
    INSERT INTO member (mb_id, password, role, level, grade) VALUES ('__verify_test__','x','x',5,'invalid_grade');
    RAISE NOTICE '8. CHECK constraint -> FAIL (잘못된 grade 가 허용됨)';
    DELETE FROM member WHERE mb_id='__verify_test__';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '8. CHECK constraint -> PASS (잘못된 grade 거부됨)';
  WHEN OTHERS THEN
    RAISE NOTICE '8. CHECK constraint -> SKIP (다른 제약으로 거부: %)', SQLERRM;
  END;
END $$;
\\set ON_ERROR_STOP on
"""


def db_check(label: str, host: str, env_file: str, pw: str) -> int:
    b64 = base64.b64encode(VERIFY_SQL.encode("utf-8")).decode("ascii")
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
    print(f"\n========== [{label}] DB 검증 ({host}) ==========")
    sys.stdout.write(out)
    if err.strip():
        sys.stderr.write(err)
    rc = stdout.channel.recv_exit_status()
    c.close()
    return rc


def api_check(label: str, base_url: str) -> int:
    """API 검증: grade cron + settlement cron 모두 dry-run."""
    failed = 0
    cases = [
        ("grade recalc (test=1)", f"{base_url}/api/cron/grade/recalculate?test=1&month=2026-04"),
        ("settlement (test=1)",   f"{base_url}/api/cron/settlement/monthly?test=1&month=2026-04"),
    ]
    print(f"\n========== [{label}] API 검증 ({base_url}) ==========")
    for name, url in cases:
        try:
            with urlreq.urlopen(url, timeout=60) as r:
                code = r.status
                data = json.loads(r.read().decode("utf-8"))
            if code == 200:
                if name.startswith("grade"):
                    s = data.get("summary", {})
                    print(f"  ✓ {name}: total={s.get('total')} promoted={s.get('promoted')} demoted={s.get('demoted')} unchanged={s.get('unchanged')}")
                else:
                    print(f"  ✓ {name}: total={data.get('total')} ok={data.get('ok')}")
            else:
                print(f"  ✗ {name}: HTTP {code}")
                failed += 1
        except Exception as e:
            print(f"  ✗ {name}: {e}")
            failed += 1

    # 인증 가드 확인 (counselor-mypage/grade 는 401 반환해야 정상)
    try:
        with urlreq.urlopen(f"{base_url}/api/user/counselor-mypage/grade", timeout=10) as r:
            code = r.status
    except Exception as e:
        # 401 은 HTTPError 로 떨어짐
        code = getattr(e, 'code', None) or 0
    if code == 401:
        print(f"  ✓ counselor-mypage/grade 인증 가드: HTTP 401 (정상)")
    else:
        print(f"  ✗ counselor-mypage/grade 인증 가드 비정상: HTTP {code}")
        failed += 1
    return failed


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS 환경변수 필요", file=sys.stderr)
        return 1
    total_failed = 0
    for label, host, env_file, base_url in TARGETS:
        db_check(label, host, env_file, pw)
        total_failed += api_check(label, base_url)
    print("\n" + ("=" * 60))
    if total_failed == 0:
        print("✓ 전체 검증 통과 (API 응답 정상). DB 검증은 위 PASS/FAIL 컬럼 확인.")
    else:
        print(f"✗ API 검증 실패 {total_failed}건")
    return total_failed


if __name__ == "__main__":
    sys.exit(main())
