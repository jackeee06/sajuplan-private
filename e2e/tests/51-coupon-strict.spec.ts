import { test, expect } from '@playwright/test'

/**
 * [2026-06-10] A-8 쿠폰 — 실사용자 손가락 동작 엄격검증
 *
 * 검증:
 *  1. 보유 쿠폰 목록 조회 (available)
 *  2. 쿠폰 사용 → 정확히 +1000코인 (free_balance)
 *  3. 같은 쿠폰 재사용 → 409 차단 (멱등성)
 *  4. 재사용 차단 후 잔액 변화 없음
 *  5. 사용된 쿠폰은 available 목록에서 사라지고 used 목록에 나타남
 *  6. C-8 invariant (total = free + paid) 전 구간 유지
 *
 * 사전: e2e_member(140)에게 coupon id=28 (cz_point=1000) 발급됨.
 */

const BASE = 'https://api.sajuplan.com/api'
const COUPON_ID = 28
const EXPECTED_COIN = 1000

test.describe.serial('쿠폰 — 실사용자 엄격검증', () => {
  test.use({ storageState: 'user_member_storage.json' })

  test('보유 쿠폰 사용 → +1000코인 → 재사용 차단 → 정합성 전체 흐름', async ({ request }) => {
    // ── Step 1: 사용 전 잔액 + 쿠폰 목록 ──
    const b0 = await request.get(`${BASE}/user/points/balance`)
    expect(b0.status()).toBe(200)
    const bal0 = await b0.json() as Record<string, number>
    const free0 = Number(bal0.free)
    const total0 = Number(bal0.total)
    console.log(`[사용 전] free=${free0}, total=${total0}`)
    expect(total0, 'C-8 사용전').toBe(Number(bal0.free) + Number(bal0.paid))

    // 보유 쿠폰 목록에 28이 있는지
    const listRes = await request.get(`${BASE}/user/coupons?status=available`)
    expect(listRes.status()).toBe(200)
    const listBody = await listRes.json() as Record<string, unknown>
    const items = Array.isArray(listBody.items) ? listBody.items
      : Array.isArray(listBody) ? listBody : []
    console.log(`[보유 쿠폰] ${items.length}장`)
    const target = items.find((c: Record<string, unknown>) => Number(c.id) === COUPON_ID)

    if (!target) {
      // 이미 사용됐을 수 있음 (이전 테스트 실행) — 스킵
      console.log(`[SKIP] coupon ${COUPON_ID} 미보유 — 이미 사용됨 가능성`)
      test.skip(true, `coupon ${COUPON_ID} 없음 — DB 재발급 필요`)
      return
    }
    console.log(`[대상 쿠폰] id=${COUPON_ID}, point=${(target as Record<string, unknown>).point}`)

    // ── Step 2: 쿠폰 사용 ──
    const use = await request.post(`${BASE}/user/coupons/${COUPON_ID}/use`, {
      headers: { 'Content-Type': 'application/json' },
    })
    console.log(`[쿠폰 사용] status=${use.status()}`)
    expect([200, 201], `쿠폰 사용 실패: ${use.status()}`).toContain(use.status())
    const useResult = await use.json() as Record<string, unknown>
    console.log(`[사용 결과] ${JSON.stringify(useResult)}`)
    expect(Number(useResult.point), '지급 코인 불일치').toBe(EXPECTED_COIN)

    // ── Step 3: 사용 후 잔액 → +1000 검증 ──
    const b1 = await request.get(`${BASE}/user/points/balance`)
    const bal1 = await b1.json() as Record<string, number>
    const free1 = Number(bal1.free)
    const total1 = Number(bal1.total)
    console.log(`[사용 후] free=${free1}, total=${total1}`)

    expect(free1 - free0, `free_balance 증가 불일치: 예상 +${EXPECTED_COIN}, 실제 +${free1 - free0}`).toBe(EXPECTED_COIN)
    expect(total1 - total0, `total 증가 불일치`).toBe(EXPECTED_COIN)
    expect(total1, 'C-8 사용후').toBe(Number(bal1.free) + Number(bal1.paid))
    console.log(`[+${EXPECTED_COIN}코인 확인] ${free0} → ${free1}`)

    // ── Step 4: 같은 쿠폰 재사용 → 차단 ──
    const dup = await request.post(`${BASE}/user/coupons/${COUPON_ID}/use`, {
      headers: { 'Content-Type': 'application/json' },
    })
    console.log(`[재사용 시도] status=${dup.status()}`)
    // 이미 사용된 쿠폰 → 409 ConflictException
    expect(dup.status(), '쿠폰 재사용이 차단되지 않음 — 코인 이중 지급 위험').toBe(409)

    // 재사용 차단 후 잔액 변화 없음
    const b2 = await request.get(`${BASE}/user/points/balance`)
    const bal2 = await b2.json() as Record<string, number>
    expect(Number(bal2.total), '재사용 차단됐는데 잔액 변동').toBe(total1)
    console.log(`[재사용 차단 OK] 잔액 유지: ${total1}`)

    // ── Step 5: available 목록에서 사라지고 used 목록에 나타남 ──
    const availRes = await request.get(`${BASE}/user/coupons?status=available`)
    const availBody = await availRes.json() as Record<string, unknown>
    const availItems = Array.isArray(availBody.items) ? availBody.items
      : Array.isArray(availBody) ? availBody : []
    const stillAvail = availItems.find((c: Record<string, unknown>) => Number(c.id) === COUPON_ID)
    expect(stillAvail, '사용된 쿠폰이 available 목록에 남아있음').toBeFalsy()

    const usedRes = await request.get(`${BASE}/user/coupons?status=used`)
    const usedBody = await usedRes.json() as Record<string, unknown>
    const usedItems = Array.isArray(usedBody.items) ? usedBody.items
      : Array.isArray(usedBody) ? usedBody : []
    const inUsed = usedItems.find((c: Record<string, unknown>) => Number(c.id) === COUPON_ID)
    expect(inUsed, '사용된 쿠폰이 used 목록에 없음').toBeTruthy()
    console.log(`[목록 전환 OK] available에서 사라지고 used에 나타남`)
  })
})
