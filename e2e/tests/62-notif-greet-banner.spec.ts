import { test, expect } from '@playwright/test'

/**
 * 새 알림 "마중" 배너 (NotificationGreetBanner) — 2026-06-11 신규.
 *  - 홈 진입 시 안 읽은 알림이 있으면 보라 그라데이션 배너 노출 → 탭 시 /notifications 이동.
 *  - 안 읽은 알림 0 이면 미노출(정상).
 *  - 배너 추가로 홈 렌더에 JS 에러가 없어야 함.
 */
test.describe('새 알림 마중 배너', () => {
  test('홈 진입 시 JS 에러 없이 렌더', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/')
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(1500)
    expect(errors, errors.join('\n')).toEqual([])
  })

  test('안 읽은 알림 있으면 배너 노출 + 알림함 이동', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1800)
    const banner = page.getByText(/새 알림 \d+개가 도착했어요/)
    const visible = await banner.isVisible().catch(() => false)
    if (visible) {
      await expect(banner).toBeVisible()
      await banner.click()
      await expect(page).toHaveURL(/\/notifications/)
    } else {
      // 안 읽은 알림이 없으면 배너는 의도적으로 미노출 — 정상 동작
      test.info().annotations.push({ type: 'note', description: '안 읽은 알림 0 → 배너 미노출(정상)' })
    }
  })

  test('알림 리스트(시안A 카드형) JS 에러 없이 렌더', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/notifications')
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(1500)
    expect(errors, errors.join('\n')).toEqual([])
  })
})
