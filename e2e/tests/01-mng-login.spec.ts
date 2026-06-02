import { test, expect } from '@playwright/test'
import { skipIfAdminLoginFailed } from '../helpers/admin-skip'

/**
 * mng 어드민 — 로그인 + 핵심 페이지 비파괴 검증.
 *
 * prod 운영 데이터에 영향 안 주는 시나리오만:
 *   1. 로그인 성공 → 대시보드 도달
 *   2. /settings 진입 → 운영알림 탭 클릭 → 안내 박스 + 수신자 목록 보임
 *   3. 추가 버튼 클릭 → 빈 행 생성 (저장 안 함 — 새로고침하면 사라짐)
 *
 * 비번:
 *   admin / test1234! (prod 확인됨)
 */

const ADMIN_ID = 'admin'
const ADMIN_PW = 'test1234!'

/** 401/404 같은 인증 흐름 중 예상 가능한 HTTP 에러는 무시 */
function isIgnorableConsoleError(text: string): boolean {
  return /Failed to load resource.*status of (401|404)/.test(text)
}

function attachErrorCollectors(page: import('@playwright/test').Page, errors: string[]) {
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isIgnorableConsoleError(msg.text())) {
      errors.push(`console.error: ${msg.text()}`)
    }
  })
}

async function login(page: import('@playwright/test').Page) {
  // storageState 로 이미 로그인되어 있으면 /mng/login 진입 시 자동 redirect.
  // 그래서 dashboard 로 바로 가는 게 안전.
  await page.goto('/mng/dashboard')

  // env placeholder 치환 검증
  const config = await page.evaluate(() => (window as any).__SAJUMOON_CONFIG)
  expect(config, '__SAJUMOON_CONFIG 미등록').toBeTruthy()
  expect(config.env, '__SAJUMOON_ENV__ 치환 누락').not.toBe('__SAJUMOON_ENV__')

  // 만약 인증 안 되어 /mng/login 으로 튕겼다면 — form 채우기
  if (page.url().includes('/mng/login')) {
    await page.getByPlaceholder('admin').fill(ADMIN_ID)
    await page.getByPlaceholder('비밀번호를 입력하세요').fill(ADMIN_PW)
    await page.getByRole('button', { name: '로그인' }).click()
    await expect(page).not.toHaveURL(/\/mng\/login/, { timeout: 10_000 })
  }
}

test.describe('mng 어드민', () => {
  test.beforeEach(skipIfAdminLoginFailed)

  test('로그인 → 대시보드/사이드바 정상 렌더', async ({ page }) => {
    const consoleErrors: string[] = []
    attachErrorCollectors(page, consoleErrors)

    await login(page)

    // 사이드바 — 주요 메뉴 (사이드바 안의 link/button role 명시)
    await expect(page.getByRole('link', { name: '대시보드' })).toBeVisible()
    await expect(page.getByRole('button', { name: /회원현황/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /환경설정/ })).toBeVisible()

    expect(consoleErrors, `JS 에러: ${consoleErrors.join(' / ')}`).toHaveLength(0)
  })

  test('운영알림 탭 — 안내 박스 + 수신자 목록 + 추가 버튼', async ({ page }) => {
    const consoleErrors: string[] = []
    attachErrorCollectors(page, consoleErrors)

    await login(page)
    await page.goto('/mng/settings')

    // "운영알림" 탭 클릭
    await page.getByRole('button', { name: '운영알림' }).click()

    // 안내 박스 — 핵심 단어들 보이는지
    await expect(page.getByRole('heading', { name: /운영자 알림이란/ })).toBeVisible()
    await expect(page.getByText(/자동으로 도는 5가지 작업/)).toBeVisible()
    await expect(page.getByText('상담사 등급 자동 재계산')).toBeVisible()

    // 수신자 목록 카드
    await expect(page.getByText('수신자 목록')).toBeVisible()

    // + 추가 버튼 존재
    const addBtn = page.getByRole('button', { name: /\+ 추가/ })
    await expect(addBtn).toBeVisible()

    // 추가 클릭 → 행 1개 늘어남
    const phoneInputs = page.locator('input[placeholder*="01012345678"]')
    const before = await phoneInputs.count()
    await addBtn.click()
    await page.waitForTimeout(300)
    const after = await phoneInputs.count()
    expect(after, '추가 버튼 클릭해도 행 안 늘어남').toBeGreaterThan(before)

    // 페이지 새로고침 — 저장 안 했으므로 추가한 빈 행은 사라져야 함
    await page.reload()
    await page.getByRole('button', { name: '운영알림' }).click()
    await page.waitForTimeout(500)
    const afterReload = await page.locator('input[placeholder*="01012345678"]').count()
    expect(afterReload, '저장 안 했는데 행이 남음 (이상)').toBe(before)

    expect(consoleErrors, `JS 에러: ${consoleErrors.join(' / ')}`).toHaveLength(0)
  })

  test('기본환경설정 페이지 — 글자가 너무 작지 않은지 (text-xs 거의 없음)', async ({ page }) => {
    await login(page)
    await page.goto('/mng/settings')
    await page.waitForLoadState('networkidle')

    // 안내 박스 안의 텍스트가 text-xs (12px 미만) 가 아닌지 — 가독성 검증
    // 운영알림 탭으로 이동 후 본문 폰트 크기 측정
    await page.getByRole('button', { name: '운영알림' }).click()
    await page.waitForTimeout(300)

    // 안내 박스 본문 폰트 크기
    const guideBoxText = page.getByText(/자동으로 도는 5개 작업/).first()
    const fontSize = await guideBoxText.evaluate((el) => {
      return parseFloat(getComputedStyle(el).fontSize)
    })
    expect(fontSize, `안내 박스 글자 너무 작음: ${fontSize}px`).toBeGreaterThanOrEqual(14)
  })
})
