import { test, expect } from '@playwright/test'

/**
 * [2026-06-12] 팝업 기능 신설 검증.
 *  - 사용자 팝업 API GET /api/user/popups 200 (공개)
 *  - 홈 진입 시 PopupLayer 통합으로 JS 예외 없이 렌더
 *  - 활성 팝업이 있으면 모달 노출(없으면 skip — 데이터 의존)
 */

test.describe('팝업 레이어 (사용자 노출 신설)', () => {
  test('GET /api/user/popups 공개 200 + items 배열', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'https://api.sajuplan.com' })
    const res = await ctx.get('/api/user/popups')
    expect(res.ok(), `팝업 API 200 (실제 ${res.status()})`).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body.items), 'items 배열 반환').toBeTruthy()
    await ctx.dispose()
  })

  test('홈 진입 시 PopupLayer JS 예외 없이 렌더', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    expect(errors, '홈 JS 예외 0 (PopupLayer 포함)').toEqual([])
    // 활성 팝업 있으면 모달(role=dialog)·닫기 버튼 노출 확인
    const dialog = page.getByRole('dialog')
    if (await dialog.count()) {
      await expect(page.getByRole('button', { name: '닫기' }).first()).toBeVisible()
      await expect(page.getByRole('button', { name: '오늘 하루 보지 않기' }).first()).toBeVisible()
    }
  })
})
