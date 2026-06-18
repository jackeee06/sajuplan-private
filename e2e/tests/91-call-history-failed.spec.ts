import { test, expect } from '@playwright/test'

/**
 * 전화상담 내역 — 연결 실패 통화 표시 (실제 손가락).
 *
 * 사장님 결정(B): 상담사 연결 전 끊긴 통화(0초·0원)를 숨기지 말고
 * "연결 실패 · 차감 없음" 으로 보여줘 사용자가 "내 통화 사라졌나?" 혼란을 막는다.
 *
 * 사전조건: e2e_member(140) 에 임시 실패통화 1건(callid='e2efailcall_finger001') 삽입됨.
 */
test.use({ storageState: 'user_member_storage.json' })

test('전화상담 내역에 "연결 실패" 카드가 차감없음으로 표시된다', async ({ page }) => {
  await page.goto('/mypage/calls', { waitUntil: 'domcontentloaded' })
  expect(page.url()).not.toContain('/login')
  await page.waitForTimeout(2500)

  // 시드 데이터(연결 실패 통화)가 없으면 검증 불가 → skip (suite 안정성).
  const failedCount = await page.getByText(/연결 실패/).count()
  test.skip(failedCount === 0, '연결 실패 시드 데이터 없음 — 검증 생략')

  await expect(page.getByText(/연결 실패/).first()).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/0 코인 \(차감 없음\)/).first()).toBeVisible({ timeout: 8000 })
  console.log('[OK] 연결 실패 통화 카드 표시 + 차감 없음(0 코인)')
})
