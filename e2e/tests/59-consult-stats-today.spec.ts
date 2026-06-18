import { test, expect, devices } from '@playwright/test'

const GALAXY = devices['Galaxy S9+']

/**
 * 상담 통계 — "오늘 상담" 고정 줄: 기간 선택과 무관하게 항상 노출되는지 확인.
 */
test('오늘 상담 줄 — 기간 전환과 무관하게 항상 고정', async ({ browser }) => {
  const ctx = await browser.newContext({ ...GALAXY, storageState: 'user_dual_storage.json' })
  const page = await ctx.newPage()
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(`${e.name}: ${e.message}`))

  await page.goto('https://sajuplan.com/counselor/mypage/consult-stats', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  // 1) 기본(이번달)에서 "오늘 상담" 줄 노출
  await expect(page.getByText('오늘 상담', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('자정 기준', { exact: false }).first()).toBeVisible()
  await page.screenshot({ path: 'test-results/today-1-month.png', fullPage: true })

  // 2) "직접입력"으로 기간 바꿔도 오늘 줄 유지
  await page.getByRole('button', { name: '직접입력', exact: true }).click()
  await page.waitForTimeout(400)
  const di = page.locator('input[type="date"]')
  await di.nth(0).fill('2026-06-01')
  await di.nth(1).fill('2026-06-10')
  await page.getByRole('button', { name: '검색', exact: true }).click()
  await page.waitForTimeout(1200)
  await expect(page.getByText('오늘 상담', { exact: false }).first()).toBeVisible()
  await page.screenshot({ path: 'test-results/today-2-custom.png', fullPage: true })

  // 3) "오늘" 칩으로 바꿔도 유지
  await page.getByRole('button', { name: '오늘', exact: true }).click()
  await page.waitForTimeout(1000)
  await expect(page.getByText('오늘 상담', { exact: false }).first()).toBeVisible()

  const body = await page.locator('body').innerText()
  console.log('[화면 일부]', body.replace(/\n+/g, ' | ').slice(0, 350))
  console.log('[PAGE ERRORS]', JSON.stringify(pageErrors))
  expect(pageErrors).toEqual([])

  await ctx.close()
})
