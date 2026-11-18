import { test, expect, type Page } from '@playwright/test'

/**
 * 🔮 만세력 결과 헤더에 세는나이(한국식) 표시 (manse.sajuplan.com · 2026-07)
 *
 * 요청: 결과에 나이가 안 나와서 넣어달라. "85년이면 42세" = 세는나이(올해−생년+1).
 * 사주는 만 나이가 아니라 세는나이를 관례로 쓴다. 헤더 "…띠 · N세"로 노출.
 *   년이 바뀌어도 안 깨지도록 기대값을 (현재년−생년+1)로 동적 계산.
 */

const BASE = 'https://manse.sajuplan.com'
test.use({ viewport: { width: 390, height: 900 } })

async function ageFor(page: Page, birthYear: number): Promise<number> {
  await page.goto(`${BASE}/?view=pro`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(300)
  const date = page.getByPlaceholder('1990/06/15')
  await date.fill('')
  await date.pressSequentially(`${birthYear}0615`)
  const time = page.getByPlaceholder('07:20')
  await time.fill('')
  await time.pressSequentially('1200')
  await page.getByRole('button', { name: '만세력 보기' }).click()
  const expected = new Date().getFullYear() - birthYear + 1
  // 헤더에 "N세" 노출 (…띠 · N세)
  await expect(page.getByText(new RegExp(`${expected}\\uc138`)).first()).toBeVisible()
  return expected
}

test('A-1 1990년생 → 세는나이 (올해−1990+1) 헤더 표시', async ({ page }) => {
  const age = await ageFor(page, 1990)
  expect(age).toBe(new Date().getFullYear() - 1990 + 1)
})

test('A-2 1963년생 → 세는나이 (올해−1963+1) 헤더 표시', async ({ page }) => {
  const age = await ageFor(page, 1963)
  expect(age).toBe(new Date().getFullYear() - 1963 + 1)
})
