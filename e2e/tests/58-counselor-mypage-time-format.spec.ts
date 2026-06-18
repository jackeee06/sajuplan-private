import { test, expect, devices } from '@playwright/test'

const GALAXY = devices['Galaxy S9+']

/**
 * 상담사 마이페이지 시간 표기 — h/m 영문 → 시간/분 한글, 등급카드 "남은 시간" 히어로.
 */
test('마이페이지 시간 표기 한글화 + 남은시간 히어로 확인', async ({ browser }) => {
  const ctx = await browser.newContext({ ...GALAXY, storageState: 'user_dual_storage.json' })
  const page = await ctx.newPage()
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(`${e.name}: ${e.message}`))

  await page.goto('https://sajuplan.com/counselor/mypage', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'test-results/mypage-time-format.png', fullPage: true })

  const body = await page.locator('body').innerText()
  console.log('[상담현황/등급 영역 일부]', body.replace(/\n+/g, ' | ').slice(0, 600))

  // 1) 영문 시간 표기(예: "1h 17m", "18.7h")가 더 이상 없어야 함
  //    숫자 바로 뒤 h 또는 m (분/시간 텍스트가 아닌) 패턴 탐지
  const hasEnglishHM = /\d\s?h\b|\d\s?m\b/.test(body)
  expect(hasEnglishHM).toBeFalsy()

  // 2) 등급 카드 "남은 시간" 히어로 — "까지" + "남음" 노출
  expect(body.includes('까지')).toBeTruthy()
  expect(body.includes('남음')).toBeTruthy()

  // 3) 클릭/렌더 무결성
  console.log('[PAGE ERRORS]', JSON.stringify(pageErrors))
  expect(pageErrors).toEqual([])

  await ctx.close()
})
