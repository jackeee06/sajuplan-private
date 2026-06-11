import { test, expect, request } from '@playwright/test'

/**
 * [2026-06-11 운영 직전 정밀점검 · 축2 D] 관리자 돈/권한 라우트 — 적대적 접근 차단 검증.
 *
 * AdminAuthGuard 가 비인증·비관리자(회원 토큰)를 모두 거부하는지 확인.
 * 전부 "차단" 기대 → mutation 0 (prod 안전). 유효 admin 세션이 필요 없는 차단 테스트만.
 *   - 비로그인 → 401
 *   - 회원(user 토큰) → 401 (admin guard: payload.role !== 'admin')
 *
 * 대상 라우트(돈 직결): 포인트 수동조정 / 정산 지급완료·무효화·즉시정산.
 * admin-auth.guard.ts 는 2026-06-11 JWT sub Number() 정규화 적용(향후 소유비교 버그 차단).
 */

const API = 'https://api.sajuplan.com'

// (메서드, 경로, 바디) — 모두 AdminAuthGuard 보호
const ADMIN_MONEY_ROUTES: [('post' | 'patch'), string, object?][] = [
  ['post', '/api/admin/members/customers/1/point-adjust', { delta: 999999, side: 'free', reason: 'hack' }],
  ['post', '/api/admin/points/adjust-by-mb-id', { mb_id: 'dummy_01', delta: 999999, side: 'free', reason: 'hack' }],
  ['patch', '/api/admin/settlements/1/mark-paid'],
  ['patch', '/api/admin/settlements/1/mark-voided', { reason: '우회시도테스트' }],
  ['post', '/api/admin/settlements/1/settle-now'],
]

async function call(ctx: import('@playwright/test').APIRequestContext, m: 'post' | 'patch', path: string, body?: object) {
  const url = `${API}${path}`
  return m === 'post' ? ctx.post(url, { data: body ?? {} }) : ctx.patch(url, { data: body ?? {} })
}

test.describe('D 적대적 — 비로그인은 관리자 돈 라우트 전부 거부 (401)', () => {
  for (const [m, path, body] of ADMIN_MONEY_ROUTES) {
    test(`비로그인 ${m.toUpperCase()} ${path} → 401`, async () => {
      const ctx = await request.newContext({ storageState: { cookies: [], origins: [] } })
      const r = await call(ctx, m, path, body)
      console.log(`[noauth ${path}]`, r.status())
      expect(r.status(), '비인증 관리자 라우트 접근 — 막혀야').toBe(401)
      await ctx.dispose()
    })
  }
})

test.describe('D 적대적 — 회원 토큰으로 관리자 돈 라우트 차단 (401)', () => {
  test.use({ storageState: 'user_member_storage.json' })

  for (const [m, path, body] of ADMIN_MONEY_ROUTES) {
    test(`회원토큰 ${m.toUpperCase()} ${path} → 401`, async ({ page }) => {
      const r = await call(page.request, m, path, body)
      console.log(`[member ${path}]`, r.status(), (await r.text()).slice(0, 100))
      expect(r.status(), '회원 토큰으로 관리자 라우트 접근 — 막혀야').toBe(401)
    })
  }
})

test.describe('D 적대적 — 상담사 토큰으로 관리자 돈 라우트 차단 (401)', () => {
  test.use({ storageState: 'user_counselor_storage.json' })

  test('상담사토큰 정산 지급완료 마킹 → 401', async ({ page }) => {
    const r = await page.request.patch(`${API}/api/admin/settlements/1/mark-paid`)
    console.log('[counselor mark-paid]', r.status())
    expect(r.status()).toBe(401)
  })

  test('상담사토큰 포인트 조정 → 401', async ({ page }) => {
    const r = await page.request.post(`${API}/api/admin/points/adjust-by-mb-id`, {
      data: { mb_id: 'dummy_01', delta: 999999, side: 'free', reason: 'hack' },
    })
    console.log('[counselor point-adjust]', r.status())
    expect(r.status()).toBe(401)
  })
})
