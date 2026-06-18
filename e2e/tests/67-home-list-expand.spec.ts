import { test, expect } from '@playwright/test'

/**
 * 홈(초기화면) 상담사 리스트 — 초기 노출 수 + "더보기" 펼침 상태 유지 (2026-06-12).
 *
 * 변경:
 *   ① 초기 노출 13 → 20 명
 *   ② "더보기"로 펼친 상태를 (탭,칩)별 sessionStorage 에 저장 → 다른 페이지 갔다 와도 펼침 유지
 *
 * 카드 수 카운트: 상담사 카드마다 "30초당" 가격 라벨이 1개씩 있음 → 개수 = 카드 수.
 */
const countCards = (page: import('@playwright/test').Page) =>
  page.getByText('30초당', { exact: true }).count()

test.describe('홈 상담사 리스트 펼침', () => {
  test('초기 20명 + 더보기 펼침이 재방문 후에도 유지', async ({ page }) => {
    await page.goto('/')
    // 첫 카드가 뜰 때까지
    await expect(page.getByText('30초당', { exact: true }).first()).toBeVisible()

    const initial = await countCards(page)
    const moreBtn = page.getByRole('button', { name: '더보기' })

    if (await moreBtn.isVisible().catch(() => false)) {
      // 더보기가 있다 = 전체가 20명보다 많다 → 초기 노출은 정확히 20
      expect(initial, `초기 노출 수가 20이 아님 (${initial})`).toBe(20)

      // ② 더보기 클릭 → 전체 펼침
      await moreBtn.click()
      await expect(moreBtn).toBeHidden() // 전부 펼치면 버튼 사라짐
      const expanded = await countCards(page)
      expect(expanded, '펼친 후 카드가 안 늘어남').toBeGreaterThan(initial)

      // 다른 페이지로 이동했다가 뒤로 — 홈 재마운트
      await page.goto('/counselors/123')
      await expect(page.getByText('라온선생').first()).toBeVisible()
      await page.goBack()

      // 재진입 후에도 펼침 유지 (20으로 리셋되면 안 됨)
      await expect(page.getByText('30초당', { exact: true }).first()).toBeVisible()
      await expect
        .poll(() => countCards(page), { timeout: 10_000 })
        .toBe(expanded)
      // 펼쳐진 상태이므로 더보기 버튼은 여전히 숨김
      await expect(page.getByRole('button', { name: '더보기' })).toBeHidden()
    } else {
      // 전체가 20명 이하면 더보기 자체가 없음 — 초기 노출이 곧 전체
      expect(initial, '더보기 없는데 21명 이상 노출됨').toBeLessThanOrEqual(20)
      test.info().annotations.push({ type: 'note', description: `상담사 ${initial}명(≤20)이라 더보기 없음 — 펼침 유지는 N/A` })
    }
  })
})
