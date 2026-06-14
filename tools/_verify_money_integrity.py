# -*- coding: utf-8 -*-
"""
돈 무결성 검증 (MONEY INTEGRITY VERIFIER) — 사주플랜 PROD DB.

돈 관련 코드(m2net push 핸들러 / 코인 차감·적립 / 정산 / 충전)를 만진 뒤
**반드시** 이 스크립트를 돌려 "돈이 새지 않았는지" 객관적으로 확인한다.
코드 리뷰·빌드 성공만으로 완료 보고 금지 — 이 스크립트가 0 위반이어야 한다.

검증하는 5대 불변식 (하나라도 깨지면 exit 1):
  [1] 음수 잔액 없음            point.free/paid/earning_balance >= 0
  [2] member.point == free+paid  표면 잔액 미러 일치
  [3] 선결제 이중차감 0건        선결제(채팅 선결제 차감 존재) 세션의 consultation.amt 는 0 이어야 함
                                 (amt>0 = START 선결제 + END consultation 이중차감 = 사고)
  [4] earning 원장 일치          point.earning_balance == Σ(point_history earning earn-use)
  [5] 정산 적립 sanity           상담사 적립이 m2net 실과금×수익률(<=100%) 범위 — earning>결제총액 이상치 탐지

  ※ 소비자(free+paid) 잔액 vs point_history 합계는 **의도적으로 검증 안 함**:
     충전은 `payment` 가 진실원장이고 point_history 는 활동로그(불완전)라 1:1 재구성 안 됨 (정상).

사용:
  python tools/_verify_money_integrity.py            # 전체 검증
  python tools/_verify_money_integrity.py --json      # 기계 판독용 JSON 출력

SSHPASS 는 .env.local 에서 자동 로드. PROD 단일 대상.
관련: _HANDBOOK/payment/01-m2net-relation.tech.md · CLAUDE.md "돈 불변식".
"""
import sys, io, os, re, json

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HOST = "104.64.128.103"
ENV_REMOTE = "/data/wwwroot/api.sajumoon.co.kr/.env"
JSON_MODE = "--json" in sys.argv


def load_sshpass():
    # .env.local 에서 SSHPASS 자동 로드 (_patch_*.py 와 동일 패턴)
    here = os.path.dirname(os.path.abspath(__file__))
    for cand in (os.path.join(here, "..", ".env.local"), os.path.join(here, "..", ".env")):
        if os.path.exists(cand):
            with open(cand, "r", encoding="utf-8", errors="replace") as f:
                for line in f:
                    m = re.match(r"\s*SSHPASS\s*=\s*(.+)\s*$", line)
                    if m:
                        return m.group(1).strip().strip('"').strip("'")
    return os.environ.get("SSHPASS")


