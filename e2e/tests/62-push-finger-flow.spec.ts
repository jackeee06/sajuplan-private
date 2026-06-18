import { test, expect } from '@playwright/test'

/**
 * [2026-06-11] 푸시 알림 내역 — 실제 사용자 손가락 동작 그대로 검증 (UI 클릭만 사용).
 *
 * 흐름(전부 화면 클릭/입력):
 *   ① 개별회원 칩 클릭 → 회원 검색 → 결과 클릭으로 선택
 *   ② 제목·본문 입력 → [푸시알림 보내기] 클릭 → 확인창 수락
 *   ③ 내역에 새 행 등장 → 행 클릭 → 상세 팝업에서 본문 확인
 *   ④ 팝업 [삭제] 클릭 → 확인창 수락 → 행이 사라짐
 *
 * 관리자 세션(storageState.json) 사용. window.confirm 은 dialog 핸들러로 수락.
 */

test.describe('푸시 알림 내역 — 손가락 동작 E2E', () => {
  test.use({ storageState: 'storageState.json' })

  test('발송 → 행 클릭 상세(본문) → 🗑 삭제까지 화면 클릭만으로', async ({ page }) => {
    // 모든 window.confirm 자동 수락 (발송 확인 + 삭제 확인)
    page.on('dialog', (d) => d.accept())

    await page.goto('/mng/push-notifications', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    const marker = `손가락검증-${Date.now()}`
    const bodyText = '손가락 동작 E2E 본문입니다.'

    // ① 개별회원 칩 클릭
    await page.getByRole('button', { name: /개별회원/ }).click()

    // 회원 검색 → 결과 선택 (손가락)
    const searchBox = page.getByPlaceholder('이름, 닉네임, 아이디로 검색 (2자 이상)')
    await expect(searchBox).toBeVisible()
    await searchBox.fill('e2e_member')
    const firstResult = page.locator('div.absolute.z-20 button').first()
    await expect(firstResult).toBeVisible({ timeout: 10000 })
    await firstResult.click()
    // 선택 확정 표시
    await expect(page.getByText(/✓/).first()).toBeVisible()

    // ② 제목/본문 입력 후 발송 버튼 클릭
    await page.getByPlaceholder('예: 사주플랜 신규 이벤트 안내').fill(marker)
    await page.getByPlaceholder('알림 미리보기에 표시될 짧은 본문').fill(bodyText)
    await page.getByRole('button', { name: '푸시알림 보내기' }).click()

    // 발송 완료 카드
    await expect(page.getByText('발송 완료')).toBeVisible({ timeout: 15000 })

    // ③ 내역에 새 행 등장 → 클릭
    const row = page.locator('table tbody tr', { hasText: marker })
    await expect(row).toBeVisible({ timeout: 10000 })
    await row.locator('td').first().click()

    // 상세 팝업에서 본문 확인 (실제로 읽힘)
    const modal = page.locator('div.fixed.inset-0.z-50')
    await expect(modal.getByRole('heading', { name: '알림 상세' })).toBeVisible()
    await expect(modal.getByText(bodyText)).toBeVisible()

    // ④ 팝업 [삭제] 클릭 → 확인창 수락 → 팝업 닫힘
    await modal.getByRole('button', { name: '삭제' }).click()
    await expect(modal).toHaveCount(0)

    // 새로고침(사용자가 다시 들어왔을 때) 후에도 그 알림은 사라져 있어야 (삭제 영속)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    await expect(page.locator('table tbody tr', { hasText: marker })).toHaveCount(0, { timeout: 10000 })
  })
})
