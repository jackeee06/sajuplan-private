import { test, expect, request } from '@playwright/test'

/**
 * 예금주 한글 입력 — 아이폰 분해형(NFD) 대응.
 *
 * 버그: 예금주 칸이 "한글만" 정규식으로 막는데, 아이폰이 한글을 분해형(NFD: 손→ㅅ+ㅗ+ㄴ)으로
 *       보내면 정규식에 안 걸려 입력이 통째로 무시 → "이름이 안 써짐".
 * 수정: 입력 NFC 정규화(프론트 IME 안전 + 백엔드 방어).
 *
 * 검증:
 *   1. (UI) 분해형 "손지훈" 을 입력해도 칸에 NFC 로 합쳐져 보이고 저장 가능
 *   2. (API) 분해형 예금주로 저장해도 400 이 아니라 정상 저장 + NFC 로 보관
 */

const API = 'https://api.sajuplan.com'
const NAME_NFC = '손지훈'
const NAME_NFD = '손지훈'.normalize('NFD') // ㅅ+ㅗ+ㄴ ... (조합용 자모)
const BANK = '우리'
const ACCOUNT = '1002000000000'

test.describe('예금주 NFD 입력 대응', () => {
  test.use({ storageState: 'user_dual_storage.json' })

  test('분해형(NFD) 글자가 다른 코드포인트인지 사전 확인', () => {
    expect(NAME_NFD).not.toBe(NAME_NFC)
    expect(NAME_NFD.length).toBeGreaterThan(NAME_NFC.length) // 분해형이 더 김
    expect(NAME_NFD.normalize('NFC')).toBe(NAME_NFC)
  })

  test('UI — 분해형 입력이 칸에서 NFC 로 합쳐지고 저장됨', async ({ page }) => {
    await page.goto('/counselor/mypage/bank', { waitUntil: 'domcontentloaded' })
    expect(page.url()).not.toContain('/login')

    await page.getByRole('button', { name: /^(등록|변경)$/ }).first().click()
    await page.locator('select').selectOption(BANK)

    const holder = page.getByPlaceholder('홍길동')
    await holder.clear()
    await holder.fill(NAME_NFD) // 분해형 주입 (아이폰 입력 모사)
    // 칸 값이 NFC 로 합쳐져야 함 ("이름이 안 써짐" 버그면 빈 값/누락)
    await expect(holder).toHaveValue(NAME_NFC)
    // "한글만 입력 가능" 경고가 뜨면 안 됨
    await expect(page.getByText('한글만 입력 가능 (본인 명의)')).toHaveCount(0)

    const acct = page.getByPlaceholder(/숫자만 입력/)
    await acct.clear(); await acct.fill(ACCOUNT)
    await expect(page.getByText('13자리 입력됨 ✓')).toBeVisible()

    // 저장 → 인앱 확인창 → 저장
    await page.getByRole('button', { name: '저장' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: '저장' }).click()

    await expect(page.getByText('상담사만 접근할 수 있습니다.')).toHaveCount(0)
    await expect(page.getByText('예금주명은 한글')).toHaveCount(0)
    await expect(page.getByText(NAME_NFC, { exact: false })).toBeVisible({ timeout: 12000 })
    console.log('[OK] 분해형 입력 → NFC 합쳐짐 → 저장 성공')
  })

  test('API — 분해형 예금주로 저장해도 정상(400 아님) + NFC 보관', async () => {
    const ctx = await request.newContext({ storageState: 'user_dual_storage.json' })
    const resp = await ctx.post(`${API}/api/user/counselor-mypage/payout/bank`, {
      data: { bank_name: BANK, bank_holder: NAME_NFD, bank_account: ACCOUNT },
    })
    // 400(한글 검증 실패)이면 버그. 2xx 정상 처리여야 함.
    expect([200, 201], `status=${resp.status()} body=${await resp.text()}`).toContain(resp.status())

    const av = await ctx.get(`${API}/api/user/counselor-mypage/payout/available`)
    const data = await av.json() as { bank_holder: string | null }
    expect(data.bank_holder).toBe(NAME_NFC) // NFC 로 보관
    console.log(`[OK] API NFD 저장 → 보관값=${data.bank_holder}`)
    await ctx.dispose()
  })
})
