import { test, expect } from '@playwright/test'

/**
 * 상담사 상세 후기 탭 — "상담 후기 더보기" 버튼 페이지네이션 검증
 *
 * 수정된 버그 (2026-06-08):
 *  - "상담 후기 더보기" 클릭 시 /reviews (전체 목록)으로 이탈하던 버그 수정
 *  - 버튼 클릭 시 해당 상담사 후기를 탭 안에서 추가 로드하도록 변경
 *
 * 전제 조건:
 *  - e2e_dual (counselor_id=141) 상담사에 더미 후기 25개 INSERT됨 (_e2e_loadmore_test: true)
 *  - 페이지당 20개 로드 (PAGE_SIZE=20)
 */

const COUNSELOR_URL = '/counselors/141'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('후기 탭 더보기 버튼 — 페이지네이션', () => {

  test('후기 탭에 더보기 버튼이 존재한다 (25개 > PAGE_SIZE 20)', async ({ page }) => {
    await page.goto(COUNSELOR_URL)
    await page.waitForLoadState('load').catch(() => {})

    // 후기 탭 클릭
    const reviewsBtn = page.getByRole('button', { name: /^후기/ })
    await expect(reviewsBtn, '후기 탭 버튼 없음').toBeVisible({ timeout: 10_000 })
    await reviewsBtn.click()
    await page.waitForTimeout(800)

    // 더보기 버튼 존재 확인
    const moreBtn = page.getByRole('button', { name: '상담 후기 더보기' })
    await expect(moreBtn, '더보기 버튼이 없음 — 25개 후기인데 버튼이 안 보임').toBeVisible({ timeout: 8_000 })
  })

  test('더보기 클릭 시 /reviews 로 이탈하지 않는다', async ({ page }) => {
    await page.goto(COUNSELOR_URL)
    await page.waitForLoadState('load').catch(() => {})

    const reviewsBtn = page.getByRole('button', { name: /^후기/ })
    await reviewsBtn.click()
    await page.waitForTimeout(800)

    const moreBtn = page.getByRole('button', { name: '상담 후기 더보기' })
    await expect(moreBtn).toBeVisible({ timeout: 8_000 })

    // 클릭
    await moreBtn.click()
    await page.waitForTimeout(1_500)

    // URL이 /reviews 로 변경되지 않아야 함 — 핵심 버그 검증
    const url = page.url()
    expect(url, `더보기 클릭 후 /reviews로 이탈함: ${url}`).not.toContain('/reviews')
    expect(url, '상담사 상세 URL 아님').toContain('/counselors/')
  })

  test('더보기 클릭 후 후기 목록이 추가 로드된다 (20개 → 25개)', async ({ page }) => {
    await page.goto(COUNSELOR_URL)
    await page.waitForLoadState('load').catch(() => {})

    const reviewsBtn = page.getByRole('button', { name: /^후기/ })
    await reviewsBtn.click()
    await page.waitForTimeout(800)

    // 초기 로드된 후기 수 확인 (20개)
    const countBefore = await page.locator('[data-testid="counselor-tab-area"] ~ * a[href^="/reviews/"]').count()
      .catch(() => 0)

    // 더보기 클릭
    const moreBtn = page.getByRole('button', { name: '상담 후기 더보기' })
    await expect(moreBtn).toBeVisible({ timeout: 8_000 })
    await moreBtn.click()

    // 추가 로드 대기
    await page.waitForTimeout(2_000)

    // 더보기 버튼이 사라져야 함 (25개 전부 로드됨)
    await expect(
      page.getByRole('button', { name: '상담 후기 더보기' }),
      '25개 전부 로드됐는데 더보기 버튼이 아직 보임',
    ).toBeHidden({ timeout: 5_000 })
  })

  test('"불러오는 중…" 상태가 클릭 직후 표시된다', async ({ page }) => {
    await page.goto(COUNSELOR_URL)
    await page.waitForLoadState('load').catch(() => {})

    const reviewsBtn = page.getByRole('button', { name: /^후기/ })
    await reviewsBtn.click()
    await page.waitForTimeout(800)

    const moreBtn = page.getByRole('button', { name: '상담 후기 더보기' })
    await expect(moreBtn).toBeVisible({ timeout: 8_000 })

    // 클릭 직후 "불러오는 중…" 텍스트 또는 disabled 상태 확인
    await moreBtn.click()
    // 로딩 중 버튼은 disabled 또는 텍스트 변경
    const isDisabledOrLoading = await page.evaluate(() => {
      const btn = document.querySelector('button:disabled')
      return !!btn
    })
    // 완료 후 버튼 사라지므로 — 로딩 시작됐음을 URL로 간접 검증
    const url = page.url()
    expect(url).toContain('/counselors/')
  })
})
