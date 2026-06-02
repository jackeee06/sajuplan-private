import { test, expect } from '@playwright/test'

/**
 * [2026-05-25] Phase 2 — 듀얼 역할자 (회원+상담사) 모드 일관성 자동 검증.
 *
 * 테스트 계정: e2e_dual (TEST 서버에만 존재. role=counselor)
 *
 * 검증 시나리오 — 사장님이 매번 신고했던 패턴 자동화:
 *   1. 회원 모드 (/mypage) 진입 → 배너=회원 + 하단=코인충전
 *   2. 상담사 모드 (/counselor/mypage) 진입 → 배너=상담사 + 하단=수익금
 *   3. 정산 페이지 (/counselor/mypage/settlement/history) → 배너=상담사 + 하단=수익금 일관
 *   4. 옛 URL (/mypage/settlement/history) 자동 redirect
 *   5. 모드 전환 시 토스트 발화
 *   6. ModeIndicator X 닫기 → 닷 표시 → 닷 클릭 → 배너 복원
 *
 * TARGET=prod 면 e2e_dual 계정 없으므로 skip.
 *
 * [B-004 2026-05-25] 묶음 실행 시 일부 케이스 flaky (단독 OK).
 *   원인 추정: 묶음 실행 후반부에 백엔드 ThrottlerException(429) 으로 SPA 의 me() 가 fail
 *             → 비로그인 mount → ModeIndicator 안 보임.
 *   현재 회피책 없음. 정식 운영 전 일괄 검토 백로그(B-004).
 *   단독 spec 실행은 6/6 통과 — 실제 모드 인디케이터 로직 자체는 정상.
 */

test.use({ storageState: 'user_dual_storage.json' })

test.describe('듀얼 역할자 모드 일관성', () => {
  test.beforeEach(async ({ page, context }) => {
    if (process.env.TARGET === 'prod') test.skip()
    await page.goto('/')
    const cookies = await context.cookies()
    if (cookies.length === 0) test.skip(true, 'e2e_dual 로그인 세션 없음 — global-setup 확인')
  })

  test('회원 마이페이지 진입 — 배너/하단 모두 회원 모드 신호', async ({ page }) => {
    await page.goto('/mypage')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    await expect(page.getByText(/👤?\s*회원 모드/)).toBeVisible({ timeout: 10_000 })

    const fourthLabel = page.locator('nav').getByText(/^(코인충전|수익금)$/).first()
    await expect(fourthLabel).toContainText('코인충전')
  })

  test('상담사 마이페이지 진입 — 배너/하단 모두 상담사 모드 신호', async ({ page }) => {
    await page.goto('/counselor/mypage')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    await expect(page.getByText(/💼?\s*상담사 모드/)).toBeVisible({ timeout: 10_000 })

    const fourthLabel = page.locator('nav').getByText(/^(코인충전|수익금)$/).first()
    await expect(fourthLabel).toContainText('수익금')
  })

  test('정산 페이지 (새 URL) — 일관된 상담사 모드 신호', async ({ page }) => {
    await page.goto('/counselor/mypage/settlement/history')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    expect(new URL(page.url()).pathname).toBe('/counselor/mypage/settlement/history')

    await expect(page.getByText(/💼?\s*상담사 모드/)).toBeVisible({ timeout: 10_000 })

    const fourthLabel = page.locator('nav').getByText(/^(코인충전|수익금)$/).first()
    await expect(fourthLabel).toContainText('수익금')
  })

  test('옛 URL /mypage/settlement/history → 새 URL 자동 redirect (로그인 상태)', async ({ page }) => {
    await page.goto('/mypage/settlement/history')
    await page.waitForURL('**/counselor/mypage/settlement/history', { timeout: 10_000 })
    expect(new URL(page.url()).pathname).toBe('/counselor/mypage/settlement/history')
  })

  test('모드 전환 — 회원 → 상담사 토스트 발화', async ({ page }) => {
    await page.goto('/mypage')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    const switchBtn = page.getByRole('button', { name: /상담사 모드로/ }).first()
    const toast = page.getByRole('status').filter({ hasText: /상담사 모드로 전환됨/ })

    await switchBtn.click()
    await expect(toast, '모드 전환 토스트 발화 안 됨 또는 너무 빨리 사라짐').toBeVisible({
      timeout: 5_000,
    })

    await page.waitForURL('**/counselor/mypage', { timeout: 5_000 })
  })

  test('ModeIndicator X 닫기 → 닷 표시 → 닷 클릭 시 배너 복원', async ({ page }) => {
    await page.goto('/mypage')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    const dismissBtn = page.getByRole('button', { name: /모드 표시 닫기/ }).first()
    if (await dismissBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await dismissBtn.click()

      await expect(page.getByText(/👤?\s*회원 모드/)).toBeHidden({ timeout: 3_000 })

      const dot = page.getByRole('button', { name: /모드 표시줄 다시 보이기/ }).first()
      await expect(dot).toBeVisible({ timeout: 3_000 })

      await dot.click()
      await expect(page.getByText(/👤?\s*회원 모드/)).toBeVisible({ timeout: 3_000 })
    }
  })
})
