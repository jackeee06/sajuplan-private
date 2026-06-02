"""상담사 추천 수당 — test 서버 시연 데이터 삽입.

대상 서버: test (172.235.211.75) 만 — prod 운영 DB 는 깨끗하게 유지.

설계:
  - 활성 상담사 (role='counselor', left_at IS NULL) 중 settlement_monthly 데이터가 있는 사람들로 5쌍 추천 관계 등록
  - 다양한 가입 시점 (1~6개월차) 시뮬레이션 — registered_at 을 임의로 조정
  - 1건은 paid_this_month=true (counselor_referral_payment INSERT)
  - memo='[DEMO]' 로 표시 → 운영자가 쉽게 식별/정리 가능

운영 흐름 보여주기:
  - 활성 + 2개월차 + 2% (미지급)
  - 활성 + 4개월차 + 1% (미지급)
  - 활성 + 5개월차 + 1% (지급완료)
  - 활성 + 6개월차 + 1% (지급완료, 곧 자동 만료)
  - 활성 + 1개월차 + 2% (미지급, 매출 없을 수도)
"""
import os, sys, paramiko, base64, json
from datetime import datetime, timedelta, timezone

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

HOST = "104.64.128.103"
DOMAIN = "api.sajuplan.com"

# 이 스크립트는 단 1회 실행 가정. 같은 referee_id 로 두 번 등록되면 UNIQUE 위반.
# 데모 데이터 사전 정리: DELETE FROM counselor_referral WHERE memo LIKE '[DEMO]%';

