import { test, expect } from '@playwright/test'

/**
 * [2026-06-12] 팝업 기능 — 실제 사용자 손가락 동작 E2E (생성→노출→클릭→삭제 풀 플로우).
 *
 *  beforeAll: 관리자 API 로 "활성+기간내" 테스트 팝업 생성 (자동삭제 라벨)
 *  test1: 익명 사용자 홈 진입 → 팝업 모달 노출 → [닫기] → 사라짐 → 재진입 시 다시 노출(닫기는 영구숨김 아님)
 *  test2: 홈 진입 → [오늘 하루 보지 않기] → 재진입 시 미노출(localStorage 숨김)
 *  afterAll: 테스트 팝업 삭제 (prod 데이터 정리)
 *
 * admin 세션(admin_e2e) 없으면 전체 skip.
 */

const API = 'https://api.sajuplan.com'
const SITE = 'https://sajuplan.com'
const TITLE = 'E2E 손가락 팝업 (자동삭제)'

let popupId = 0

test.describe.serial('팝업 실제 손가락 동작', () => {
  test.beforeAll(async ({ playwright }) => {
    const api = await playwright.request.newContext()
    const login = await api.post(`${API}/api/admin/auth/login`, {
      data: { mb_id: 'admin_e2e', password: '1234!' },
    })
    if (!login.ok()) {
      await api.dispose()
      return // popupId=0 → 각 test 에서 skip
    }
    const now = Date.now()
    const res = await api.post(`${API}/api/admin/popup-layers`, {
      data: {
        device: 'both',
        starts_at: new Date(now - 86_400_000).toISOString(),
        ends_at: new Date(now + 86_400_000).toISOString(),
        disable_hours: 24,
        title: TITLE,
        content: '<p>E2E 팝업 본문 <b>테스트</b> 입니다.</p>',
        is_html: true,
        is_active: true,
      },
    })
    const body = await res.json().catch(() => null)
    popupId = body?.id ?? body?.data?.id ?? 0
    await api.dispose()
  })

  test.afterAll(async ({ playwright }) => {
    if (!popupId) return
    const api = await playwright.request.newContext()
    await api.post(`${API}/api/admin/auth/login`, { data: { mb_id: 'admin_e2e', password: '1234!' } })
    await api.delete(`${API}/api/admin/popup-layers/${popupId}`).catch(() => undefined)
    await api.dispose()
  })

  test('홈 진입 → 팝업 노출 → [닫기] → 사라짐 → 재진입 시 다시 노출', async ({ browser }) => {
    test.skip(!popupId, 'admin 세션 없음 — 테스트 팝업 생성 실패')
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, storageState: undefined })
    const page = await ctx.newPage()

    await page.goto(`${SITE}/`, { waitUntil: 'domcontentloaded' })
    const mine = page.getByText(TITLE, { exact: false })
    await expect(mine, '홈 진입 시 테스트 팝업 노출').toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('E2E 팝업 본문')).toBeVisible()

    // [닫기] 손가락 클릭
    await page.getByRole('button', { name: '닫기' }).click()
    await expect(page.getByText(TITLE, { exact: false }), '[닫기] 후 사라짐').toBeHidden()

    // 재진입 → 닫기는 영구숨김이 아니므로 다시 노출
    await page.goto(`${SITE}/`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(TITLE, { exact: false }), '재진입 시 다시 노출').toBeVisible({ timeout: 10_000 })

    await ctx.close()
  })

  test('[오늘 하루 보지 않기] → 재진입 시 미노출', async ({ browser }) => {
    test.skip(!popupId, 'admin 세션 없음')
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, storageState: undefined })
    const page = await ctx.newPage()

    await page.goto(`${SITE}/`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(TITLE, { exact: false })).toBeVisible({ timeout: 10_000 })

    // [오늘 하루 보지 않기] 손가락 클릭
    await page.getByRole('button', { name: '오늘 하루 보지 않기' }).click()
    await expect(page.getByText(TITLE, { exact: false })).toBeHidden()

    // 재진입 → localStorage 숨김으로 내 팝업은 안 떠야 함
    await page.goto(`${SITE}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2_500)
    await expect(page.getByText(TITLE, { exact: false }), '오늘 하루 보지않기 후 미노출').toHaveCount(0)

    await ctx.close()
  })
})
