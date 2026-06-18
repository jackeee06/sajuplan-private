import { test, expect } from '@playwright/test'

/**
 * [2026-06-12] 상담사 승인 트랜잭션 보강 검증 (동시승인 직렬화 + FOR UPDATE).
 *
 * 실제 승인은 회원/상담사를 생성하므로 prod 에서 실행 불가.
 * 대신 "존재하지 않는 신청 승인" → 새 tx(advisory lock + post_apply FOR UPDATE) 경로가
 * 깨지지 않고 NotFound(404) 를 반환하는지로 코드 정상 실행을 확인한다.
 * (tx/락/FOR UPDATE 에 문법·로직 오류가 있으면 500 이 떴을 것)
 */

test.describe('상담사 승인 트랜잭션 보강', () => {
  test('존재하지 않는 신청 승인 → tx 경로 정상(404, 500 아님)', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'https://api.sajuplan.com' })
    const login = await ctx.post('/api/admin/auth/login', {
      data: { mb_id: 'admin_e2e', password: '1234!' },
    })
    expect(login.ok(), '관리자 로그인').toBeTruthy()

    const res = await ctx.post('/api/admin/counselor-apply/99999999/approve')
    expect(res.status(), `없는 신청 승인은 404 (실제 ${res.status()}). 500 이면 tx/락 경로 결함`).toBe(404)

    await ctx.dispose()
  })
})
