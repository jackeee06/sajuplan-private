import { test, expect } from '@playwright/test'

/**
 * [2026-06-11] 알림 클릭 → 링크로 바로 튀지 않고 알림 상세(/notifications/:id)가 먼저 열려
 * 제목·본문을 보여준다. link_url 이 있으면 [바로가기] 버튼으로 이동.
 *
 * 버그: 기존엔 알림 클릭 시 link_url 로 즉시 이동 → 공지 본문을 못 봄.
 */

test.describe('알림 상세 — 클릭 시 상세 먼저 노출', () => {
  test.use({ storageState: 'user_member_storage.json' })

  test('알림 클릭 → /notifications/:id 상세로 이동(링크로 튀지 않음) + 제목 노출', async ({ page }) => {
    await page.goto('/notifications')
    await page.waitForLoadState('domcontentloaded')
    const items = page.locator('main ul li button')
    await page.waitForTimeout(1500) // 목록 로드 대기 (networkidle 금지)
    const count = await items.count()
    test.skip(count === 0, '수신된 알림이 없어 스킵 (전체공지 브로드캐스트 0건)')

    // 클릭 전 제목 텍스트 확보 (15px 본제목 span)
    const first = items.first()
    const titleText = ((await first.locator('span.block').first().textContent()) ?? '').trim()

    await first.click()

    // 핵심: 외부/내부 링크로 튀지 않고 알림 상세 URL 로 이동해야 함
    await expect(page).toHaveURL(/\/notifications\/\d+$/)
    // 상세 헤더 '알림'
    await expect(page.locator('header h1', { hasText: '알림' })).toBeVisible()
    // 클릭한 알림 제목이 상세 본제목(h2)으로 노출
    if (titleText) {
      await expect(page.locator('main h2')).toContainText(titleText)
    }
  })

  test('상세 직접 진입(router state 없음) — 목록 재조회 폴백으로 표시 또는 안내', async ({ page }) => {
    // 먼저 목록에서 유효한 알림 id 확보
    await page.goto('/notifications')
    await page.waitForTimeout(1500)
    const items = page.locator('main ul li button')
    const count = await items.count()
    test.skip(count === 0, '알림 0건 — 폴백 검증 스킵')

    // 첫 알림 클릭으로 id 확보 후, 그 URL 로 직접 재진입(state 없이)
    await items.first().click()
    await expect(page).toHaveURL(/\/notifications\/\d+$/)
    const url = page.url()
    await page.goto(url) // state 없이 재진입 → 목록 재조회 폴백 경로
    await page.waitForTimeout(1500)
    // 본제목(h2) 또는 '찾을 수 없습니다' 안내 중 하나는 보여야 함(빈 화면 아님)
    const hasTitle = await page.locator('main h2').count()
    const hasNotFound = await page.getByText(/찾을 수 없|불러올 수 없|불러오지 못/).count()
    expect(hasTitle + hasNotFound).toBeGreaterThan(0)
  })
})
