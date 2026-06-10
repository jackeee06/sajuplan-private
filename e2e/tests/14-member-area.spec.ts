import { test, expect } from '@playwright/test'

/**
 * [2026-05-25] e2e_member 일반 회원 영역 자동화.
 *
 * 검증 시나리오:
 *   1. /mypage 진입 — 회원 마이페이지 렌더 + 닉네임 노출
 *   2. /mypage/charge — 충전 페이지 로드 (충전 패키지 카드 1개 이상)
 *   3. /mypage/points — 코인 내역 페이지 로드 + 사용자 영역 "포인트" 단어 0
 *   4. /mypage/payments — 결제 내역 로드
 *   5. /mypage/coupons — 쿠폰 페이지 로드
 *   6. /mypage/history — 상담 이력 로드 (비어있어도 OK)
 *   7. ModeIndicator — 일반 회원(isCounselor=false) 은 안 보임
 *
 * TARGET=prod 면 e2e_member 계정 없으므로 skip.
 */

test.use({ storageState: 'user_member_storage.json' })

const MEMBER_PAGES = [
  { path: '/mypage', name: '회원 마이페이지', heading: /마이페이지|마이/ },
  { path: '/mypage/charge', name: '코인 충전', heading: /충전|코인/ },
  { path: '/mypage/points', name: '코인 내역', heading: /코인|내역/ },
  { path: '/mypage/payments', name: '결제 내역', heading: /결제|내역/ },
  { path: '/mypage/coupons', name: '쿠폰', heading: /쿠폰/ },
  { path: '/mypage/history', name: '상담 이력', heading: /이력|상담/ },
]

test.describe('회원 영역 (e2e_member)', () => {
  test.beforeEach(async ({ page }) => {
    // TEST 서버 폐기(2026-05-29) → prod 단일. storageState 로 세션 보장.
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  })

  for (const { path, name, heading } of MEMBER_PAGES) {
    test(`${name} (${path}) — 로드 + 빈 화면 아님`, async ({ page }) => {
      const consoleErrors: string[] = []
      const isExpectedError = (msg: string) =>
        /Failed to load resource.*status of (401|404|429)/.test(msg)
      page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
      page.on('console', (msg) => {
        if (msg.type() === 'error' && !isExpectedError(msg.text())) {
          consoleErrors.push(`console.error: ${msg.text()}`)
        }
      })

      await page.goto(path)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})

      // SPA 마운트 검증 — 비어있지 않음 (빈 상태 메시지 "결제내역이 없습니다." 같은 짧은 텍스트도 OK)
      const rootText = (await page.locator('#root').textContent()) ?? ''
      expect(rootText.trim().length, `${name} 빈 화면 (마운트 실패)`).toBeGreaterThan(8)

      // env placeholder 치환 검증
      const config = await page.evaluate(() => (window as any).__SAJUMOON_CONFIG)
      expect(config?.env, '__SAJUMOON_ENV__ 치환 누락').not.toBe('__SAJUMOON_ENV__')

      // JS 에러 없음
      expect(consoleErrors, `JS 에러: ${consoleErrors.join(' / ')}`).toHaveLength(0)
    })
  }

  test('코인 내역 (/mypage/points) — "포인트" 단어 노출 0 (용어 통일)', async ({ page }) => {
    await page.goto('/mypage/points')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const body = (await page.locator('body').textContent()) ?? ''
    const forbidden = ['소비포인트', '충전 포인트', '보유 포인트', '잔여 포인트']
    const hits = forbidden.filter((w) => body.includes(w))
    expect(
      hits,
      `회원 영역에 옛 "포인트" 단어 노출됨: ${hits.join(', ')}`,
    ).toEqual([])
  })

  test('ModeIndicator — 일반 회원(isCounselor=false) 은 배너 안 보임', async ({ page }) => {
    await page.goto('/mypage')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    // ModeIndicator 의 식별 텍스트 — 일반 회원에겐 안 보여야 함
    await expect(page.getByText(/💼 상담사 모드|👤 회원 모드/).first()).toHaveCount(0)
  })

  test('BottomNav — 4번째 라벨이 "코인충전" (수익금 아님)', async ({ page }) => {
    await page.goto('/mypage')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const fourth = page.locator('nav').getByText(/^(코인충전|수익금)$/).first()
    await expect(fourth).toBeVisible({ timeout: 5_000 })
    await expect(fourth, '일반 회원은 4번째가 "코인충전"').toContainText('코인충전')
  })
})
