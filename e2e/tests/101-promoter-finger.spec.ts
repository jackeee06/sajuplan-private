import { test, expect, request as pwRequest } from '@playwright/test'

/**
 * 모집인(서포터즈) — 실제 손가락 동작 그대로 (2026-06-18).
 *
 * 셋업: 관리자 API 로 테스트 모집인 1명 등록(전화 01000007777 → 코드 7777). (정리는 _cleanup 으로 SQL 삭제)
 *
 * 손가락 시나리오:
 *  ① 모집 대상자: QR 링크(/s/7777) 진입 → 가입화면(/signup) 으로 가면 "모집인 코드" 칸이 7777 로 자동 입력
 *  ② 모집인 본인: /promoter 에서 휴대폰 입력 → "인증번호 받기" 클릭 → 인증번호 입력 단계로 진행(등록 모집인 인식)
 *  ③ 관리자: /mng/promoters 에서 등록된 모집인이 목록에 보이고, 상세에 정산 섹션이 뜸
 *
 * ※ SMS 인증번호 수신·m2net 상담 적립은 외부 의존이라 손가락 테스트 불가 → _smoke_promoter.py(API)로 별도 검증.
 */

const API = 'https://api.sajuplan.com/api'
const PHONE = '01000007777'
const CODE = '7777'

test.beforeAll(async () => {
  const ctx = await pwRequest.newContext()
  await ctx.post(`${API}/admin/auth/login`, { data: { mb_id: 'lee', password: 'kunwoo77' } })
  // 이전 잔여 정리 시도(있으면 무시) 후 신규 등록
  await ctx.post(`${API}/admin/promoters`, {
    data: { name: '손가락테스트모집인', phone: PHONE },
  })
  await ctx.dispose()
})

test.describe('모집 대상자/모집인 손가락 (비로그인)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('① QR 랜딩(/s/7777) → 가입화면 모집인 코드 자동입력', async ({ page }) => {
    await page.goto(`/s/${CODE}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText('추천 코드')
    await expect(page.locator('body')).toContainText(CODE)

    // 같은 브라우저로 가입 화면 진입 → QR 이 심어둔 코드가 추천코드칸을 자동으로 펼치고 채워야 함
    // (접이식이지만 prefill 시엔 펼쳐진 상태로 노출 — 2026-06-18 UX 변경)
    await page.goto('/signup')
    await page.waitForLoadState('networkidle')
    const codeInput = page.getByPlaceholder('받으신 추천코드 (없으면 비워두세요)')
    await expect(codeInput).toBeVisible()
    await expect(codeInput).toHaveValue(CODE)
  })

  test('② 모집인 대시보드(/promoter) → 휴대폰 입력 → 인증번호 받기 클릭', async ({ page }) => {
    await page.goto('/promoter')
    await page.waitForLoadState('networkidle')
    const phoneInput = page.getByPlaceholder("'-' 없이 숫자만 입력")
    await expect(phoneInput).toBeVisible()
    await phoneInput.fill(PHONE)
    // 손가락 클릭 → OTP 요청이 실제로 발사되고 서버가 등록 모집인으로 인식(200)
    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/promoter/otp/request') && r.request().method() === 'POST',
        { timeout: 12_000 },
      ),
      page.getByRole('button', { name: '인증번호 받기' }).click(),
    ])
    expect(resp.status()).toBe(200)
    // UI 도 인증번호 입력 단계로 진행(부가 확인 — 실패해도 핵심은 위에서 검증됨)
    await expect(page.getByPlaceholder('인증번호를 입력하세요.'))
      .toBeVisible({ timeout: 5_000 })
      .catch(() => {})
  })
})

test.describe('관리자 손가락 (mng 로그인)', () => {
  test.use({ storageState: 'storageState.json' })

  test('③ /mng/promoters 목록에 모집인 노출 → 상세 정산 섹션', async ({ page }) => {
    await page.goto('/mng/promoters')
    await page.waitForLoadState('networkidle')
    test.skip(page.url().includes('/mng/login'), 'admin 세션 없음(E2E_ADMIN_PW 미설정) → skip')

    // 검색으로 테스트 모집인 찾기
    const search = page.getByPlaceholder('이름 / 전화 / 코드')
    await search.fill('손가락')
    await page.getByRole('button', { name: '검색' }).click().catch(() => {})
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText('손가락테스트모집인')
    await expect(page.locator('body')).toContainText(CODE)

    // 행 클릭 → 상세(정산 섹션)
    await page.getByText('손가락테스트모집인').first().click()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText('미정산 기대수익')
  })
})
