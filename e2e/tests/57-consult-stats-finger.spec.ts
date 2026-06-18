import { test, expect, devices } from '@playwright/test'

const GALAXY = devices['Galaxy S9+']

/**
 * 실제 사용자 손가락 동작 그대로 — 상담사 마이페이지에서 메뉴를 눌러 통계로 진입,
 * 기간 칩/직접입력을 실제 클릭하며 "수익금" 카드가 렌더·반응하는지 확인 + 스크린샷.
 * (금액 정확성은 prod DB 교차검증으로 별도 확정: 박기수 13건/6,000원)
 */
test('손가락 여정: 마이 → 상담 통계 → 기간 전환, 수익금 카드 확인', async ({ browser }) => {
  const ctx = await browser.newContext({ ...GALAXY, storageState: 'user_dual_storage.json' })
  const page = await ctx.newPage()

  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(`${e.name}: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })

  // 1) 상담사 마이페이지 진입 (실제 시작점)
  await page.goto('https://sajuplan.com/counselor/mypage', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'test-results/finger-1-mypage.png', fullPage: true })

  // 2) "상담 통계" 메뉴를 손가락으로 탭
  const statsMenu = page.getByText('상담 통계', { exact: true }).first()
  await expect(statsMenu).toBeVisible()
  await statsMenu.click()

  // 3) 통계 페이지 도착 확인
  await page.waitForURL(/\/counselor\/mypage\/consult-stats/, { timeout: 10000 })
  await expect(page.getByRole('heading', { name: '나의 상담 통계' })).toBeVisible()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'test-results/finger-2-stats-default.png', fullPage: true })

  // 기본(이번달)에서 수익금 카드 노출
  await expect(page.getByText('수익금', { exact: true }).first()).toBeVisible()
  const readEarning = async () => {
    // "수익금" 라벨 카드 안의 숫자+원 텍스트 추출
    const card = page.locator('div', { has: page.getByText('수익금', { exact: true }) }).last()
    return (await card.innerText()).replace(/\s+/g, ' ').trim()
  }
  console.log('[이번달] 수익금 카드:', await readEarning())

  // 4) "오늘" 칩 탭 → 카드 유지
  await page.getByRole('button', { name: '오늘', exact: true }).click()
  await page.waitForTimeout(1200)
  await expect(page.getByText('수익금', { exact: true }).first()).toBeVisible()
  console.log('[오늘] 수익금 카드:', await readEarning())

  // 5) "직접입력" 탭 → 날짜 지정 → 검색 (손가락 입력)
  await page.getByRole('button', { name: '직접입력', exact: true }).click()
  await page.waitForTimeout(500)
  const dateInputs = page.locator('input[type="date"]')
  await dateInputs.nth(0).fill('2026-06-01')
  await dateInputs.nth(1).fill('2026-06-13')
  await page.getByRole('button', { name: '검색', exact: true }).click()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'test-results/finger-3-stats-custom.png', fullPage: true })

  await expect(page.getByText('수익금', { exact: true }).first()).toBeVisible()
  const customEarning = await readEarning()
  console.log('[직접입력 06-01~06-13] 수익금 카드:', customEarning)
  // 카드에 "원" 단위 노출 확인
  expect(customEarning).toContain('원')

  // 6) 클릭 도중 JS 에러가 없어야 함 (실제 손가락 동작 무결성)
  console.log('[PAGE ERRORS]', JSON.stringify(pageErrors))
  console.log('[CONSOLE ERRORS]', JSON.stringify(consoleErrors.slice(0, 5)))
  expect(pageErrors).toEqual([])

  await ctx.close()
})
