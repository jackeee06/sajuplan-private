"""선지급(early payout) 더미 데이터 10건 시드 — 어드민/사용자 화면 흐름 시각화용.

명세: 사장님 요청 (2026-05-21) — "더미 10개 정도 보면 흐름 이해 빠를 것 같다"

데이터 다양성:
  - 상태: pending 3 / paid 4 / rejected 2 / cancelled 1
  - 금액: 30,000 ~ 500,000 (다양한 범위)
  - 시각: 1시간 전 ~ 며칠 전 (24h+ stale 케이스 포함)
  - 등급: preliminary / partner1 / partner3 / partner5 (스냅샷, member.grade 는 안 건드림)
  - 상담사: sample_c01 ~ sample_c10 (양 서버 공통 데모 상담사 풀)

⚠️ 더미 식별:
  - 모든 row 의 admin_memo 가 '[DEMO]' 로 시작
  - 오픈 전 일괄 삭제: DELETE FROM payout_request WHERE admin_memo LIKE '[DEMO]%';
  - payout_request_log 는 CASCADE 안 걸려있어 별도: DELETE FROM payout_request_log
      WHERE request_id IN (SELECT id FROM payout_request WHERE admin_memo LIKE '[DEMO]%');

⚠️ 재실행 안전:
  - 이미 [DEMO] row 가 있으면 SKIP (멱등성). 다시 넣고 싶으면 위 DELETE 후 실행.
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


# 10건 — (mb_id, status, amount, grade, available, requested_offset, decided_offset, paid_offset,
#         memo, reject_reason, settlement_month)
# offset 단위: hours (음수 = 과거)
DEMO_ROWS = [
    # 1. pending 최근 1시간 — 일반적 신청
    ('sample_c01', 'pending', 50000, 'preliminary', 250000,
     -1, None, None, '긴급 자금 필요', None, None),
    # 2. pending stale 50시간 — 24h+ 미처리 (대시보드 알림 케이스)
    ('sample_c02', 'pending', 30000, 'preliminary', 80000,
     -50, None, None, '월세 입금일', None, None),
    # 3. pending 어제 — 일반
    ('sample_c03', 'pending', 100000, 'partner1', 450000,
     -12, None, None, None, None, None),
    # 4. paid 오늘 새벽 — 가장 최근 지급
    ('sample_c04', 'paid', 80000, 'partner1', 380000,
     -8, -4, -3, None, None, '2026-05'),
    # 5. paid 며칠 전 — 중간 금액
    ('sample_c05', 'paid', 150000, 'partner3', 800000,
     -72, -68, -68, '병원 진료비', None, '2026-05'),
    # 6. paid 이번달 초 — 큰 정산
    ('sample_c06', 'paid', 200000, 'partner3', 950000,
     -240, -235, -235, None, None, '2026-05'),
    # 7. paid 가장 큰 금액 — 파트너5 (전속)
    ('sample_c07', 'paid', 500000, 'partner5', 1500000,
     -96, -92, -92, '학원비 일시납', None, '2026-05'),
    # 8. rejected — 계좌 오류 (자주 발생 케이스)
    ('sample_c08', 'rejected', 50000, 'preliminary', 120000,
     -26, -24, None, None, '계좌 정보 오류 — 재등록 후 다시 신청해주세요', None),
    # 9. rejected — 수익 부족
    ('sample_c09', 'rejected', 70000, 'preliminary', 50000,
     -48, -45, None, '이번달 통화 많음', '신청 시점 가용 한도 초과 — 통화 환불로 정산예상 감소', None),
    # 10. cancelled — 상담사 본인 취소
    ('sample_c10', 'cancelled', 40000, 'preliminary', 200000,
     -18, -16, None, '잘못 누름', None, None),
]


def build_sql() -> str:
    """10개 row 를 한 트랜잭션에 INSERT. 멱등성: 이미 있으면 통째로 SKIP."""
    lines: list[str] = ["BEGIN;"]

    # 멱등성 가드 — [DEMO] row 가 이미 있으면 ROLLBACK (no-op)
    lines.append("""
DO $do$
DECLARE
  cnt INT;
BEGIN
  SELECT COUNT(*) INTO cnt FROM payout_request WHERE admin_memo LIKE '[DEMO]%';
  IF cnt > 0 THEN
    RAISE NOTICE '이미 [DEMO] 데이터 % 건 있음. SKIP. 재시드 원하면 먼저 DELETE 필요.', cnt;
    RETURN;
  END IF;
