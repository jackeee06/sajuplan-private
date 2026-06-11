import { test, expect, request } from '@playwright/test'

/**
 * [2026-06-11 운영 직전 정밀점검 · 축2 C] 상담사 기능(C-1~C-5) — 적대적 우회 차단 검증.
 *
 * 전부 "차단" 기대 → 실제 선지급/단가변경 등 mutation 0 (prod 안전).
 *   - 비로그인 → 401
 *   - 회원(비상담사) 계정으로 상담사 전용 라우트 → 403 (role gate)
 *   - 상담사 계정으로 경계/우회 입력(음수·0·가용초과·상한초과·가짜id) → 4xx
 *   - 읽기 전용 본인 데이터(등급/정산요약) → 200 (소유권 스코프 확인)
 *
 * storage 매핑(global-setup): user_member_storage=e2e_member(회원),
 *   user_counselor_storage=dummy_01(상담사).
 */

const API = 'https://api.sajuplan.com'
const PAYOUT = `${API}/api/user/counselor-mypage/payout`
const GRADE = `${API}/api/user/counselor-mypage/grade`

test.describe('C 적대적 — 비로그인 차단 (401)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('비로그인 선지급 가용조회 → 401', async () => {
    const ctx = await request.newContext({ storageState: { cookies: [], origins: [] } })
    const r = await ctx.get(`${PAYOUT}/available`)
    console.log('[noauth payout/available]', r.status())
    expect([401, 403]).toContain(r.status())
    await ctx.dispose()
  })

  test('비로그인 단가변경 → 401', async () => {
    const ctx = await request.newContext({ storageState: { cookies: [], origins: [] } })
    const r = await ctx.post(`${GRADE}/unit-cost`, { data: { unit_cost: 5000, reason: 'x' } })
    console.log('[noauth grade/unit-cost]', r.status())
    expect([401, 403]).toContain(r.status())
    await ctx.dispose()
  })
})

test.describe('C 적대적 — 회원(비상담사) 계정의 상담사 전용 라우트 차단 (403)', () => {
  test.use({ storageState: 'user_member_storage.json' })

  test('회원이 선지급 가용조회 → 403', async ({ page }) => {
    const r = await page.request.get(`${PAYOUT}/available`)
    console.log('[member payout/available]', r.status(), (await r.text()).slice(0, 120))
    expect(r.status(), '비상담사가 선지급 라우트 접근 — 막혀야').toBe(403)
  })

  test('회원이 선지급 신청 → 403', async ({ page }) => {
    const r = await page.request.post(`${PAYOUT}/request`, { data: { amount: 30000 } })
    console.log('[member payout/request]', r.status())
    expect([401, 403]).toContain(r.status())
  })

  test('회원이 등급/단가 조회 → 403', async ({ page }) => {
    const r = await page.request.get(`${GRADE}`)
    console.log('[member grade]', r.status())
    expect(r.status()).toBe(403)
  })

  test('회원이 단가 변경 → 403', async ({ page }) => {
    const r = await page.request.post(`${GRADE}/unit-cost`, { data: { unit_cost: 5000, reason: 'x' } })
    console.log('[member grade/unit-cost]', r.status())
    expect(r.status()).toBe(403)
  })
})

test.describe('C 적대적 — 상담사 계정의 경계/우회 입력 차단 (mutation 없음)', () => {
  test.use({ storageState: 'user_counselor_storage.json' })

  // ── 선지급 신청: 금액 경계 (모두 차단되어 row 미생성) ─────────────
  test('선지급 amount=0 → 400', async ({ page }) => {
    const r = await page.request.post(`${PAYOUT}/request`, { data: { amount: 0 } })
    console.log('[payout amount=0]', r.status(), (await r.text()).slice(0, 120))
    expect(r.status()).toBe(400)
  })

  test('선지급 amount 음수 → 400', async ({ page }) => {
    const r = await page.request.post(`${PAYOUT}/request`, { data: { amount: -50000 } })
    console.log('[payout amount<0]', r.status(), (await r.text()).slice(0, 120))
    expect(r.status()).toBe(400)
  })

  test('선지급 amount 비숫자 → 400', async ({ page }) => {
    const r = await page.request.post(`${PAYOUT}/request`, { data: { amount: 'lots' } })
    console.log('[payout amount=NaN]', r.status())
    expect(r.status()).toBe(400)
  })

  test('선지급 가용 초과(9.9억) → 4xx (가용 한도 차단)', async ({ page }) => {
    const r = await page.request.post(`${PAYOUT}/request`, { data: { amount: 999_999_999 } })
    console.log('[payout over-available]', r.status(), (await r.text()).slice(0, 150))
    expect(r.status(), '가용 초과 신청이 생성되면 안 됨').toBeGreaterThanOrEqual(400)
    expect(r.status()).toBeLessThan(500)
  })

  test('남의/가짜 선지급 취소 → 4xx (소유권·존재 차단)', async ({ page }) => {
    const r = await page.request.post(`${PAYOUT}/99999999/cancel`)
    console.log('[payout fake-cancel]', r.status(), (await r.text()).slice(0, 120))
    expect(r.status()).toBeGreaterThanOrEqual(400)
    expect(r.status()).toBeLessThan(500)
  })

  // ── 단가 변경: 경계 (모두 차단) ───────────────────────────────────
  test('단가 0 → 400', async ({ page }) => {
    const r = await page.request.post(`${GRADE}/unit-cost`, { data: { unit_cost: 0, reason: 'x' } })
    console.log('[unit-cost=0]', r.status())
    expect(r.status()).toBe(400)
  })

  test('단가 음수 → 400', async ({ page }) => {
    const r = await page.request.post(`${GRADE}/unit-cost`, { data: { unit_cost: -100, reason: 'x' } })
    console.log('[unit-cost<0]', r.status())
    expect(r.status()).toBe(400)
  })

  test('단가 상한(10만원/분) 초과 → 400', async ({ page }) => {
    const r = await page.request.post(`${GRADE}/unit-cost`, { data: { unit_cost: 200_000, reason: 'x' } })
    console.log('[unit-cost>cap]', r.status(), (await r.text()).slice(0, 120))
    expect(r.status()).toBe(400)
  })

  // ── 읽기 전용 본인 데이터 (소유권 스코프 정상) ─────────────────────
  test('본인 등급/단가 조회 → 200', async ({ page }) => {
    const r = await page.request.get(`${GRADE}`)
    console.log('[own grade]', r.status())
    expect(r.status()).toBe(200)
  })

  test('본인 선지급 가용 조회 → 200', async ({ page }) => {
    const r = await page.request.get(`${PAYOUT}/available`)
    console.log('[own payout/available]', r.status())
    expect(r.status()).toBe(200)
  })

  test('본인 정산 요약 조회 → 200 (남의 데이터 없음)', async ({ page }) => {
    const r = await page.request.get(`${API}/api/user/settlements/summary`)
    console.log('[own settlement summary]', r.status())
    expect(r.status()).toBe(200)
  })
})
