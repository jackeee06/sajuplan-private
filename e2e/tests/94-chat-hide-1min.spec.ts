import { test, expect } from '@playwright/test'

/**
 * 채팅상담 시간 선택 — 1분(테스트) 옵션 숨김 검증 (2026-06-14) · 실제 손가락 동작.
 *
 * 정책: SHOW_TEST_MINUTE_TO_ALL=false → 1분 테스트 옵션 전체 숨김. 15/30/45/60분만 노출.
 *
 * 회원이 실제로 누르는 순서 그대로:
 *   1. 홈 진입 (e2e_member 세션)
 *   2. 첫 "채팅상담" 버튼 클릭 → "채팅상담 가능" 모달 오픈
 *   3. "상담 시간 선택"에 15/30/45/60분 보이고 1분·"테스트" 배지 없음
 */

test.use({
  storageState: 'user_member_storage.json',
  viewport: { width: 390, height: 844 },
})

test.describe('채팅 시간 선택 — 1분 숨김', () => {
  test('홈 → 채팅상담 모달 → 1분/테스트 없음, 15·30·45·60분만', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // 1. 첫 "채팅상담" 버튼 (available 상태 카드) 클릭
    const chatBtn = page.getByRole('button', { name: '채팅상담' }).first()
    await expect(chatBtn).toBeVisible({ timeout: 15_000 })
    await chatBtn.click()

    // 2. 모달 오픈 — "상담 시간 선택"
    await expect(page.getByText('상담 시간 선택')).toBeVisible({ timeout: 10_000 })

    // 3. 정상 옵션은 보이고 (30분은 "베스트" 배지가 버튼명에 섞이므로 텍스트로 확인)
    for (const m of ['15분', '30분', '45분', '60분']) {
      await expect(page.getByText(m, { exact: true })).toBeVisible()
    }
    // 베스트 배지(30분)는 그대로 유지 — 회귀 확인
    await expect(page.getByText('베스트', { exact: true })).toBeVisible()

    // 4. 1분 옵션 + "테스트" 배지는 사라져야 함
    //    (1분 버튼은 항상 "테스트" 배지를 달고 나오므로, 배지 0 = 1분 숨김 확정)
    expect(await page.getByText('테스트', { exact: true }).count(), '"테스트" 배지 잔존').toBe(0)
    expect(await page.getByText('1분', { exact: true }).count(), '1분 옵션 잔존').toBe(0)

    await page.screenshot({ path: 'test-results/_shot_chat_no_1min.png' })
  })
})
