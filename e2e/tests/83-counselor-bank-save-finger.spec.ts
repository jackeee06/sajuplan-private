import { test, expect, request } from '@playwright/test'

/**
 * 상담사 계좌 등록 — 실제 손가락 동작 그대로 "저장 끝까지" 검증.
 *
 * 81 은 확인창 노출까지만(취소로 마무리). 이 spec 은 실제 사용자처럼
 * 입력 → 저장 → 인앱 확인창 '저장' → 실제 영속까지 끝까지 누른다.
 *
 * 멱등: 항상 동일한 고정 테스트 값으로 저장 → 재실행 시 sameAsBefore 로
 *       추가 잠금 없이 통과. (대상은 dedicated e2e 계정)
 *
 * 검증:
 *   1. 입력 → 저장 클릭 → 인앱 확인창 → '저장' 확정
 *   2. 모달 닫히고 계좌 카드에 저장된 정보 표시 (은행/예금주/계좌)
 *   3. API 로도 영속 확인 (has_bank_info=true, bank_name/holder 일치)
 */

const API = 'https://api.sajuplan.com'
const BANK = '우리'
const HOLDER = '테스트계좌'
const ACCOUNT = '1002000000000' // 13자리 고정 테스트 계좌번호

test.describe('상담사 계좌 등록 — 끝까지 저장(손가락)', () => {
  test.use({ storageState: 'user_dual_storage.json' })

  test('입력 → 저장 → 확인창 저장 → 영속 확인', async ({ page }) => {
    // 네이티브 다이얼로그가 뜨면 감지 (앱 WebView 동등성 — 떠선 안 됨)
    let nativeDialogFired = false
    page.on('dialog', (d) => { nativeDialogFired = true; void d.dismiss() })

    // ── 1) 계좌 페이지 진입 ──
    await page.goto('/counselor/mypage/bank', { waitUntil: 'domcontentloaded' })
    expect(page.url()).not.toContain('/login')

    // ── 2) 등록/변경 버튼 → 모달 ──
    await page.getByRole('button', { name: /^(등록|변경)$/ }).first().click()

    // ── 3) 손가락 입력 (변경 모드면 기존값이 채워져 있으므로 먼저 비움) ──
    await page.locator('select').selectOption(BANK)
    const holderInput = page.getByPlaceholder('홍길동')
    await holderInput.clear()
    await holderInput.fill(HOLDER)
    await expect(holderInput).toHaveValue(HOLDER)
    const accountInput = page.getByPlaceholder(/숫자만 입력/)
    await accountInput.clear()
    await accountInput.fill(ACCOUNT)
    await expect(accountInput).toHaveValue(ACCOUNT)
    await expect(page.getByText('13자리 입력됨 ✓')).toBeVisible()

    // ── 4) 저장 → 인앱 확인창 → '저장' 확정 ──
    await page.getByRole('button', { name: '저장' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('계좌 정보를 저장하시겠습니까?')).toBeVisible()
    await dialog.getByRole('button', { name: '저장' }).click()
    console.log('[OK] 입력 → 저장 → 확인창 저장 클릭')

    // ── 5) 모달 닫히고 카드에 저장 정보 표시 ──
    await expect(page.getByText('계좌 정보를 저장하시겠습니까?')).toBeHidden({ timeout: 10000 })
    // 카드에 은행/예금주/계좌 노출 (refresh 후)
    await expect(page.getByText(HOLDER, { exact: false })).toBeVisible({ timeout: 12000 })
    await expect(page.getByText(ACCOUNT, { exact: false })).toBeVisible({ timeout: 12000 })
    console.log('[OK] 카드에 저장된 계좌 정보 표시')

    // 네이티브 다이얼로그는 발생하지 않아야 함
    expect(nativeDialogFired).toBe(false)

    // ── 6) API 로 영속 확인 ──
    const ctx = await request.newContext({ storageState: 'user_dual_storage.json' })
    const resp = await ctx.get(`${API}/api/user/counselor-mypage/payout/available`)
    expect(resp.status()).toBe(200)
    const data = await resp.json() as {
      has_bank_info: boolean
      bank_name: string | null
      bank_holder: string | null
      bank_account_masked: string | null
    }
    expect(data.has_bank_info).toBe(true)
    expect(data.bank_name).toBe(BANK)
    expect(data.bank_holder).toBe(HOLDER)
    expect(data.bank_account_masked).toContain(ACCOUNT)
    console.log(`[OK] API 영속 확인: ${data.bank_name} / ${data.bank_holder} / ${data.bank_account_masked}`)

    await ctx.dispose()
  })
})
