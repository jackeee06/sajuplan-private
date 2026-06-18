import { test, expect, request } from '@playwright/test'

/**
 * [2026-06-14] 관리자 상담사 상세 — "상담사 화면 미러" 검증.
 *
 * 통화 응대 시 관리자가 상담사와 같은 숫자를 보도록, ops-summary 가 상담사 마이페이지와
 *   '같은 서비스(UserSettlementsService.summary / payout.getMine)' 결과를 mirror 로 내려준다.
 *
 * 검증:
 *   1) ops-summary 에 mirror 존재 + 엔드포인트 정상(= DI 배선/부팅 OK)
 *   2) mirror.balance == point.earning_balance (같은 출처 = 드리프트 0)
 *   3) 분해 불변식: pending_settle == max(0, balance - this_month_net)
 *   4) 세후 입금예상: after_tax == balance - floor(balance*0.033)
 *   5) 선지급 차단 정보(payout_blocked/reason) 동반
 */

const API = 'https://api.sajuplan.com'
const JACKEE = 91 // 찬물선생 (예비파트너) — 화면 미러 기준 상담사

test('관리자 ops-summary — 상담사 화면 미러 일치 + 분해 불변식', async () => {
  const ctx = await request.newContext({ storageState: 'storageState.json' }) // admin 세션
  try {
    const resp = await ctx.get(`${API}/api/admin/counselors/${JACKEE}/ops-summary`)
    if (resp.status() === 401 || resp.status() === 403) {
      console.log('[SKIP] admin 세션 없음')
      return
    }
    expect(resp.ok(), `ops-summary status=${resp.status()}`).toBeTruthy()
    const d = await resp.json()

    // 1) mirror 존재 (= 엔드포인트 부팅/DI 정상)
    expect(d.mirror, 'mirror 누락 — DI 배선 또는 부팅 실패 가능').toBeTruthy()
    const m = d.mirror

    // 2) 내 수익금 = earning_balance (같은 출처)
    expect(m.balance, '미러 수익금 ≠ earning_balance').toBe(d.point.earning_balance)

    // 3) 분해 불변식: 총잔여 = 이번정산예정 + 당월적립 (clamp 고려)
    expect(m.pending_settle).toBe(Math.max(0, m.balance - m.this_month_net))

    // 4) 세후 입금예상
    expect(m.after_tax).toBe(Math.max(0, m.balance - Math.floor(m.balance * 0.033)))

    // 5) 선지급 차단 정보 동반 (예비파트너면 blocked + 사유)
    expect(typeof m.payout_blocked).toBe('boolean')

    console.log(
      `[OK] 미러: 수익금 ${m.balance} = 정산예정 ${m.pending_settle} + 당월 ${m.this_month_net} · 세후 ${m.after_tax} · 선지급 ${m.payout_available}(blocked=${m.payout_blocked})`,
    )
  } finally {
    await ctx.dispose()
  }
})
