import { test, expect } from '@playwright/test'

/**
 * [2026-06-10] A-7 후기 코인 — 실사용자 손가락 동작 엄격검증
 *
 * 시나리오: e2e_member 계정 + consultation_id=194 (600초, 미작성)
 *  1. 후기 작성 전 잔액 측정
 *  2. 후기 작성 (사진 없음) → 정확히 +500코인 (free_balance) 증가
 *  3. 같은 상담 재작성 시도 → 400 차단 (중복 방지)
 *  4. 후기 삭제 → 정확히 -500코인 회수
 *  5. 삭제 후 잔액이 작성 전과 동일 (순증가 0)
 *  6. C-8 invariant 전 구간 유지
 *
 * 주의: 이 테스트는 실제 후기를 작성/삭제하므로 멱등하지 않음.
 *       consultation_id=194는 1회용. 실패 시 DB 정리 필요.
 *       삭제는 5분 이내만 가능하므로 작성 직후 삭제로 클린업.
 */

const BASE = 'https://api.sajuplan.com/api'
const CONSULTATION_ID = 194
const COUNSELOR_ID = 102
const EXPECTED_COIN = 500  // setting.review.payout_amount

test.describe.serial('후기 코인 — 실사용자 엄격검증', () => {
  test.use({ storageState: 'user_member_storage.json' })

  let createdReviewId: number | null = null

  // consultation_id=194에는 이미 과거 후기(138/139/141/142)가 존재 → 중복 차단이 작동해야 함.
  // 이 테스트는 "수정된 중복 차단이 실제로 막는가"를 검증한다.
  test('★ 중복 차단 검증 — 이미 후기 있는 상담에 작성 시도 → 400 차단 (코인 미지급)', async ({ request }) => {
    const b0 = await request.get(`${BASE}/user/points/balance`)
    const bal0 = await b0.json() as Record<string, number>
    const total0 = Number(bal0.total)
    console.log(`[작성 전] total=${total0}`)

    const create = await request.post(`${BASE}/user/reviews`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        counselor_id: COUNSELOR_ID,
        title: '[E2E] 중복 차단 검증',
        content: '이미 후기 있는 상담에 재작성 — 반드시 400 차단되어야 함',
        rating: 5,
        consultation_id: CONSULTATION_ID,
      },
    })
    console.log(`[중복 작성 시도] status=${create.status()}`)

    // 핵심: 반드시 400 (이미 후기 작성한 상담)
    expect(create.status(), '중복 차단 실패 — 코인 이중 지급 버그 미수정').toBe(400)
    const err = await create.json() as Record<string, unknown>
    console.log(`[차단 메시지] ${JSON.stringify(err.message ?? err)}`)

    // 코인 미지급 확인
    const b1 = await request.get(`${BASE}/user/points/balance`)
    const bal1 = await b1.json() as Record<string, number>
    expect(Number(bal1.total), '차단됐는데 코인 지급됨').toBe(total0)
    console.log(`[코인 미지급 확인 OK] 잔액 유지: ${total0}`)
  })

  test.skip('후기 작성 → +500코인 → 재작성차단 → 삭제 → -500코인 회수 전체 흐름', async ({ request }) => {
    // ── Step 1: 작성 전 잔액 ──
    const b0 = await request.get(`${BASE}/user/points/balance`)
    expect(b0.status()).toBe(200)
    const bal0 = await b0.json() as Record<string, number>
    const free0 = Number(bal0.free)
    const total0 = Number(bal0.total)
    console.log(`[작성 전] free=${free0}, total=${total0}`)
    expect(total0, 'C-8 작성전').toBe(Number(bal0.free) + Number(bal0.paid))

    // ── Step 2: 후기 작성 ──
    const create = await request.post(`${BASE}/user/reviews`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        counselor_id: COUNSELOR_ID,
        title: '[E2E 검증] 후기 코인 테스트',
        content: '엄격검증용 후기입니다. 5분 이상 상담 완료. 자동 삭제 예정.',
        rating: 5,
        consultation_id: CONSULTATION_ID,
      },
    })
    console.log(`[후기 작성] status=${create.status()}`)

    if (create.status() === 400) {
      // 이미 작성된 경우 — 이전 테스트 잔재. 스킵하되 로그 남김
      const err = await create.json() as Record<string, unknown>
      console.log(`[SKIP] 후기 작성 불가: ${JSON.stringify(err)}`)
      test.skip(true, `consultation_id=${CONSULTATION_ID} 이미 후기 존재 — DB 정리 필요`)
      return
    }
    expect([200, 201], `후기 작성 실패: ${create.status()}`).toContain(create.status())
    const review = await create.json() as Record<string, unknown>
    createdReviewId = Number(review.id)
    console.log(`[후기 작성됨] reviewId=${createdReviewId}`)
    expect(createdReviewId, 'reviewId 없음').toBeGreaterThan(0)

    // ── Step 3: 작성 후 잔액 → +500 검증 ──
    const b1 = await request.get(`${BASE}/user/points/balance`)
    const bal1 = await b1.json() as Record<string, number>
    const free1 = Number(bal1.free)
    const total1 = Number(bal1.total)
    console.log(`[작성 후] free=${free1}, total=${total1}`)

    expect(free1 - free0, `free_balance 증가 불일치: 예상 +${EXPECTED_COIN}, 실제 +${free1 - free0}`).toBe(EXPECTED_COIN)
    expect(total1 - total0, `total 증가 불일치`).toBe(EXPECTED_COIN)
    expect(total1, 'C-8 작성후').toBe(Number(bal1.free) + Number(bal1.paid))
    console.log(`[+${EXPECTED_COIN}코인 확인] ${free0} → ${free1}`)

    // ── Step 4: 같은 상담 재작성 → 400 차단 ──
    const dup = await request.post(`${BASE}/user/reviews`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        counselor_id: COUNSELOR_ID,
        title: '[E2E] 중복 시도',
        content: '같은 상담에 두 번째 후기 — 차단되어야 함',
        rating: 5,
        consultation_id: CONSULTATION_ID,
      },
    })
    console.log(`[재작성 시도] status=${dup.status()}`)
    expect(dup.status(), '중복 후기가 차단되지 않음 — 코인 이중 지급 위험').toBe(400)

    // 재작성 차단 후 잔액 변화 없음
    const b2 = await request.get(`${BASE}/user/points/balance`)
    const bal2 = await b2.json() as Record<string, number>
    expect(Number(bal2.total), '재작성 차단됐는데 잔액 변동').toBe(total1)
    console.log(`[재작성 차단 OK] 잔액 유지: ${total1}`)

    // ── Step 5: 후기 삭제 → -500 회수 ──
    const del = await request.delete(`${BASE}/user/reviews/${createdReviewId}`)
    console.log(`[후기 삭제] status=${del.status()}`)
    expect([200, 204], `후기 삭제 실패: ${del.status()}`).toContain(del.status())

    // ── Step 6: 삭제 후 잔액 → 작성 전과 동일 (순증가 0) ──
    const b3 = await request.get(`${BASE}/user/points/balance`)
    const bal3 = await b3.json() as Record<string, number>
    const free3 = Number(bal3.free)
    const total3 = Number(bal3.total)
    console.log(`[삭제 후] free=${free3}, total=${total3}`)

    expect(free3, `삭제 후 free 미회수: 작성전 ${free0}, 삭제후 ${free3}`).toBe(free0)
    expect(total3, `삭제 후 total 미회수`).toBe(total0)
    expect(total3, 'C-8 삭제후').toBe(Number(bal3.free) + Number(bal3.paid))
    console.log(`[-${EXPECTED_COIN}코인 회수 확인] 순증가 0: ${free0} → ${free1} → ${free3}`)

    createdReviewId = null // 정리 완료
  })

  test.afterAll(async ({ request }) => {
    // 안전망: 테스트 실패로 후기가 남았으면 삭제 시도 (5분 이내만 가능)
    if (createdReviewId) {
      const ctx = await request.delete(`${BASE}/user/reviews/${createdReviewId}`).catch(() => null)
      console.log(`[afterAll 정리] reviewId=${createdReviewId} del=${ctx?.status() ?? 'fail'}`)
    }
  })
})