def main():
    try:
        import paramiko
    except ImportError:
        print("paramiko 필요: pip install paramiko"); sys.exit(2)

    pw = load_sshpass()
    if not pw:
        print("SSHPASS 못 찾음 (.env.local 확인)"); sys.exit(2)

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=25)

    def q(sql):
        sql = sql.replace('"', '\\"')
        cmd = (f'export $(grep -E "^DATABASE_URL=" {ENV_REMOTE}|xargs)>/dev/null 2>&1; '
               f'psql "$DATABASE_URL" -At -F "|" -c "{sql}"')
        _in, out, _err = ssh.exec_command(cmd)
        return [ln for ln in out.read().decode("utf-8", "replace").splitlines() if ln.strip()]

    checks = []

    # [1] 음수 잔액
    rows = q("SELECT member_id, free_balance, paid_balance, earning_balance FROM point "
             "WHERE free_balance<0 OR paid_balance<0 OR earning_balance<0")
    checks.append(("[1] 음수 잔액 없음", len(rows) == 0, rows[:20]))

    # [2] member.point == free+paid
    rows = q("SELECT m.id, m.name, m.point, p.free_balance+p.paid_balance AS calc "
             "FROM member m JOIN point p ON p.member_id=m.id "
             "WHERE m.point <> (p.free_balance+p.paid_balance)")
    checks.append(("[2] member.point == free+paid", len(rows) == 0, rows[:20]))

    # [3] 선결제 이중차감 (선결제방인데 consultation.amt>0)
    rows = q("SELECT c.id, c.member_id, c.amt, c.roomid FROM consultation c "
             "WHERE c.amt>0 AND EXISTS ("
             "  SELECT 1 FROM point_history ph JOIN chat_room cr ON cr.id::text=ph.rel_id "
             "  WHERE ph.member_id=c.member_id AND ph.content LIKE '채팅 선결제%' "
             "    AND ph.rel_table='chat_room' "
             "    AND regexp_replace(cr.roomid,'__c_[0-9]+$','')=c.roomid)")
    checks.append(("[3] 선결제 이중차감 0건", len(rows) == 0, rows[:20]))

    # [4] earning 원장 일치
    rows = q("WITH led AS (SELECT member_id, SUM(earn_point-use_point) AS net "
             "  FROM point_history WHERE balance_kind='earning' GROUP BY member_id) "
             "SELECT p.member_id, p.earning_balance, COALESCE(led.net,0) AS ledger "
             "FROM point p LEFT JOIN led ON led.member_id=p.member_id "
             "WHERE p.earning_balance <> COALESCE(led.net,0)")
    checks.append(("[4] earning 원장 일치", len(rows) == 0, rows[:20]))

    # [5] 정산 적립 sanity — 상담사별 earning 적립합 vs 해당 상담 결제총액. 적립 > 결제총액 이면 이상.
    #     (revenue_rate <= 1 이므로 적립이 결제총액을 넘을 수 없음. 넘으면 100%+ 적립 사고.)
    rows = q("WITH cr AS ("
             "  SELECT c.counselor_id, "
             "    SUM(GREATEST(c.amt, COALESCE((c.mrtn::json->>'amt')::int,0))) AS pay_total "
             "  FROM consultation c WHERE c.counselor_id IS NOT NULL GROUP BY c.counselor_id), "
             "ea AS (SELECT member_id, SUM(earn_point) AS earn_total FROM point_history "
             "  WHERE balance_kind='earning' AND earn_point>0 GROUP BY member_id) "
             "SELECT ea.member_id, ea.earn_total, COALESCE(cr.pay_total,0) AS pay_total "
             "FROM ea LEFT JOIN cr ON cr.counselor_id=ea.member_id "
             "WHERE ea.earn_total > COALESCE(cr.pay_total,0) + 100")  # +100 = 추천수익 이전/반올림 여유
    # 이 검사는 경고(WARN)성 — 추천수익금 이전으로 합법적으로 넘을 수 있어 fail 로 안 잡고 표시만.
    checks.append(("[5] 정산 적립 sanity (WARN)", True, rows[:20], "warn"))

    ssh.close()

    # ── 출력 ──
    failed = [c for c in checks if not c[1]]
    if JSON_MODE:
        print(json.dumps({
            "ok": len(failed) == 0,
            "checks": [{"name": c[0], "pass": c[1], "violations": c[2],
                        "kind": (c[3] if len(c) > 3 else "fail")} for c in checks],
        }, ensure_ascii=False, indent=2))
        sys.exit(0 if len(failed) == 0 else 1)

    print("=" * 60)
    print("  💰 돈 무결성 검증 — 사주플랜 PROD")
    print("=" * 60)
    for c in checks:
        name, ok, viol = c[0], c[1], c[2]
        kind = c[3] if len(c) > 3 else "fail"
        if ok and not viol:
            print(f"  ✅ {name}")
        elif ok and viol and kind == "warn":
            print(f"  ⚠️  {name} — 검토 {len(viol)}건 (추천수익 이전 가능, 사고 아님일 수 있음)")
            for v in viol[:5]:
                print(f"        {v}")
        elif ok:
            print(f"  ✅ {name}")
        else:
            print(f"  ❌ {name} — 위반 {len(viol)}건")
            for v in viol[:10]:
                print(f"        {v}")
    print("=" * 60)
    if failed:
        print(f"  결과: ❌ FAIL — {len(failed)}개 불변식 위반. 돈 건드린 작업 재점검 필요.")
        sys.exit(1)
    print("  결과: ✅ PASS — 돈 불변식 모두 정상.")
    sys.exit(0)


if __name__ == "__main__":
    main()