""")

    for i, (mb_id, status, amount, grade, available, req_off, dec_off, paid_off,
            memo, reject, settle_month) in enumerate(DEMO_ROWS, start=1):
        fee = amount * 5 // 100      # 5%
        wh = amount * 33 // 1000     # 3.3%
        actual = amount - fee - wh

        memo_esc = memo.replace("'", "''") if memo else None
        reject_esc = reject.replace("'", "''") if reject else None
        memo_sql = f"'{memo_esc}'" if memo_esc else 'NULL'
        reject_sql = f"'{reject_esc}'" if reject_esc else 'NULL'
        settle_sql = f"'{settle_month}'" if settle_month else 'NULL'
        dec_sql = f"NOW() + INTERVAL '{dec_off} hours'" if dec_off is not None else 'NULL'
        paid_sql = f"NOW() + INTERVAL '{paid_off} hours'" if paid_off is not None else 'NULL'
        paid_at_sql = paid_sql  # for clarity

        # 계좌 스냅샷 — 데모용 마스킹 풀린 가짜 계좌
        bank_name = ['국민', '신한', '카카오뱅크', '농협', '우리', '하나'][i % 6]
        bank_account = f'{100 + i}-{2000 + i * 11}-{300000 + i * 1234}'

        # 상담사 이름 가져와서 예금주로
        # (회원 테이블 name 컬럼 — 동적으로 SELECT)

        lines.append(f"""
  INSERT INTO payout_request (
    counselor_id, requested_amount, fee_amount, withholding_amount, actual_payout,
    fee_rate_snapshot, available_at_request, grade_at_request,
    bank_name_snapshot, bank_holder_snapshot, bank_account_snapshot,
    status, request_memo, admin_memo, reject_reason, payment_proof,
    settlement_month, requested_at, decided_at, paid_at, settled_at,
    decided_by, created_at, updated_at
  )
  SELECT
    m.id, {amount}, {fee}, {wh}, {actual},
    0.05, {available}, '{grade}',
    '{bank_name}', m.name, '{bank_account}',
    '{status}', {memo_sql}, '[DEMO] 시드 #{i:02d}', {reject_sql},
    {f"'은행 앱 송금 완료 ({i:02d})'" if status == 'paid' else 'NULL'},
    {settle_sql},
    NOW() + INTERVAL '{req_off} hours',
    {dec_sql},
    {paid_at_sql},
    {paid_at_sql if status == 'paid' and settle_month else 'NULL'},
    {1 if dec_off is not None else 'NULL'},
    NOW() + INTERVAL '{req_off} hours',
    COALESCE({dec_sql}, NOW() + INTERVAL '{req_off} hours')
  FROM member m WHERE m.mb_id = '{mb_id}' LIMIT 1;
""")

        # payout_request_log — null → pending (모두) + pending → {status} (status != pending 인 것만)
        lines.append(f"""
  INSERT INTO payout_request_log (request_id, from_status, to_status, changed_by, reason, created_at)
  SELECT id, NULL, 'pending', 'self', {memo_sql},
         NOW() + INTERVAL '{req_off} hours'
    FROM payout_request WHERE admin_memo = '[DEMO] 시드 #{i:02d}';
""")
        if status != 'pending':
            lines.append(f"""
  INSERT INTO payout_request_log (request_id, from_status, to_status, changed_by, reason, created_at)
  SELECT id, 'pending', '{status}',
         {f"'self'" if status == 'cancelled' else "'admin:1'"},
         {reject_sql if status == 'rejected' else 'NULL'},
         {dec_sql}
    FROM payout_request WHERE admin_memo = '[DEMO] 시드 #{i:02d}';
""")

    lines.append("END $do$;")
    lines.append("COMMIT;")

    # 검증 출력
    lines.append("""
SELECT '=== payout demo summary ===' AS section;
SELECT status, COUNT(*)::int AS cnt,
       SUM(requested_amount)::int AS total_requested,
       SUM(actual_payout)::int AS total_actual
  FROM payout_request
 WHERE admin_memo LIKE '[DEMO]%'
 GROUP BY status
 ORDER BY status;

SELECT '=== payout demo rows ===' AS section;
SELECT pr.id, m.mb_id, pr.status,
       pr.requested_amount AS req, pr.actual_payout AS actual,
       pr.grade_at_request AS grade,
       pr.requested_at::date AS req_date,
       pr.settlement_month AS settle
  FROM payout_request pr LEFT JOIN member m ON m.id = pr.counselor_id
 WHERE pr.admin_memo LIKE '[DEMO]%'
 ORDER BY pr.requested_at DESC;
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
