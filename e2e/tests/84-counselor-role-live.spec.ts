import { test, expect, request } from '@playwright/test'

/**
 * 상담사 권한 — DB live role 기준 (토큰 role 고정 14일 버그 근본수정).
 *
 * 배경: 토큰 role 은 발급 시점 값으로 14일 고정 → 회원→상담사 승격 후 재로그인 전까지
 *       토큰 role='user' 로 남아 계좌/등급/문의/후기 저장이 403 으로 막혔다.
 *       UserAuthGuard 가 매 요청 DB live role 로 갱신하도록 수정.
 *
 * 여기서는 정상 role-gating 회귀를 지킨다(가드 수정이 권한을 깨지 않음 확인):
 *   - 회원(role=user) 계정 → 상담사 전용 API 는 403
 *   - 상담사(role=counselor) 계정 → 200
 * (stale 토큰 자체의 통과는 서버 시크릿이 필요한 위조 토큰 테스트로 별도 1회 검증함 — 커밋 X)
 */

const API = 'https://api.sajuplan.com'
const COUNSELOR_ONLY = `${API}/api/user/counselor-mypage/payout/available`

test('회원 계정 → 상담사 전용 API 는 403 (권한 유지)', async () => {
  const ctx = await request.newContext({ storageState: 'user_member_storage.json' })
  const r = await ctx.get(COUNSELOR_ONLY)
  expect(r.status()).toBe(403)
  console.log('[OK] 회원 계정 차단 403')
  await ctx.dispose()
})

test('상담사 계정 → 상담사 전용 API 는 200 (정상 접근)', async () => {
  const ctx = await request.newContext({ storageState: 'user_dual_storage.json' })
  const r = await ctx.get(COUNSELOR_ONLY)
  expect(r.status()).toBe(200)
  const data = await r.json() as { fee_rate?: number; min_amount?: number }
  // 응답 구조 살아있는지 가볍게 확인
  expect(data).toBeTruthy()
  console.log('[OK] 상담사 계정 접근 200')
  await ctx.dispose()
})
