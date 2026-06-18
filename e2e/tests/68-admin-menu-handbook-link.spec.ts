import { test, expect } from '@playwright/test'

/**
 * [2026-06-12] 관리자 전체메뉴(AllMenus) 완전성 + 운영바이블 deep-link.
 *  - 누락 보충 메뉴(쿠폰·코인 정책 가이드) 노출
 *  - 메뉴 → /handbook?slug=... deep-link 가 해당 바이블 문서를 연다 (AdminHandbook 이 ?slug= 수신)
 * admin 세션(storageState.json) 없으면 graceful skip.
 */

test.use({ storageState: 'storageState.json', viewport: { width: 1280, height: 900 } })

test.describe('관리자 메뉴 ↔ 운영바이블 연결', () => {
  test('전체메뉴 렌더 + 누락 보충 메뉴 노출', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/mng/all-menus', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    if (/\/mng\/login/.test(page.url())) test.skip(true, 'admin 세션 없음')

    expect(errors, 'all-menus JS 예외 0').toEqual([])
    await expect(page.getByText('쿠폰·코인 정책 가이드').first(), '누락 보충 메뉴 노출').toBeVisible()
  })

  test('바이블 deep-link(?slug=)가 해당 문서를 연다', async ({ page }) => {
    const itemReqs: string[] = []
    page.on('request', (r) => {
      if (/\/admin\/handbook\/item\?slug=/.test(r.url())) itemReqs.push(decodeURIComponent(r.url()))
    })
    await page.goto('/mng/handbook?slug=payment/05-settlement', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    if (/\/mng\/login/.test(page.url())) test.skip(true, 'admin 세션 없음')

    expect(
      itemReqs.some((u) => u.includes('slug=payment/05-settlement')),
      `?slug= 가 해당 문서 item API 호출을 유도해야 (호출: ${itemReqs.join(', ') || '없음'})`,
    ).toBeTruthy()
  })
})
