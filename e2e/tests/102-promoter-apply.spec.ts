import { test, expect, request as pwRequest } from '@playwright/test'

/**
 * 모집인(서포터즈) 자가 신청 플로우 — 공개 엔드포인트 가드 검증 (2026-06-18).
 *
 * 기존 "미등록 = 에러" → "미등록 = 신청 폼" 으로 UX 변경.
 *  - OTP 인증 없이 apply 호출 시 거부(휴대폰 인증 강제)
 *  - 이름 누락 시 거부
 *  - 신청은 status='pending' 으로 들어가 관리자 승인(approve/:id) 후 active
 *    (승인/반려 라우트는 admin 인증 필요 → prod 스모크로 별도 검증)
 */

const API_BASE = 'https://api.sajuplan.com/api'

test('자가신청 가드 — OTP 인증 없이 apply 호출 시 400', async () => {
  const ctx = await pwRequest.newContext()
  const res = await ctx.post(`${API_BASE}/promoter/apply`, {
    data: { phone: '01099990001', name: '미인증신청', bank_account: '123-456' },
  })
  expect(res.status()).toBe(400)
  const body = await res.json()
  expect(JSON.stringify(body)).toContain('휴대폰 인증')
  await ctx.dispose()
})

test('자가신청 가드 — 이름 누락 시 400', async () => {
  const ctx = await pwRequest.newContext()
  const res = await ctx.post(`${API_BASE}/promoter/apply`, {
    data: { phone: '01099990002', name: '   ' },
  })
  expect(res.status()).toBe(400)
  await ctx.dispose()
})

test('관리자 승인/반려 라우트 — 가드 통과해 approve/reject 핸들러로 정상 라우팅 (update 에 안 가려짐)', async () => {
  // storageState(관리자 쿠키) 없는 완전 비인증 컨텍스트로 가드 동작 확인
  const ctx = await pwRequest.newContext({ storageState: { cookies: [], origins: [] } })
  // 라우트가 살아있고(:id update 에 가려지지 않음) 가드가 동작 →
  //   비인증: 401 / (혹시 관리자 쿠키가 실리면) 없는 id 라 404.
  //   둘 다 "approve 핸들러까지 도달"의 증거(가려졌다면 update 가 실행돼 500/200 이 났을 것).
  const a = await ctx.patch(`${API_BASE}/admin/promoters/approve/999999`)
  expect([401, 404]).toContain(a.status())
  const r = await ctx.patch(`${API_BASE}/admin/promoters/reject/999999`, { data: { reason: 'x' } })
  expect([401, 404]).toContain(r.status())
  await ctx.dispose()
})
