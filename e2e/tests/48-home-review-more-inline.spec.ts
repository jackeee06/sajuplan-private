import { test, expect } from '@playwright/test'

/**
 * 홈 "후기 더보기" 인-페이지 누적 + 더미 /reviews 폐기 검증 (2026-06-12)
 *
 * 수정한 버그:
 *  - 홈 후기 탭의 "후기 더보기"가 별도 더미 페이지(/reviews = MOCK_REVIEWS, "전체 9,999건",
 *    맥락 안 맞는 "후기 작성하기"·동작 안 하는 버튼)로 이동했음.
 *  - 상담사 탭과 동일하게 "그 자리에서 펼침(visibleReviewCount)"으로 변경 + /reviews 라우트/페이지 폐기.
 */

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('홈 후기 더보기 — 인페이지 누적 + 더미 폐기', () => {
  test('홈 후기 탭에 /reviews 더미로 가는 링크가 없다', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('load').catch(() => {})

    // 메인탭 "후기" 진입
    const reviewTab = page.getByRole('button', { name: '후기', exact: true })
    await expect(reviewTab, '홈 메인탭 후기 버튼 없음').toBeVisible({ timeout: 10_000 })
    await reviewTab.click()
    await page.waitForTimeout(1_200)

    // 더보기가 /reviews 페이지로 가는 <a> 링크가 아니어야 함 (이제 인페이지 button)
    const dummyLink = await page.locator('a[href="/reviews"]').count()
    expect(dummyLink, `홈에 /reviews 더미 링크가 ${dummyLink}개 남아있음`).toBe(0)
  })

  test('/reviews 더미 전체목록 페이지가 폐기됐다', async ({ page }) => {
    await page.goto('/reviews')
    await page.waitForLoadState('load').catch(() => {})
    await page.waitForTimeout(800)

    // Reviews.tsx 더미 고유 문구가 더 이상 뜨지 않아야 함
    await expect(
      page.getByText('후기 작성 시 코인 지급!'),
      '더미 /reviews 페이지가 아직 살아있음 (후기작성 안내 노출)',
    ).toHaveCount(0)
    await expect(
      page.getByText(/전체\s*9,?999\s*건/),
      '더미 "전체 9,999건" 표식이 노출됨',
    ).toHaveCount(0)
  })
})
