import { test, expect } from '@playwright/test'
import { skipIfAdminLoginFailed } from '../helpers/admin-skip'

/**
 * 고객보호비용 내역 — 채팅 단기환불 합류 (2026-06-14) · 실제 손가락 동작 E2E.
 *
 * 정책: 채팅 단기환불 임계 5초→30초, 전화와 통일.
 *   회원 전액환불 / 상담사 30초치(1단위) 보존 / 회사 부담 / 고객보호비용 내역 집계.
 *
 * 운영자가 실제로 누르는 순서 그대로 (URL 직접 점프 X):
 *   1. 로그인 → 대시보드
 *   2. 사이드바 "매출현황" 버튼 클릭 → 하위 메뉴 펼침
 *   3. "⭐ 고객보호비용 내역" 메뉴 클릭 → 페이지 도달
 *   4. 제목/부제/안내(30초·채팅)/구분 컬럼 확인
 *   5. 기간 칩 "이번달" 클릭 → 표 재조회 (손가락 상호작용)
 *   6. JS 에러 0
 */

const ADMIN_ID = 'admin'
const ADMIN_PW = 'test1234!'

function isIgnorableConsoleError(text: string): boolean {
  return /Failed to load resource.*status of (401|404)/.test(text)
}

async function login(page: import('@playwright/test').Page) {
  await page.goto('/mng/dashboard')
  if (page.url().includes('/mng/login')) {
    await page.getByPlaceholder('admin').fill(ADMIN_ID)
    await page.getByPlaceholder('비밀번호를 입력하세요').fill(ADMIN_PW)
    await page.getByRole('button', { name: '로그인' }).click()
    await expect(page).not.toHaveURL(/\/mng\/login/, { timeout: 10_000 })
  }
}

test.describe('고객보호비용 내역 — 채팅 단기환불 합류 (손가락)', () => {
  test.beforeEach(skipIfAdminLoginFailed)

  test('사이드바 클릭 → 고객보호비용 내역 → 통화·채팅 통합 + 구분 컬럼 + 기간 칩', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnorableConsoleError(msg.text())) {
        consoleErrors.push(`console.error: ${msg.text()}`)
      }
    })

    await login(page)

    // 2. 사이드바 "매출현황" 버튼 클릭 → 펼침 (토글 상태 무관하게 링크 보일 때까지)
    const salesBtn = page.getByRole('button', { name: /매출현황/ })
    await expect(salesBtn).toBeVisible()
    const menuLink = page.getByRole('link', { name: /고객보호비용 내역/ })
    for (let i = 0; i < 3 && !(await menuLink.isVisible()); i++) {
      await salesBtn.click()
      await page.waitForTimeout(300)
    }

    // 3. "고객보호비용 내역" 메뉴 클릭
    await expect(menuLink).toBeVisible()
    await menuLink.click()

    // 페이지 도달 — URL + 제목
    await expect(page).toHaveURL(/\/mng\/short-call-refunds/)
    await expect(page.getByRole('heading', { name: '고객보호비용 내역' })).toBeVisible()

    // 4. 부제 + 안내(30초·채팅) + 구분 컬럼
    await expect(page.getByText(/30초 미만 단기 통화·채팅 자동 환원/)).toBeVisible()
    await expect(page.getByText(/30초 미만의 짧은 통화·채팅/)).toBeVisible()
    await expect(page.getByText(/채팅 합류\(5초→30초\): 2026-06-14/)).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '구분' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '이용시간(초)' })).toBeVisible()

    // 5. 기간 칩 "이번달" 클릭 → 표 재조회 (손가락 상호작용)
    await page.getByRole('button', { name: '이번달', exact: true }).click()
    await page.waitForLoadState('networkidle')
    // 표 헤더가 재조회 후에도 유지 (깨지지 않음)
    await expect(page.getByRole('columnheader', { name: '매몰금액' })).toBeVisible()

    // 구분 칩(통화/채팅)이 데이터 있을 때 렌더되는지 — 행이 있으면 최소 1개 통화/채팅 칩
    const rowCount = await page.locator('tbody tr').count()
    if (rowCount > 0) {
      const kindChips = page.locator('tbody').getByText(/^(통화|채팅)$/)
      expect(await kindChips.count(), '데이터 행이 있는데 구분 칩 없음').toBeGreaterThan(0)
    }

    // 결과 스크린샷 (완료 보고 첨부용)
    await page.screenshot({ path: 'test-results/_shot_protection_cost.png', fullPage: true })

    // 6. JS 에러 0
    expect(consoleErrors, `JS 에러: ${consoleErrors.join(' / ')}`).toHaveLength(0)
  })
})
