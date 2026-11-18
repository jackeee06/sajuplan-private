import { test, expect, type Page } from '@playwright/test'

/**
 * 🔮 무료 만세력 — 궁합 탭 양력/음력 선택 (manse.sajuplan.com)
 *
 * 배경: 궁합(나/상대) 입력에 양력/음력 구분이 빠져 있어, 음력 생일을 양력으로
 *       오계산하던 "조용한 오답" 버그. 나/상대 각각 양력·음력·음력윤달 토글 추가.
 *
 * 핵심 검증: 같은 숫자 날짜를 양력으로 계산한 일주(日柱) ≠ 음력으로 계산한 일주.
 *   (토글이 무시되는 버그라면 둘이 같게 나옴 → 이 테스트가 잡아낸다.)
 */

const BASE = 'https://manse.sajuplan.com'
test.use({ viewport: { width: 375, height: 812 } })

// 나/상대 패널을 제목으로 구분해서 잡는다 (양력 버튼을 가진 입력 카드만)
function panel(page: Page, title: '나' | '상대') {
  return page
    .locator('div.rounded-xl.bg-gray-50', { hasText: title })
    .filter({ has: page.getByRole('button', { name: '양력', exact: true }) })
    .first()
}

// 결과 점수카드의 '나' 컬럼 일주(한자 간지)
function naGanzhi(page: Page) {
  return page.locator('div.text-center').filter({ hasText: '나' }).locator('.font-hanja').first()
}

test('C-1 궁합 입력에 양력/음력/음력윤달 토글이 나·상대 각각 존재', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${BASE}/?m=couple`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)

  // 나/상대 = 2세트 → 각 라벨 버튼 2개씩
  await expect(page.getByRole('button', { name: '양력', exact: true })).toHaveCount(2)
  await expect(page.getByRole('button', { name: '음력', exact: true })).toHaveCount(2)
  await expect(page.getByRole('button', { name: '음력 윤달', exact: true })).toHaveCount(2)

  // 가로 오버플로 없음 (375px)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  expect(overflow).toBe(false)
  expect(errors).toEqual([])
})

test('C-2 같은 날짜 양력 vs 음력 → 일주가 달라진다 (음력 변환 실제 동작)', async ({ page }) => {
  await page.goto(`${BASE}/?m=couple`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)

  // 기본 입력(1990/06/15) 그대로 — 나는 양력 상태로 궁합 보기
  await panel(page, '나').getByRole('button', { name: '양력', exact: true }).click()
  await page.getByRole('button', { name: '궁합 보기' }).click()
  await expect(naGanzhi(page)).toBeVisible()
  const solar = (await naGanzhi(page).textContent())?.trim() ?? ''
  expect(solar.length).toBeGreaterThan(0)

  // 나를 음력으로 전환 후 다시 계산
  await panel(page, '나').getByRole('button', { name: '음력', exact: true }).click()
  await page.getByRole('button', { name: '궁합 보기' }).click()
  await expect(naGanzhi(page)).toBeVisible()
  const lunar = (await naGanzhi(page).textContent())?.trim() ?? ''
  expect(lunar.length).toBeGreaterThan(0)

  // 양력≠음력 이어야 토글이 실제 반영된 것
  expect(lunar).not.toBe(solar)
})
