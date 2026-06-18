import { test, expect } from '@playwright/test'

/**
 * [2026-06-12 · 4순위 D-4] 관리자 포인트 수동조정 멱등 가드.
 *
 * 같은 관리자가 같은 회원에 같은 사유·금액으로 10초 내 중복 조정 시 두 번째는 무시되어야
 * (더블서밋/재전송 이중 적립·차감 방지). 더미 계정(dummy_01) free 코인 +1 을 두 번 쏘고,
 * 두 번째가 duplicated=true 로 무시되는지 확인. 마지막에 -1 로 원복(net-zero, 테스트 계정).
 */

test.describe('관리자 포인트 조정 멱등', () => {
  test('동일 조정 더블서밋 → 두 번째 무시(이중적립 방지)', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'https://api.sajuplan.com' })
    const login = await ctx.post('/api/admin/auth/login', {
      data: { mb_id: 'admin_e2e', password: '1234!' },
    })
    expect(login.ok(), '일반관리자 로그인').toBeTruthy()

    const reason = `E2E멱등검증_${Date.now()}`
    const body = { mbId: 'dummy_01', point: 1, reason, kind: 'free' }
    let appliedOnce = false

    try {
      const r1 = await ctx.post('/api/admin/points/adjust-by-mb-id', { data: body })
      expect(r1.ok(), '1차 조정 성공').toBeTruthy()
      const j1 = await r1.json()
      expect(j1.duplicated ?? false, '1차는 정상 적용(중복 아님)').toBeFalsy()
      appliedOnce = true

      const r2 = await ctx.post('/api/admin/points/adjust-by-mb-id', { data: body })
      expect(r2.ok(), '2차 요청 처리(200)').toBeTruthy()
      const j2 = await r2.json()
      expect(j2.duplicated, '2차 동일 조정은 멱등 무시(duplicated=true) 여야').toBe(true)
    } finally {
      // 원복 — 1차로 +1 된 것을 -1 (사유 다르므로 멱등 매칭 안 됨). net-zero.
      if (appliedOnce) {
        await ctx.post('/api/admin/points/adjust-by-mb-id', {
          data: { mbId: 'dummy_01', point: -1, reason: reason + '_원복', kind: 'free' },
        }).catch(() => undefined)
      }
      await ctx.dispose()
    }
  })
})
