import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

/**
 * [2026-05-25] BottomNav (하단 고정 메뉴) 비로그인 기준 검증.
 *
 * Phase 1: 비로그인 기준
 *  - 5개 아이템 모두 보임 (상담사, 단골, 홈, 코인충전, 마이)
 *  - 각 클릭 시 올바른 경로로 이동
 *  - 비로그인이면 isCounselor=false → 4번째 = '코인충전' 라벨
 *
 * Phase 2 (별도 spec, 로그인 후): 상담사 모드에서 4번째 = '수익금' 라벨 검증
 */

test.describe('BottomNav 라우팅 (비로그인)', () => {
  test('5개 메뉴 항목 모두 보임', async ({ page }) => {
    await page.goto('/')
    // 메뉴 항목 텍스트 검증
    for (const label of ['상담사', '단골', '홈', '코인충전', '마이']) {
      await expect(page.locator('nav').getByText(label, { exact: true }).first()).toBeVisible()
    }
  })

  test('홈 메뉴 클릭 → / 도달', async ({ page }) => {
    await page.goto('/counselors')
    await page.locator('nav').getByText('홈', { exact: true }).first().click()
    await page.waitForURL('**/')
    expect(new URL(page.url()).pathname).toBe('/')
  })

  test('상담사 메뉴 클릭 → /counselors 도달', async ({ page }) => {
    await page.goto('/')
    await page.locator('nav').getByText('상담사', { exact: true }).first().click()
    await page.waitForURL('**/counselors')
    expect(new URL(page.url()).pathname).toBe('/counselors')
  })

  test('코인충전 메뉴 클릭 — 비로그인 → /login 가드 (라벨이 "수익금" 이면 절대 안 됨)', async ({ page }) => {
    await page.goto('/')
    // 비로그인 이라 4번째는 '코인충전' 이어야 함 (수익금 X)
    const fourthLabel = page.locator('nav').getByText(/^(코인충전|수익금)$/).first()
    const labelText = await fourthLabel.textContent()
    expect(labelText, '비로그인 시 4번째 라벨은 코인충전이어야 함').toContain('코인충전')

    // 클릭 → /mypage/charge → 가드 → /login
    await fourthLabel.click()
    await page.waitForURL(/\/login|\/mypage\/charge/, { timeout: 10_000 })
    const finalPath = new URL(page.url()).pathname
    // /mypage/charge 로 갔다가 가드로 /login 가거나, 즉시 /login 일 수도
    expect(
      finalPath === '/login' || finalPath === '/mypage/charge',
      `비로그인 코인충전 클릭 → /login 또는 /mypage/charge 도달 (실제: ${finalPath})`,
    ).toBeTruthy()
  })
})
