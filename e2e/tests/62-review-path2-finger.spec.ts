import { test, expect, devices } from '@playwright/test'

const GALAXY = devices['Galaxy S9+']

/**
 * 실제 손가락: 상담사 프로필 → 후기 탭 → (작성버튼 없음/안내) → "내 상담내역에서 후기 쓰기" → 상담내역 이동.
 */
test('손가락: 후기 탭 → 상담내역 유도 링크 동작', async ({ browser }) => {
  const ctx = await browser.newContext({ ...GALAXY, storageState: 'user_member_storage.json' })
  const page = await ctx.newPage()
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(`${e.name}: ${e.message}`))

  // 1) 상담사 프로필 진입 (기본 소개 탭)
  await page.goto('https://sajuplan.com/counselors/112', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  // 2) "후기" 탭을 손가락으로 탭
  await page.getByRole('tab', { name: /후기/ }).click().catch(async () => {
    await page.getByText(/^후기\(/).first().click()
  })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'test-results/path2-finger-tab.png', fullPage: false })

  // 3) 작성 버튼은 없고, 안내 + 유도 링크는 보여야 함
  await expect(page.getByRole('link', { name: '후기 작성하기' })).toHaveCount(0)
  await expect(page.getByText('상담내역', { exact: false }).first()).toBeVisible()
  const cta = page.getByRole('link', { name: '내 상담내역에서 후기 쓰기' })
  await expect(cta).toBeVisible()

  // 4) 유도 링크 탭 → 본인 상담내역(/mypage/history) 이동
  await cta.click()
  await page.waitForURL((u) => u.pathname === '/mypage/history', { timeout: 8000 })
  console.log('[이동 후 URL]', page.url())
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'test-results/path2-finger-history.png', fullPage: false })

  expect(pageErrors).toEqual([])
  await ctx.close()
})
