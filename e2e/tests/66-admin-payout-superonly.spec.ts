import { test, expect } from '@playwright/test'

/**
 * [2026-06-12 · 4순위 D-1 권한 경계] 선지급 정책키 슈퍼 전용 검증.
 *
 * 일반관리자(admin_e2e, is_super=false)가 payout 정책키(available_ratio 등)를 변경하려 하면
 * SUPER_ONLY_SETTING_KEYS 에 막혀 403 이어야 한다. (값이 실제로 바뀔 때만 거부되므로 현재와 다른 값 전송)
 * 거부는 UPSERT 전에 throw → 트랜잭션 롤백 → prod 데이터 변경 0 (안전).
 */

test.describe('관리자 권한 경계 — 선지급 정책키 슈퍼 전용', () => {
  test('일반관리자는 payout.available_ratio 변경 불가 (403)', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'https://api.sajuplan.com' })
    const login = await ctx.post('/api/admin/auth/login', {
      data: { mb_id: 'admin_e2e', password: '1234!' },
    })
    expect(login.ok(), '일반관리자 로그인').toBeTruthy()

    // 현재와 다른 값 전송 → 슈퍼 전용이라 거부(403). 거부 시 write 안 됨.
    const res = await ctx.patch('/api/admin/settings', {
      data: { payout: { available_ratio: '0.999' } },
    })
    expect(res.status(), `일반관리자 payout 정책 변경은 403 (실제 ${res.status()})`).toBe(403)

    await ctx.dispose()
  })

  test('일반관리자는 payout.max_per_day_per_counselor(사기방지) 변경 불가 (403)', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'https://api.sajuplan.com' })
    const login = await ctx.post('/api/admin/auth/login', {
      data: { mb_id: 'admin_e2e', password: '1234!' },
    })
    expect(login.ok()).toBeTruthy()
    // 기본 1 과 확실히 다른 값(999) → 슈퍼 전용이라 거부, write 없음
    const res = await ctx.patch('/api/admin/settings', {
      data: { payout: { max_per_day_per_counselor: '999' } },
    })
    expect(res.status(), `일일한도 변경은 403 (실제 ${res.status()})`).toBe(403)
    await ctx.dispose()
  })
})
