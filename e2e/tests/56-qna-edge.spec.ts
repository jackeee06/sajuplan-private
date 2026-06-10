import { test, expect, request } from '@playwright/test'

/**
 * [2026-06-11 운영 직전 정밀점검 · 축2 B-6] 문의(QnA) 비즈룰 — 적대적 우회 차단 검증.
 *
 * 모두 "차단" 기대 → 실제 문의 생성 없음(prod 안전). 하루5개 한도는 생성이 필요해 제외(코드로 확인됨).
 *   - 비로그인 작성 → 401
 *   - 존재 안 하는 상담사 → 404
 *   - 제목/내용 없이 → 400
 *   - 가짜 문의 수정/삭제 → 4xx
 *   - 상담사 본인 페이지에 문의 → 403
 */

const API = 'https://api.sajuplan.com'

test.describe('B-6 적대적 — 문의 비즈룰 우회 차단', () => {
  test('비로그인 문의 작성 → 401/403', async () => {
    const ctx = await request.newContext({ storageState: { cookies: [], origins: [] } })
    const r = await ctx.post(`${API}/api/user/counselors/131/qna`, { data: { title: 't', content: 'c' } })
    console.log('[no-auth]', r.status())
    expect([401, 403]).toContain(r.status())
    await ctx.dispose()
  })

  test.describe('로그인 회원 — 잘못된 작성/수정 차단', () => {
    test.use({ storageState: 'user_member_storage.json' })

    test('존재 안 하는 상담사 문의 → 404', async ({ page }) => {
      const r = await page.request.post(`${API}/api/user/counselors/99999999/qna`, { data: { title: 't', content: 'c' } })
      console.log('[no-counselor]', r.status(), (await r.text()).slice(0, 150))
      expect(r.status()).toBe(404)
    })

    test('제목 없이 → 400', async ({ page }) => {
      const r = await page.request.post(`${API}/api/user/counselors/131/qna`, { data: { content: 'c' } })
      console.log('[no-title]', r.status(), (await r.text()).slice(0, 150))
      expect(r.status()).toBe(400)
    })

    test('내용 없이 → 400', async ({ page }) => {
      const r = await page.request.post(`${API}/api/user/counselors/131/qna`, { data: { title: 't' } })
      console.log('[no-content]', r.status(), (await r.text()).slice(0, 150))
      expect(r.status()).toBe(400)
    })

    test('가짜 문의 수정 → 4xx', async ({ page }) => {
      const r = await page.request.patch(`${API}/api/user/counselors/131/qna/99999999`, { data: { title: 'h', content: 'h' } })
      console.log('[fake-edit]', r.status(), (await r.text()).slice(0, 150))
      expect(r.status()).toBeGreaterThanOrEqual(400)
      expect(r.status()).toBeLessThan(500)
    })

    test('가짜 문의 삭제 → 4xx', async ({ page }) => {
      const r = await page.request.delete(`${API}/api/user/counselors/131/qna/99999999`)
      console.log('[fake-del]', r.status(), (await r.text()).slice(0, 150))
      expect(r.status()).toBeGreaterThanOrEqual(400)
      expect(r.status()).toBeLessThan(500)
    })
  })

  test.describe('상담사 본인 페이지 문의 차단', () => {
    test.use({ storageState: 'user_dual_storage.json' })

    test('본인 페이지에 문의 → 403/404 (자기에게 문의 불가)', async ({ page }) => {
      const me = await page.request.get(`${API}/api/user/auth/me`)
      const meBody = await me.json().catch(() => null)
      console.log('[me]', JSON.stringify(meBody).slice(0, 200))
      const myId = meBody?.id ?? meBody?.sub ?? meBody?.member?.id ?? meBody?.user?.id
      if (!myId) { console.log('me id 추출 실패 — skip'); test.skip(); return }
      const r = await page.request.post(`${API}/api/user/counselors/${myId}/qna`, { data: { title: 'self', content: 'self' } })
      console.log('[self-qna]', r.status(), (await r.text()).slice(0, 150))
      expect([403, 404], '본인 페이지 문의가 생성되면 안 됨').toContain(r.status())
    })

    test('본인 단골 등록 → 4xx (자기 단골 불가)', async ({ page }) => {
      const meBody = await (await page.request.get(`${API}/api/user/auth/me`)).json().catch(() => null)
      const myId = meBody?.id ?? meBody?.sub
      if (!myId) { test.skip(); return }
      const r = await page.request.post(`${API}/api/user/counselors/${myId}/like`)
      console.log('[self-fav]', r.status(), (await r.text()).slice(0, 120))
      expect([400, 403], '본인 단골이 생성되면 안 됨').toContain(r.status())
    })

    test('본인에게 전화상담 요청 → 400', async ({ page }) => {
      const meBody = await (await page.request.get(`${API}/api/user/auth/me`)).json().catch(() => null)
      const myId = meBody?.id ?? meBody?.sub
      if (!myId) { test.skip(); return }
      const r = await page.request.post(`${API}/api/user/consult/phone`, { data: { counselor_id: myId, variant: 'prepaid' } })
      console.log('[self-phone]', r.status(), (await r.text()).slice(0, 120))
      expect(r.status(), '본인 전화상담이 차단 안 됨').toBe(400)
    })

    test('본인에게 채팅상담 요청 → 400', async ({ page }) => {
      const meBody = await (await page.request.get(`${API}/api/user/auth/me`)).json().catch(() => null)
      const myId = meBody?.id ?? meBody?.sub
      if (!myId) { test.skip(); return }
      const r = await page.request.post(`${API}/api/user/consult/chat`, { data: { counselor_id: myId } })
      console.log('[self-chat]', r.status(), (await r.text()).slice(0, 120))
      expect(r.status(), '본인 채팅상담이 차단 안 됨').toBe(400)
    })
  })
})
