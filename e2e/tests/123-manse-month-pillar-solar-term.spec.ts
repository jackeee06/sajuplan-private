import { test, expect, type Page } from '@playwright/test'

/**
 * 🔮 만세력 월주(월건) 절기 경계 회귀 (manse.sajuplan.com)
 *
 * 제보(2026-07): "2026.07월은 을미월인데 병신월로 나온다"는 오류 신고 → 재현 시도.
 * 사주 월주는 달력 월이 아니라 절기로 끊는다:
 *   - 소서(~7/7) 전  = 오월(甲午)
 *   - 소서(~7/7) 후  = 미월(乙未)   ← 7월 중순의 정답
 *   - 입추(~8/7) 후  = 신월(丙申)   ← 병신월은 8월부터
 * 따라서 7월에 병신(丙申)이 나오면 버그. 이 스펙이 경계를 고정한다.
 */

const BASE = 'https://manse.sajuplan.com'
test.use({ viewport: { width: 390, height: 900 } })

async function monthPillar(page: Page, dateDigits: string): Promise<string> {
  await page.goto(`${BASE}/?view=pro`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(300)
  const date = page.getByPlaceholder('1990/06/15')
  await date.fill('')
  await date.pressSequentially(dateDigits)
  const time = page.getByPlaceholder('07:20')
  await time.fill('')
  await time.pressSequentially('1200')
  await page.getByRole('button', { name: '만세력 보기' }).click()
  // 명식표에서 헤더가 정확히 "월주"인 칸의 천간+지지 한자
  const col = page.locator('div:has(> div:text-is("월주"))').first()
  await expect(col.locator('.font-hanja').first()).toBeVisible()
  const hanja = await col.locator('.font-hanja').allInnerTexts()
  return hanja.slice(0, 2).join('')
}

test('M-1 2026 소서 前(7/3) → 월주 甲午', async ({ page }) => {
  expect(await monthPillar(page, '20260703')).toBe('甲午')
})

test('M-2 2026 소서 後(7/15) → 월주 乙未 (병신 아님)', async ({ page }) => {
  const gz = await monthPillar(page, '20260715')
  expect(gz).toBe('乙未')
  expect(gz).not.toBe('丙申') // 제보된 오류값이 나오면 실패
})

test('M-3 2026 입추 後(8/15) → 월주 丙申 (병신은 8월부터)', async ({ page }) => {
  expect(await monthPillar(page, '20260815')).toBe('丙申')
})
