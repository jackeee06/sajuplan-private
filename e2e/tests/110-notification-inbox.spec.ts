import { test, expect } from '@playwright/test'

/**
 * [2026-06-19] 통합 알림함 — "회원·상담사에게 온 모든 알림(푸시·인앱·카톡)"을 종모양 한 곳에.
 *
 * 검증:
 *  1) 안읽음 카운트 API (/user/notifications/unread-count) — 종모양 빨간 뱃지 데이터원
 *  2) 목록 API 가 신규 채널/코드 필드(via_push/via_alimtalk/code) 반환
 *  3) /notifications 페이지 렌더 + 헤더 종모양 → 알림함 이동
 *  4) [핵심] 이벤트(문의 작성)가 발생하면 상대(상담사) 종모양 알림함에 1행으로 남는다
 *     - e2e_member 가 상담사 102(dummy_01)에게 문의 작성 → 102 알림함에 '새 문의' 노출
 */

const BASE = (process.env.TARGET ?? 'prod') === 'prod' ? 'https://sajuplan.com' : 'https://sajumoon.kr'
const API = (process.env.TARGET ?? 'prod') === 'prod' ? 'https://api.sajuplan.com' : 'https://api.sajumoon.kr'
const COUNSELOR_ID = '102' // dummy_01 — 실제 상담사 사용 금지 (spec 23 동일)
const QNA_CONTENT = `E2E 알림함 문의 ${Date.now()}`

test.describe('통합 알림함 — 종모양 단일 창구', () => {
  test.use({ storageState: 'user_member_storage.json' })

  test('1. unread-count API — 200 + 숫자 count', async ({ page }) => {
    const res = await page.request.get(`${API}/api/user/notifications/unread-count`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(typeof body.count).toBe('number')
    expect(body.count).toBeGreaterThanOrEqual(0)
  })

  test('2. 목록 API — 신규 채널/코드 필드 포함', async ({ page }) => {
    const res = await page.request.get(`${API}/api/user/notifications`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    if (body.items.length > 0) {
      const it = body.items[0]
      expect(it).toHaveProperty('via_push')
      expect(it).toHaveProperty('via_alimtalk')
      expect(it).toHaveProperty('code')
      expect(typeof it.via_push).toBe('boolean')
      expect(typeof it.via_alimtalk).toBe('boolean')
    }
  })

  test('3. /notifications 페이지 렌더', async ({ page }) => {
    await page.goto('/notifications')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText('알림 내역')).toBeVisible()
  })

  test('4. 마이페이지 종모양 → 알림함 이동', async ({ page }) => {
    await page.goto('/mypage')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)
    const bell = page.locator('header a[href="/notifications"]').first()
    await expect(bell).toBeVisible()
    await bell.click()
    await expect(page).toHaveURL(/\/notifications$/)
  })
})

test.describe('통합 알림함 — 이벤트 → 상대 알림함 기록 (양방향)', () => {
  test('5. 문의 작성 → 상담사 알림함에 "새 문의" 1행 기록', async ({ browser }) => {
    // (A) e2e_member 로 상담사 102 에게 문의 작성 → notifyQaAsk → inbox.record(qna_ask)
    const memberCtx = await browser.newContext({ storageState: 'user_member_storage.json', baseURL: BASE })
    const m = await memberCtx.newPage()
    await m.goto(`/counselors/${COUNSELOR_ID}/qna/new`)
    await m.waitForLoadState('domcontentloaded')
    await m.getByPlaceholder(/제목/).fill('E2E 알림함 문의 제목')
    await m.getByPlaceholder(/내용|궁금/).fill(QNA_CONTENT)
    await m.getByRole('button', { name: '작성완료' }).click()
    await m.waitForURL(/counselors\/\d+(\?tab=qna|\/qna)/, { timeout: 10_000 })
    await memberCtx.close()

    // (B) 상담사 102(dummy_01) 알림함에 '새 문의' 가 떠야 한다
    //     notifyQaAsk 는 fire-and-forget(비동기)이므로 기록까지 잠깐 폴링.
    const csrCtx = await browser.newContext({ storageState: 'user_counselor_storage.json', baseURL: BASE })
    const c = await csrCtx.newPage()
    await expect
      .poll(
        async () => {
          const res = await c.request.get(`${API}/api/user/notifications`)
          const body = await res.json()
          return (body.items ?? []).some((it: { code?: string }) => it.code === 'qna_ask')
        },
        { timeout: 15_000, intervals: [500, 1000, 1500, 2000] },
      )
      .toBe(true)

    // UI 렌더 확인
    await c.goto('/notifications')
    await c.waitForTimeout(1500)
    await expect(c.getByText('새 문의').first()).toBeVisible({ timeout: 10_000 })
    await csrCtx.close()
  })
})
