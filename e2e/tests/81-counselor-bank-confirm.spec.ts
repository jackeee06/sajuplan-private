import { test, expect } from '@playwright/test'

/**
 * 상담사 계좌 등록 — 인앱 확인창 회귀 (버그: 앱에서 저장 안 됨)
 *
 * 배경: 이 앱 WebView 는 네이티브 다이얼로그를 끈 구조라 `window.confirm()` 이
 *       창을 띄우지 못하고 false 반환 → 저장이 조용히 막혔다(앱에서만 발생).
 * 수정: window.confirm → 인앱 ConfirmModal(useConfirm) 교체.
 *
 * 검증:
 *   1. 계좌 모달에서 저장 클릭 → 네이티브 다이얼로그가 아니라 인앱 확인창이 뜬다
 *   2. 네이티브 confirm/alert 이벤트는 발생하지 않는다 (앱 WebView 동등성)
 *   ※ 데이터 변경/3일 잠금을 피하기 위해 확인창에서 '취소'로 마무리 (저장 안 함)
 */

test.describe('상담사 계좌 등록 — 인앱 확인창', () => {
  test.use({ storageState: 'user_dual_storage.json' })

  test('저장 클릭 시 인앱 ConfirmModal 노출 (네이티브 다이얼로그 미사용)', async ({ page }) => {
    // 네이티브 다이얼로그가 뜨면 즉시 감지 (수정 전 동작) — 발생 시 테스트 실패 신호로 기록
    let nativeDialogFired = false
    page.on('dialog', (d) => { nativeDialogFired = true; void d.dismiss() })

    await page.goto('/counselor/mypage/bank', { waitUntil: 'domcontentloaded' })
    expect(page.url()).not.toContain('/login')

    // 입금 계좌 카드의 등록/변경 버튼
    await page.getByRole('button', { name: /^(등록|변경)$/ }).first().click()

    // 계좌 모달 — 유효 입력
    await page.locator('select').selectOption('우리')
    await page.getByPlaceholder('홍길동').fill('테스트')
    await page.getByPlaceholder(/숫자만 입력/).fill('1002844986874')

    // 13자리 검증 통과 확인
    await expect(page.getByText('13자리 입력됨 ✓')).toBeVisible()

    // 저장 클릭 → 인앱 확인창이 떠야 함
    await page.getByRole('button', { name: '저장' }).click()

    // 인앱 ConfirmModal (role=dialog) 노출 확인
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('계좌 정보를 저장하시겠습니까?')).toBeVisible()
    console.log('[OK] 저장 클릭 → 인앱 확인창 노출')

    // 네이티브 다이얼로그는 발생하지 않아야 함 (앱 WebView 에서도 동작)
    expect(nativeDialogFired).toBe(false)

    // 데이터 변경/잠금 방지 — 취소로 마무리
    await dialog.getByRole('button', { name: '취소' }).click()
    await expect(page.getByText('계좌 정보를 저장하시겠습니까?')).toBeHidden()
    console.log('[OK] 취소로 마무리 — 계좌 미변경')
  })
})
