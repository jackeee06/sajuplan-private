import { test, expect } from '@playwright/test'

/**
 * [2026-06-12] 일반 브라우저 접근 게이트 검증.
 *  - 자동화(webdriver=true, 기본 Playwright) → 게이트 통과 (기존 E2E 무영향)
 *  - 일반 브라우저(webdriver=false) → 게이트 노출 + 스토어 링크(real)
 *  - 앱 WebView(SajumoonBridge.isNative) → 게이트 통과
 */

const SITE = 'https://sajuplan.com'

test('자동화 브라우저는 게이트 통과 (기존 E2E 무영향)', async ({ page }) => {
  await page.goto(`${SITE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await expect(page.locator('[data-testid="web-app-gate"]'), 'webdriver=true → 게이트 없음').toHaveCount(0)
})

test('일반 브라우저(webdriver=false) → 게이트 노출 + 진짜 스토어 링크', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: undefined })
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true })
  })
  const page = await ctx.newPage()
  await page.goto(`${SITE}/`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('web-app-gate'), '게이트 노출').toBeVisible({ timeout: 8000 })
  await expect(page.getByText('앱에서 이용해주세요')).toBeVisible()
  // 데스크탑 → QR 코드 2개(Play/App Store) + 라벨
  await expect(page.getByText('Google Play')).toBeVisible()
  await expect(page.getByText('App Store')).toBeVisible()
  const qrCount = await page.locator('[data-testid="web-app-gate"] svg').count()
  expect(qrCount, 'QR 코드 2개 노출').toBeGreaterThanOrEqual(2)
  // 앱 로고(아이콘) 깨진 이미지 없음
  const broken = await page.locator('[data-testid="web-app-gate"] img').evaluateAll((imgs) =>
    imgs
      .filter((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth === 0)
      .map((i) => (i as HTMLImageElement).src),
  )
  expect(broken, '깨진 이미지 없음(앱 로고 정상)').toEqual([])
  await ctx.close()
})

test('모바일 브라우저(안드로이드 UA) → 탭 버튼 노출', async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: undefined,
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; SM-G991N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
    viewport: { width: 390, height: 800 },
  })
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true })
  })
  const page = await ctx.newPage()
  await page.goto(`${SITE}/`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('web-app-gate')).toBeVisible({ timeout: 8000 })
  await expect(page.getByRole('link', { name: 'Google Play 에서 받기' })).toBeVisible()
  await ctx.close()
})

test('앱 WebView(SajumoonBridge.isNative) → 게이트 통과', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: undefined })
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true })
    ;(window as unknown as { SajumoonBridge: { isNative: boolean } }).SajumoonBridge = { isNative: true }
  })
  const page = await ctx.newPage()
  await page.goto(`${SITE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await expect(page.locator('[data-testid="web-app-gate"]'), '앱이면 게이트 없음').toHaveCount(0)
  await ctx.close()
})
