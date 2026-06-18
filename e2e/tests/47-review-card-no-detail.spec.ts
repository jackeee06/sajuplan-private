import { test, expect } from '@playwright/test'

/**
 * 후기 카드 클릭 비활성 + 전문 노출 검증 (2026-06-12)
 *
 * 수정한 버그:
 *  - 후기 카드 전체가 <Link to="/reviews/:id"> 로 묶여 있어, 무심결에 터치하면
 *    실제 API 연동이 안 된 더미 상세(ReviewDetail = MOCK_REVIEWS[0] 고정)로 이동.
 *    → 어떤 후기를 눌러도 "정말 많은 도움 되었습니다"(샘플) 한 화면만 떴음.
 *  - 후기는 전부 공개 + 리스트에 전문 노출 → 상세 페이지 불필요.
 *  - 카드 클릭(Link) 제거(div 화) + line-clamp-3(3줄 줄임) 해제로 전문 노출.
 *  - /reviews/:id 라우트 + ReviewDetail 더미 페이지 제거.
 *
 * 전제: counselor 141(e2e_dual) 에 공개 후기 1개 이상.
 */

const COUNSELOR_URL = '/counselors/123' // 라온선생 — 실제 공개 후기 6개
const COUNSELOR_ID = 123

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('후기 카드 — 클릭 비활성 + 전문 노출', () => {
  test.beforeEach(async ({ request }) => {
    const r = await request.get(`https://api.sajuplan.com/api/user/counselors/${COUNSELOR_ID}/reviews?limit=50`)
    const body = await r.json().catch(() => ({ total: 0 }))
    const total = Number(body?.total ?? 0)
    test.skip(total < 1, `전제 미충족 — counselor ${COUNSELOR_ID} 공개 후기 0개. 후기 1개 이상 필요.`)
  })

  async function openReviewsTab(page: import('@playwright/test').Page) {
    await page.goto(COUNSELOR_URL)
    await page.waitForLoadState('load').catch(() => {})
    const reviewsBtn = page.getByRole('button', { name: /^후기/ })
    await expect(reviewsBtn, '후기 탭 버튼 없음').toBeVisible({ timeout: 10_000 })
    await reviewsBtn.click()
    await page.waitForTimeout(1_000)
  }

  test('후기 카드에 상세 링크(a[href^="/reviews/"])가 더 이상 없다', async ({ page }) => {
    await openReviewsTab(page)
    const detailLinks = await page.locator('a[href^="/reviews/"]').count()
    expect(detailLinks, `후기 상세 링크가 ${detailLinks}개 남아있음 — 카드 클릭이 아직 살아있다`).toBe(0)
  })

  test('후기 본문을 클릭해도 더미 상세("상담 후기")로 이동하지 않는다', async ({ page }) => {
    await openReviewsTab(page)

    // 신고 버튼이 보이면 후기 카드가 렌더된 것
    const reportBtn = page.getByRole('button', { name: '이 후기 신고' }).first()
    await expect(reportBtn, '후기 카드(신고 버튼)가 안 보임').toBeVisible({ timeout: 8_000 })

    const urlBefore = page.url()

    // 신고 버튼 바로 위(작성자/본문 영역) 좌표를 무심결 터치하듯 클릭
    const box = await reportBtn.boundingBox()
    if (box) {
      await page.mouse.click(box.x - 40, box.y + 60) // 본문 텍스트 부근
      await page.waitForTimeout(1_000)
    }

    const urlAfter = page.url()
    expect(urlAfter, `후기 클릭 후 /reviews/:id 로 이동함: ${urlAfter}`).not.toMatch(/\/reviews\/\d+/)
    expect(urlAfter, '상담사 상세에서 이탈함').toContain('/counselors/')
    // 더미 상세 헤더가 뜨지 않아야 함
    await expect(
      page.getByRole('heading', { name: '상담 후기' }),
      '더미 후기 상세 화면이 떴음',
    ).toHaveCount(0)
  })

  test('후기 본문에 line-clamp(줄임) 클래스가 없다 — 전문 노출', async ({ page }) => {
    await openReviewsTab(page)
    const reportBtn = page.getByRole('button', { name: '이 후기 신고' }).first()
    await expect(reportBtn).toBeVisible({ timeout: 8_000 })

    // 페이지 내 후기 본문 문단(p)에 line-clamp 계열 클래스가 남아있지 않은지 확인
    const clampedCount = await page.locator('p[class*="line-clamp"]').count()
    expect(clampedCount, `line-clamp 적용된 문단이 ${clampedCount}개 — 후기 전문이 잘림`).toBe(0)
  })
})
