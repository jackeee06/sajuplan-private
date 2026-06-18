import { test, expect, devices } from '@playwright/test'
import fs from 'fs'

/**
 * 실제 사용자 손가락 동작 재현 (모바일 터치/스와이프) + 단계별 스크린샷
 * 마우스 click 이 아니라 page.tap()(터치) / touchscreen 제스처로 동작.
 */

const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_finger'
fs.mkdirSync(SHOT, { recursive: true })

// 실제 안드로이드 폰처럼 — 터치 가능 + 모바일 뷰포트
test.use({ ...devices['Pixel 5'], storageState: { cookies: [], origins: [] } })

test('손가락 워크스루 — 홈 후기 / 상담사 후기 / 더미 폐기', async ({ page }) => {
  // ── 1) 홈 진입 ─────────────────────────────
  await page.goto('/')
  await page.waitForLoadState('load').catch(() => {})
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${SHOT}/01_home.png` })

  // ── 2) "후기" 탭을 손가락으로 탭 ───────────
  const reviewTab = page.getByRole('button', { name: '후기', exact: true })
  await expect(reviewTab).toBeVisible({ timeout: 10_000 })
  await reviewTab.tap()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${SHOT}/02_home_review_tab.png`, fullPage: false })

  // 아래로 스와이프(손가락 스크롤)하며 후기 끝까지 + 더보기 유무 확인
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 900) // 터치 스크롤 대용 (관성 스크롤)
    await page.waitForTimeout(500)
  }
  await page.screenshot({ path: `${SHOT}/03_home_review_scrolled.png` })
  const urlAfterHomeReview = page.url()

  // 홈 후기 탭에서 무심결에 후기 본문을 손가락으로 탭 → 새 화면(더미)으로 안 가야
  const firstReviewText = page.locator('p, h3').filter({ hasText: /[가-힣]{4,}/ }).first()
  if (await firstReviewText.count()) {
    await firstReviewText.tap().catch(() => {})
    await page.waitForTimeout(800)
  }
  await page.screenshot({ path: `${SHOT}/04_home_review_after_tap.png` })
  expect(page.url(), `홈 후기 탭에서 후기 탭했더니 페이지 이탈: ${page.url()}`).toBe(urlAfterHomeReview)

  // ── 3) 상담사 상세(라온선생 123) 후기 탭 ───
  await page.goto('/counselors/123')
  await page.waitForLoadState('load').catch(() => {})
  await page.waitForTimeout(1200)
  const detailReviewBtn = page.getByRole('button', { name: /^후기/ })
  await expect(detailReviewBtn).toBeVisible({ timeout: 10_000 })
  await detailReviewBtn.tap()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${SHOT}/05_counselor_review_tab.png` })

  const urlBeforeCardTap = page.url()

  // 후기 본문을 손가락으로 무심결 탭 → 예전엔 더미 상세로 튀던 동작. 이제 아무 변화 없어야.
  const report = page.getByRole('button', { name: '이 후기 신고' }).first()
  await expect(report).toBeVisible({ timeout: 8_000 })
  const box = await report.boundingBox()
  if (box) {
    await page.touchscreen.tap(box.x - 40, box.y + 60) // 신고버튼 옆 본문 영역
    await page.waitForTimeout(1000)
  }
  await page.screenshot({ path: `${SHOT}/06_counselor_review_after_tap.png` })
  expect(page.url(), `후기 카드 탭 후 이탈: ${page.url()}`).toBe(urlBeforeCardTap)
  await expect(page.getByRole('heading', { name: '상담 후기' })).toHaveCount(0)

  // ── 4) 더미 /reviews 직접 접근 → 폐기 확인 ──
  await page.goto('/reviews')
  await page.waitForLoadState('load').catch(() => {})
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${SHOT}/07_reviews_dummy_gone.png` })
  await expect(page.getByText('후기 작성 시 코인 지급!')).toHaveCount(0)
  await expect(page.getByText(/전체\s*9,?999\s*건/)).toHaveCount(0)
})
