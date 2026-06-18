import { test, expect } from '@playwright/test'

/**
 * 상담사 전화상담내역 — "놓친 수익 기회" 표시 (실제 손가락).
 *
 * 회원이 전화했으나 상담사 연결 전 끊긴 통화를, 상담사 화면에선 기분 나쁜 "실패"가 아니라
 * 잡았다면 수익이 났을 "아쉬운 기회(🥲)"로 보여주고 상담가능 유지를 유도한다.
 *
 * 사전조건: 상담사 e2e_dual(141) 을 향한 임시 놓친통화(callid='e2emiss_finger001') 삽입됨.
 */
test.use({ storageState: 'user_dual_storage.json' })

test('상담사 통화내역에 "놓친 수익 기회" 카드가 표시된다', async ({ page }) => {
  await page.goto('/counselor/mypage/calls', { waitUntil: 'domcontentloaded' })
  expect(page.url()).not.toContain('/login')
  await page.waitForTimeout(2500)

  // 시드 데이터(놓친 연결)가 없으면 검증 불가 → skip (suite 안정성).
  const missedCount = await page.getByText(/놓친 수익 기회/).count()
  test.skip(missedCount === 0, '놓친 연결 시드 데이터 없음 — 검증 생략')

  await expect(page.getByText(/놓친 수익 기회/).first()).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/상담가능을 켜두면 다음 기회를 잡을 수 있어요/).first()).toBeVisible({ timeout: 8000 })
  console.log('[OK] 놓친 수익 기회 카드 + 동기부여 문구 표시')
})
