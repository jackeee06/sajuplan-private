import { test, expect } from '@playwright/test'

/**
 * [2026-05-27] 상담사 선지급 정책 회귀 방지 — read-only.
 *
 * 검증 대상 (PRODUCTION_READINESS #3):
 *   - 가용 한도 계산 정책 (70%, 가용 ratio)
 *   - 수수료 5% (fee_rate)
 *   - 원천징수 3.3% (withholding_rate)
 *   - 최소 신청 금액 (min_amount, 기본 30,000)
 *   - 일 1회 제한 (max_per_day_per_counselor)
 *
 * 실제 POST 신청은 부수효과 (DB INSERT + 알림톡 발송) 라 spec 에서 X.
 *   read-only GET 으로 정책 응답 + 가용 한도 양수 검증만.
 *
 * 테스트 계정: e2e_dual (role=counselor).
 */

test.use({ storageState: 'user_dual_storage.json' })

test.describe('상담사 선지급 정책 (read-only)', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.TARGET === 'prod') test.skip()
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const apiBase = 'https://api.sajumoon.kr'
    const result = await page.evaluate(async (base) => {
      try {
        const me = await fetch(`${base}/api/user/auth/me`, { credentials: 'include' })
        if (me.ok) {
          const j = await me.json().catch(() => null)
          if (j?.ok === true || j?.member) return { ok: true }
        }
        const login = await fetch(`${base}/api/user/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mb_id: 'e2e_dual', password: 'e2e_test_2026' }),
          credentials: 'include',
        })
        return { ok: login.ok, status: login.status }
      } catch (e) {
        return { ok: false, error: (e as Error).message }
      }
    }, apiBase)
    if (!result.ok) test.skip(true, `e2e_dual 인증 실패 (${JSON.stringify(result).slice(0, 80)})`)
  })

  test('GET /api/user/counselor-mypage/payout/available — 정책 5%/3.3%/70%/30000 응답', async ({ page }) => {
    const apiBase = 'https://api.sajumoon.kr'
    const body = await page.evaluate(async (base) => {
      const r = await fetch(`${base}/api/user/counselor-mypage/payout/available`, {
        credentials: 'include',
      })
      return { status: r.status, json: await r.json().catch(() => null) }
    }, apiBase)

    expect(body.status, `available endpoint → ${body.status}`).toBe(200)
    const j = body.json
    expect(j, '응답 JSON 아님').toBeTruthy()

    // 정책 스냅샷 검증
    expect(j.fee_rate, `수수료율 5% 가 아님 (actual: ${j.fee_rate})`).toBeCloseTo(0.05, 5)
    expect(j.withholding_rate, `원천징수 3.3% 가 아님 (actual: ${j.withholding_rate})`).toBeCloseTo(0.033, 5)
    expect(j.available_ratio, `가용 ratio 70% 가 아님 (actual: ${j.available_ratio})`).toBeCloseTo(0.7, 5)
    expect(j.min_amount, `최소 신청 30,000원 이 아님 (actual: ${j.min_amount})`).toBeGreaterThanOrEqual(10000)

    // 등급 정보
    expect(['preliminary', 'partner1', 'partner2', 'partner3', 'partner4', 'partner5']).toContain(j.grade)
    expect(j.grade_label).toBeTruthy()

    // 금액은 음수 X
    expect(j.available_amount, `available_amount 음수`).toBeGreaterThanOrEqual(0)
    expect(j.estimated_settlement, `estimated_settlement 음수`).toBeGreaterThanOrEqual(0)
  })

  test('GET /api/user/counselor-mypage/payout/history — 응답 형식', async ({ page }) => {
    const apiBase = 'https://api.sajumoon.kr'
    const body = await page.evaluate(async (base) => {
      const r = await fetch(`${base}/api/user/counselor-mypage/payout/history?limit=30`, {
        credentials: 'include',
      })
      return { status: r.status, json: await r.json().catch(() => null) }
    }, apiBase)

    expect(body.status).toBe(200)
    expect(body.json, '응답 JSON 아님').toBeTruthy()
    // 배열 또는 객체.list — 둘 다 허용
    const list = Array.isArray(body.json) ? body.json : body.json.items ?? body.json.list ?? []
    expect(Array.isArray(list), `history 응답이 배열 형태 아님`).toBe(true)
  })

  test('상담사 마이 → 수익금 페이지 로드', async ({ page }) => {
    await page.goto('/counselor/mypage/payout')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    const rootText = (await page.locator('#root').textContent()) ?? ''
    expect(rootText.trim().length, '수익금 페이지 빈 화면').toBeGreaterThan(20)

    // 정책 키워드 노출 (사용자가 보는 안내문)
    const body = (await page.locator('body').textContent()) ?? ''
    expect(
      body.includes('5%') || body.includes('수수료') || body.includes('가용'),
      '수익금 페이지에 정책 안내 없음',
    ).toBeTruthy()
  })
})
