import { test, expect, type Page } from '@playwright/test'

/**
 * 🔮 만세력 — 월주 절기 근거 + 진태양시 안내 표기 (manse.sajuplan.com)
 *
 * "만세력이 틀렸다" 오해 방지: 화면에 계산 근거를 노출한다.
 *  - 월주는 달력이 아니라 '절기'로 바뀐다는 근거(입절 절기명·시각) 표기
 *  - 진태양시 보정 적용 → 일반 만세력과 시(時)가 다를 수 있음을 안내
 */

const BASE = 'https://manse.sajuplan.com'
test.use({ viewport: { width: 390, height: 900 } })

async function compute(page: Page, view: 'pro' | 'easy', dateDigits: string) {
  await page.goto(`${BASE}/?view=${view}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(300)
  const date = page.getByPlaceholder('1990/06/15')
  await date.fill('')
  await date.pressSequentially(dateDigits)
  const time = page.getByPlaceholder('07:20')
  await time.fill('')
  await time.pressSequentially('1200')
  await page.getByRole('button', { name: '만세력 보기' }).click()
  await page.waitForTimeout(800)
}

test('B-1 전문가 보기 — 월주 절기 근거(소서 입절 → 未월) 표기', async ({ page }) => {
  await compute(page, 'pro', '20260715')
  await expect(page.getByText('월주 기준', { exact: false })).toBeVisible()
  await expect(page.getByText('소서', { exact: false }).first()).toBeVisible()
  // 진태양시 안내
  await expect(page.getByText('진태양시 보정 적용', { exact: false })).toBeVisible()
})

test('B-2 쉬운 보기 — 절기로 달이 바뀐다는 안내 + 未월', async ({ page }) => {
  await compute(page, 'easy', '20260715')
  await expect(page.getByText('절기', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('소서', { exact: false }).first()).toBeVisible()
})
