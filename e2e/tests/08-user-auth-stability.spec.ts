import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

/**
 * [2026-05-25] 인증 안정성 회귀 방지.
 *
 * 사장님 신고 패턴:
 *  - "코인충전 누르면 로그아웃 됨" (1차)
 *  - "로그인 첫 시도 안 되고 두 번째에 됨" (2차)
 *  - "마이 → 코인충전 시 또 튕김" (3차, 재발)
 *
 * Fix (auth-context.tsx):
 *  - 네트워크 일시 에러는 세션 유지 (setMember(null) 안 함)
 *  - 401 도 1회 재시도 — 일시 race 회피
 *  - login API 응답의 r.member 를 setSession() 으로 직접 주입 (me() race 회피)
 *
 * 이 spec 은 비로그인 기준 가능한 부분만:
 *  - 로그인 페이지 폼 동작
 *  - 비로그인이 보호 페이지 진입 시 정확히 한 번에 /login 도달
 *  - 라우트 빠른 전환 시 콘솔 에러 없음
 */

test.describe('인증 안정성', () => {
  test('비로그인 라우트 빠르게 전환 — 콘솔 에러 없음 (me() race 회귀)', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // 401 은 비로그인이라 정상 — 무시
        if (/401|403|Failed to load resource/.test(text)) return
        consoleErrors.push(`console.error: ${text}`)
      }
    })

    // 라우트 빠른 전환 — 라우트 변경 마다 me() 자동 호출 → 일시 401 발생 가능
    // fix 가 제대로면 콘솔에 unhandled error 없어야 함
    await page.goto('/')
    await page.goto('/counselors')
    await page.goto('/login')
    await page.goto('/signup')
    await page.goto('/')
    await page.waitForTimeout(500) // 마지막 me() 호출 완료 대기

    expect(consoleErrors, `JS 에러: ${consoleErrors.join(' / ')}`).toHaveLength(0)
  })

  test('로그인 페이지 폼 요소 정상 렌더', async ({ page }) => {
    await page.goto('/login')

    // 아이디/비번 인풋 존재
    const idInput = page.locator('input').first()
    await expect(idInput).toBeVisible()

    // 로그인 버튼 존재
    const loginBtn = page.getByRole('button', { name: /로그인|확인/ }).first()
    await expect(loginBtn).toBeVisible()
  })

  // [2026-05-25 B-001 분석] /mypage 는 의도적으로 비로그인 환영 페이지를 노출 (MyPageEntry → MyPage).
  //   즉 /login redirect 아님 — 정상 동작. 옛 spec 08 의 기대가 잘못됐던 것.
  //   실제 보호 페이지(/mypage/charge, /counselor/mypage)는 가드 정상 — Navigate to /login.
  test('보호 페이지 진입 → /login 가드 (단 한 번에 도달)', async ({ page }) => {
    // /mypage 는 환영 페이지로 fallback 이라 가드 대상 X. 진짜 보호 페이지만:
    const protectedPaths = ['/mypage/charge', '/counselor/mypage']

    for (const path of protectedPaths) {
      await page.goto(path)
      try {
        await page.waitForURL(/\/login/, { timeout: 15_000 })
      } catch (e) {
        const current = new URL(page.url()).pathname
        throw new Error(`보호 페이지 ${path} 진입 후 /login 도달 실패 (현재 URL=${current})`)
      }
      expect(new URL(page.url()).pathname).toBe('/login')
    }
  })
})