NODE_SCRIPT = r"""
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: false });
(async () => {
  try {
    // 0) 기존 DEMO 정리 (재실행 안전)
    const delPay = await sql.unsafe(
      "DELETE FROM counselor_referral_payment WHERE referral_id IN " +
      "(SELECT id FROM counselor_referral WHERE memo LIKE '[DEMO]%')"
    );
    const delRef = await sql.unsafe(
      "DELETE FROM counselor_referral WHERE memo LIKE '[DEMO]%'"
    );
    console.log('[cleanup] payments:', delPay.count, 'refs:', delRef.count);

    // 1) 활성 상담사 (role='counselor', left_at NULL) + settlement_monthly 보유 후보 조회
    //    매출이 있을수록 demo 가 풍부. id 정렬로 결정적 (재실행 동일 결과).
    const candidates = await sql`
      SELECT m.id, m.mb_id, m.nickname, m.name, m.created_at,
             (SELECT COALESCE(SUM(price),0) FROM settlement_monthly WHERE member_id = m.id) AS sales_total
        FROM member m
       WHERE m.role = 'counselor' AND m.left_at IS NULL
       ORDER BY m.id DESC
       LIMIT 50
    `;
    const withSales = candidates.filter(r => Number(r.sales_total) > 0);
    const withoutSales = candidates.filter(r => Number(r.sales_total) === 0);
    console.log('[candidates] sales>0:', withSales.length, ' sales=0:', withoutSales.length);

    if (candidates.length < 6) {
      console.error('상담사 후보 부족 — demo 불가');
      await sql.end();
      process.exit(1);
    }

    // 2) 추천자(A) 는 sales 가 있는 사람 1명, 피추천자(B) 는 다른 5명
    const referrer = withSales[0] || candidates[0];
    const refereePool = candidates.filter(c => Number(c.id) !== Number(referrer.id));
    // 피추천자 5명: 매출 있는 우선 → 매출 0 보충 (referrer 본인은 제외)
    const referees = [...withSales.filter(c => Number(c.id) !== Number(referrer.id)),
                      ...withoutSales.filter(c => Number(c.id) !== Number(referrer.id))].slice(0, 5);
    if (referees.length < 5) {
      while (referees.length < 5 && refereePool.length > referees.length) {
        const next = refereePool[referees.length];
        if (!referees.find(r => r.id === next.id)) referees.push(next);
        else break;
      }
    }
    if (referees.length < 3) {
      console.error('피추천자 후보 부족');
      await sql.end();
      process.exit(1);
    }

    console.log(`[referrer A] #${referrer.id} ${referrer.nickname || referrer.name} (mb_id=${referrer.mb_id})`);
    for (const r of referees) {
      console.log(`[referee  B] #${r.id} ${r.nickname || r.name} sales_total=${r.sales_total}`);
    }

    // 3) 5건 시나리오 — registered_at 을 임의로 (실제 created_at 와 별개로) 잡아 개월차 다양화.
    //    expires_at = registered_at + 6 months.
    //    paid_month 는 현재 기준 전월 (resolveMonth default).
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthStr = prevMonth.toISOString().slice(0, 10); // YYYY-MM-DD

    function monthsBefore(n, day=15) {
      // 전월 1일 기준 n개월차가 되도록 registered_at 잡기.
      // 예: prevMonth=2026-04-01, n=2 → registered_at = 2026-03-15 (2개월차)
      const d = new Date(prevMonth);
      d.setMonth(d.getMonth() - (n - 1));
      d.setDate(day);
      return d;
    }
    function addMonths(d, m) { const r = new Date(d); r.setMonth(r.getMonth() + m); return r; }

    const scenarios = [
      { idx: 0, monthN: 2, paid: false, memo: '[DEMO] 활성 · 2개월차 · 2% · 미지급' },
      { idx: 1, monthN: 4, paid: false, memo: '[DEMO] 활성 · 4개월차 · 1% · 미지급' },
      { idx: 2, monthN: 5, paid: true,  memo: '[DEMO] 활성 · 5개월차 · 1% · 지급완료' },
      { idx: 3, monthN: 6, paid: true,  memo: '[DEMO] 활성 · 6개월차 · 1% · 곧 만료' },
      { idx: 4, monthN: 1, paid: false, memo: '[DEMO] 활성 · 1개월차 · 2% · 미지급' },
    ];

    let okRefs = 0, okPays = 0;
    for (const s of scenarios) {
      if (!referees[s.idx]) continue;
      const referee = referees[s.idx];
      const registeredAt = monthsBefore(s.monthN);
      const expiresAt = addMonths(registeredAt, 6);
      // 추천 관계 INSERT
      const refRow = await sql`
        INSERT INTO counselor_referral
          (referrer_id, referee_id, registered_at, expires_at, status, memo, created_by_id)
        VALUES
          (${referrer.id}, ${referee.id}, ${registeredAt}, ${expiresAt},
           'active', ${s.memo}, NULL)
        RETURNING id
      `;
      okRefs++;
      const refId = Number(refRow[0].id);
      // 지급 완료 시나리오 → counselor_referral_payment INSERT (point 적립은 데모라 skip)
      if (s.paid) {
        const sales = Number(referee.sales_total) > 0 ? 100000 : 50000; // 가상 매출
        const rate = (s.monthN >= 4 ? 1.0 : 2.0);
        const paid = Math.floor((sales * rate) / 100);
        await sql`
          INSERT INTO counselor_referral_payment
            (referral_id, pay_month, rate_pct, referee_sales, paid_amount, paid_by_id, point_history_id, memo)
          VALUES
            (${refId}, ${prevMonthStr}, ${rate}, ${sales}, ${paid}, NULL, NULL, '[DEMO] 시연용 지급 기록')
        `;
        okPays++;
      }
    }
    console.log(`[insert] referrals: ${okRefs}, payments: ${okPays}`);

    // 4) 결과 요약
    const final = await sql`
      SELECT r.id, r.referrer_id, r.referee_id, r.status, r.registered_at, r.expires_at, r.memo,
             (SELECT COUNT(*) FROM counselor_referral_payment WHERE referral_id = r.id) AS pay_cnt
        FROM counselor_referral r
       WHERE r.memo LIKE '[DEMO]%'
       ORDER BY r.id
    `;
    console.log('[final] count:', final.length);
    for (const f of final) {
      console.log(`  #${f.id} A=${f.referrer_id} B=${f.referee_id} status=${f.status} pays=${f.pay_cnt} memo="${f.memo}"`);
    }
    await sql.end();
    process.exit(0);
  } catch (e) {
    console.error('ERR:', e.stack || e.message);
    await sql.end({ timeout: 1 });
    process.exit(1);
  }
})();
"""

def main():
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS 필요", file=sys.stderr)
        return 1
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)

    b64 = base64.b64encode(NODE_SCRIPT.encode("utf-8")).decode("ascii")
    cmd = (
        f"set -e; cd /data/wwwroot/{DOMAIN}; "
        f"echo {b64} | base64 -d > ./_seed_demo.js; "
        f"set -a; source .env; set +a; "
        f"node ./_seed_demo.js 2>&1; "
        f"rm -f ./_seed_demo.js"
    )
    _, stdout, stderr = c.exec_command(f"bash -lc {repr(cmd)}", timeout=90)
    print(stdout.read().decode("utf-8", "replace"))
    e = stderr.read().decode("utf-8", "replace")
    if e.strip(): print("stderr:", e, file=sys.stderr)
    c.close()
    return 0

if __name__ == "__main__":
    sys.exit(main())
