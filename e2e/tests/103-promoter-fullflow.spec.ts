import { test, expect, type Page } from '@playwright/test'
import { execSync } from 'child_process'
import path from 'path'

/**
 * 모집인(서포터즈) 자가신청 → 관리자 승인 → 재로그인 — "실제 사용자 손가락" 풀플로우 (2026-06-18).
 *
 * 화면을 실제로 클릭해서 끝까지 돈다:
 *   ① (사용자)  /promoter 휴대폰 입력 → 인증번호 받기 → (DB에서 코드 읽어 입력) → 미등록 → 신청 폼 제출
 *   ② (관리자)  /mng/promoters 목록에서 검색 → 상세 → 승인 버튼 클릭 → status=active
 *   ③ (사용자)  다시 인증 로그인 → 대시보드(기대수익) 진입
 *
 * 인증번호는 사용자가 카톡으로 받아 입력하는 것과 동일하게, 서버 sms_auth 에 저장된 코드를
 * helpers/_e2e_db.py 로 읽어 화면에 그대로 입력한다(발송 자체는 미사용 테스트번호라 도달 안 함).
 */

const PHONE = '01000000001' // 미사용 테스트 전용 번호
const NAME = 'E2E손가락테스트'
const HELPER = path.resolve(__dirname, '../helpers/_e2e_db.py')

function db(cmd: string, arg: string): string {
  return execSync(`python "${HELPER}" ${cmd} ${arg}`, { encoding: 'utf-8', timeout: 60_000 }).trim()
}

function getOtp(): string {
  const code = db('otp', PHONE)
  expect(code, 'sms_auth 에서 인증번호 조회').toMatch(/^\d{6}$/)
  return code
}

/** /promoter 휴대폰 OTP 로그인 (인증번호 받기 → DB코드 입력 → 로그인 클릭) */
async function otpLogin(page: Page) {
  await page.goto('/promoter')
  await page.waitForLoadState('networkidle')
  await page.getByPlaceholder("'-' 없이 숫자만 입력").first().fill(PHONE)
  await page.getByRole('button', { name: '인증번호 받기' }).click()
  await page.getByRole('button', { name: '확인' }).click() // "인증번호가 발송되었습니다" 모달 닫기
  await page.getByPlaceholder('인증번호를 입력하세요.').fill(getOtp())
  await page.getByRole('button', { name: '로그인' }).click()
}

test.describe.configure({ mode: 'serial' })

test.describe('서포터즈 자가신청→관리자승인→로그인 (실제 손가락)', () => {
  test.beforeAll(() => db('cleanup', PHONE))
  test.afterAll(() => db('cleanup', PHONE))

  test('① 사용자 손가락 — 휴대폰 인증 → 미등록 → 신청 폼 제출(pending)', async ({ page }) => {
    await otpLogin(page)

    // 미등록 번호 → 에러 대신 신청 폼 노출
    await expect(page.getByText('아직 등록되지 않은 번호예요.')).toBeVisible()

    await page.getByPlaceholder('이름을 입력하세요.').fill(NAME)
    await page.getByPlaceholder('예: 국민은행').fill('국민은행')
    await page.getByPlaceholder("'-' 포함 가능").fill('123-456-7890')
    await page.getByPlaceholder('예금주명').fill(NAME)
    await page.getByRole('button', { name: '서포터즈 신청하기' }).click()

    await expect(page.getByText('신청이 접수됐어요!')).toBeVisible()
    expect(db('status', PHONE), '신청 직후 상태').toBe('pending')
  })

  test('② 관리자 손가락 — mng 목록에서 검색 → 상세 → 승인 → active', async ({ page }) => {
    page.on('dialog', (d) => d.accept()) // confirm("승인?") + alert("승인했습니다") 자동 확인

    await page.goto('/mng/promoters')
    await page.waitForLoadState('networkidle')

    await page.getByPlaceholder('이름 / 전화 / 코드').fill(NAME)
    await page.getByRole('button', { name: '검색' }).click()
    await page.getByText(NAME, { exact: true }).first().click()
    await page.waitForLoadState('networkidle')

    // 승인 대기 안내 + 승인 버튼 노출 확인 후 클릭
    await expect(page.getByText('승인 대기중인 자가 신청입니다.')).toBeVisible()
    await page.getByRole('button', { name: '승인', exact: true }).click()

    await expect.poll(() => db('status', PHONE), { timeout: 15_000 }).toBe('active')
  })

  test('③ 사용자 손가락 — 승인 후 재로그인 → 대시보드(기대수익) 진입', async ({ page }) => {
    await otpLogin(page)

    await expect(page.getByText('기대수익').first()).toBeVisible()
    await expect(page.getByRole('button', { name: '카카오톡으로 내 링크 공유하기' })).toBeVisible()
    // 내 코드(전화 뒷4자리 0001) 노출 확인
    await expect(page.getByText(/내 코드/)).toBeVisible()
  })
})
