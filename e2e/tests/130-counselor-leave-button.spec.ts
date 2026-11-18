import { test, expect } from '@playwright/test'
import { skipIfAdminLoginFailed } from '../helpers/admin-skip'

/**
 * 상담사 탈퇴 버튼 UI 검증 (2026-11-03) — 상담사 소프트삭제 + 재가입 안전장치.
 *
 * - 활성 상담사: 빨강 [탈퇴] 버튼이 보이고, 누르면 확인창이 뜬다.
 *   수익금/정산이 있는 계정이면 "복구가 낫다"는 경고(미정산 수익금 금액 포함)가 나와야 한다.
 * - 탈퇴된 상담사: 회색 [탈퇴됨] 비활성 버튼 + 상단 복구 배너.
 *
 * 비파괴: 확인창은 '취소(dismiss)'로 닫아 실제 탈퇴는 일으키지 않는다.
 */

const ACTIVE_EARNER_ID = 288 // 김찬주(acoearth) — 미정산 수익금 있음 → 경고 떠야 함
const WITHDRAWN_ID = 110 // 이안(dummy_09) — 이미 탈퇴됨

test.describe('상담사 탈퇴 버튼', () => {
  test.beforeEach(skipIfAdminLoginFailed)

  test('활성 상담사 → 빨강 [탈퇴] + 수익금 경고 확인창(취소로 비파괴)', async ({ page }) => {
    await page.goto(`/mng/members/counselors/${ACTIVE_EARNER_ID}`)
    expect(page.url(), '어드민 로그인 안 됨').not.toContain('/mng/login')

    const leaveBtn = page.getByRole('button', { name: '탈퇴', exact: true })
    await expect(leaveBtn, '[탈퇴] 버튼이 안 보임').toBeVisible({ timeout: 15000 })
    await expect(leaveBtn, '[탈퇴] 버튼이 비활성').toBeEnabled()

    // window.confirm 가로채서 메시지 확인 후 '취소' → 실제 탈퇴는 하지 않음
    let dialogMsg = ''
    page.once('dialog', async (d) => {
      dialogMsg = d.message()
      await d.dismiss()
    })
    await leaveBtn.click()
    await expect.poll(() => dialogMsg, { timeout: 10000 }).not.toEqual('')
    expect(dialogMsg, '경고에 미정산 수익금 안내 없음').toContain('미정산 수익금')
    expect(dialogMsg, '경고에 복구 안내 없음').toContain('복구')

    // 취소했으니 여전히 활성 = [탈퇴] 버튼 그대로
    await expect(leaveBtn).toBeVisible()
    await page.screenshot({ path: 'artifacts/leave-active.png', fullPage: false })
  })

  test('탈퇴된 상담사 → 회색 [탈퇴됨] 비활성 + 복구 배너', async ({ page }) => {
    await page.goto(`/mng/members/counselors/${WITHDRAWN_ID}`)
    expect(page.url()).not.toContain('/mng/login')

    const doneBtn = page.getByRole('button', { name: '탈퇴됨' })
    await expect(doneBtn, '[탈퇴됨] 버튼이 안 보임').toBeVisible({ timeout: 15000 })
    await expect(doneBtn, '[탈퇴됨] 이 비활성이 아님').toBeDisabled()

    await expect(page.getByText('탈퇴한 상담사 계정입니다')).toBeVisible()
    await expect(page.getByRole('button', { name: /이 계정 복구/ })).toBeVisible()
    await page.screenshot({ path: 'artifacts/leave-withdrawn.png', fullPage: false })
  })
})
