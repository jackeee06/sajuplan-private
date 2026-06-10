import { test, expect, request } from '@playwright/test'

/**
 * [2026-06-11 운영 직전 정밀점검 · 축2 B-5] 후기 비즈룰 — 적대적 우회 차단 검증.
 *
 * 모두 "차단" 기대 → 실제 후기 생성 없음(prod 안전).
 *   - 비로그인 작성 → 401
 *   - counselor_id 없이 → 400
 *   - consultation_id 없이 → 400 (5분룰 우회 차단)
 *   - 가짜/남의 consultation_id → 차단 (본인 상담만)
 *   - 가짜 후기 수정/삭제 → 4xx (본인 아님/없음)
 */

const API = 'https://api.sajuplan.com'

test.describe('B-5 적대적 — 후기 비즈룰 우회 차단', () => {
  test('비로그인 후기 작성 → 401/403', async () => {
    const ctx = await request.newContext({ storageState: { cookies: [], origins: [] } })
    const r = await ctx.post(`${API}/api/user/reviews`, {
      data: { counselor_id: 131, title: 't', content: 'c', consultation_id: 1 },
    })
    console.log('[no-auth]', r.status())
    expect([401, 403]).toContain(r.status())
    await ctx.dispose()
  })

  test.describe('로그인 회원 — 잘못된 작성/수정 차단', () => {
    test.use({ storageState: 'user_member_storage.json' })

    test('counselor_id 없이 → 400', async ({ page }) => {
      const r = await page.request.post(`${API}/api/user/reviews`, { data: { title: 't', content: 'c', consultation_id: 1 } })
      console.log('[no-counselor]', r.status(), (await r.text()).slice(0, 150))
      expect(r.status()).toBe(400)
    })

    test('consultation_id 없이 → 400 (5분룰 우회 차단)', async ({ page }) => {
      const r = await page.request.post(`${API}/api/user/reviews`, { data: { counselor_id: 131, title: 't', content: 'c' } })
      console.log('[no-consult]', r.status(), (await r.text()).slice(0, 150))
      expect(r.status()).toBe(400)
      expect(await r.text(), '상담내역 필수 메시지 없음').toMatch(/상담/)
    })

    test('가짜/남의 consultation_id → 차단 (본인 상담만)', async ({ page }) => {
      const r = await page.request.post(`${API}/api/user/reviews`, { data: { counselor_id: 131, title: 't', content: 'c', consultation_id: 99999999 } })
      console.log('[fake-consult]', r.status(), (await r.text()).slice(0, 150))
      expect(r.status()).toBeGreaterThanOrEqual(400)
      expect(r.status(), '가짜 상담 후기가 5xx 면 안 됨').toBeLessThan(500)
    })

    test('가짜 후기 수정 → 4xx (본인 아님/없음)', async ({ page }) => {
      const r = await page.request.patch(`${API}/api/user/reviews/99999999`, { data: { title: 'hacked' } })
      console.log('[fake-edit]', r.status(), (await r.text()).slice(0, 150))
      expect(r.status()).toBeGreaterThanOrEqual(400)
      expect(r.status()).toBeLessThan(500)
    })

    test('가짜 후기 삭제 → 4xx', async ({ page }) => {
      const r = await page.request.delete(`${API}/api/user/reviews/99999999`)
      console.log('[fake-del]', r.status(), (await r.text()).slice(0, 150))
      expect(r.status()).toBeGreaterThanOrEqual(400)
      expect(r.status()).toBeLessThan(500)
    })
  })
})
