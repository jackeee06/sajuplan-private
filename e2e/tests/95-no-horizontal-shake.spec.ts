import { test, expect } from '@playwright/test'

/**
 * 가로 흔들림(rubber-band) 전역 차단 검증 (2026-06-14).
 *
 * 원인: 루트에 overflow-x / overscroll-behavior 설정이 없어 앱 WebView 에서
 *       미세한 가로 여유에도 좌우로 흔들림. → html,body { overflow-x:clip; overscroll-behavior-x:none } 적용.
 *
 * 검증:
 *   1. 루트(html)에 overflow-x:clip 실제 적용됨
 *   2. 주요 페이지 다중 폭에서 가로 넘침(scrollWidth>vw) 0
 *   3. 가로 스크롤 시도해도 scrollLeft 0 고정 (흔들림 불가)
 */

test.use({ storageState: 'user_dual_storage.json' })

const ROUTES = [
  '/counselor/mypage/consult-stats',
  '/counselor/mypage',
  '/mypage/history',
  '/counselors',
  '/',
]
const WIDTHS = [360, 390, 414, 480]

test.describe('가로 흔들림 차단', () => {
  test('루트 overflow-x:clip + 전 페이지 가로 넘침/스크롤 0', async ({ page }) => {
    // 1. 루트 스타일 적용 확인 (대표 1페이지)
    await page.setViewportSize({ width: 390, height: 820 })
    await page.goto('/counselor/mypage/consult-stats', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    const overflowX = await page.evaluate(() => getComputedStyle(document.documentElement).overflowX)
    expect(overflowX, '루트 overflow-x:clip 미적용').toBe('clip')

    // 2~3. 페이지×폭 순회 — 넘침 0 + 가로 스크롤 잠금
    for (const route of ROUTES) {
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: 820 })
        await page.goto(route, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(350)
        const r = await page.evaluate(() => {
          const vw = window.innerWidth
          const overflow = Math.max(
            document.documentElement.scrollWidth - vw,
            document.body.scrollWidth - vw,
          )
          // 가로 스크롤 시도
          window.scrollTo({ left: 9999, top: 0 })
          const scrolled = window.scrollX || document.documentElement.scrollLeft || 0
          return { overflow: Math.round(overflow), scrolled: Math.round(scrolled) }
        })
        expect(r.overflow, `${route} @${w}px 가로 넘침 ${r.overflow}px`).toBeLessThanOrEqual(1)
        expect(r.scrolled, `${route} @${w}px 가로 스크롤됨(흔들림) ${r.scrolled}px`).toBeLessThanOrEqual(1)
      }
    }
  })
})
