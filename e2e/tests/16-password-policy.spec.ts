import { test, expect, request } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

/**
 * [2026-05-25] 비밀번호 정책 회귀 방지.
 *
 * 정책 (2026-05-25 강화):
 *   - 가입 시: 8~20자 + 영문/숫자 각 1개 이상
 *   - 변경 시: 동일 (auth.service.ts changePassword 검증)
 *
 * 검증 방식 — API 직접 호출 (가입 endpoint):
 *   1. 너무 짧음 (3자리) → 400
 *   2. 영문만 (8자리 영문) → 400
 *   3. 숫자만 (8자리 숫자) → 400
 *   4. 적합한 비번 (영문+숫자 8자리) → API 응답이 400 외 (실제 가입까진 X — 다른 필드 미충족으로 400 가능하지만 password 정책 위반 메시지는 안 나와야)
 *
 * TARGET=prod 면 실제 가입 부작용 위험 → skip.
 */

const API_BASE: Record<string, string> = {
  test: 'https://api.sajumoon.kr',
  prod: 'https://api.sajuplan.com',
}
const TARGET = process.env.TARGET ?? 'prod'
const BASE = API_BASE[TARGET] ?? API_BASE.test

// 가입 페이로드 — password 만 변경하면서 검증.
// 다른 필드는 형식 유효해야 password 정책 단독 검증 가능 (다만 mb_id 중복 등으로 fail 나도 OK,
// 우리는 password 정책 위반 메시지가 응답에 포함되는지만 본다.)
function payload(password: string) {
  return {
    name: 'E2E PW Test',
    nickname: 'e2epwtest',
    agree_terms: true,
    agree_privacy: true,
    mb_id: `e2e_pw_check_${Date.now()}`,
    password,
    phone: '01000000000',
  }
}

test.describe(`비밀번호 정책 (${TARGET})`, () => {
  // TEST 서버 폐기(2026-05-29) → prod 단일. 비번 정책 검증은 유효하지 않은 비번 → 400만 보므로 안전.
  // test 4는 유효 비번이지만 phone=01000000000 으로 다른 이유로 실패 → 계정 생성 X.


  test('너무 짧음 (3자리) → 400 + 정책 메시지', async () => {
    const ctx = await request.newContext()
    const resp = await ctx.post(`${BASE}/api/user/auth/signup`, {
      data: payload('abc'),
      headers: { 'Content-Type': 'application/json' },
      timeout: 10_000,
    })
    expect(resp.status(), '3자리 비번이 200 응답 (정책 미적용 의심)').toBe(400)
    const body = await resp.json().catch(() => null)
    const msg = JSON.stringify(body)
    expect(msg, '에러 메시지에 길이 정책 단서 없음').toMatch(/8|길이|자/)
    await ctx.dispose()
  })

  test('영문만 (8자리) → 400 + 혼합 정책 메시지', async () => {
    const ctx = await request.newContext()
    const resp = await ctx.post(`${BASE}/api/user/auth/signup`, {
      data: payload('abcdefgh'),
      headers: { 'Content-Type': 'application/json' },
      timeout: 10_000,
    })
    expect(resp.status()).toBe(400)
    const body = await resp.json().catch(() => null)
    const msg = JSON.stringify(body)
    expect(msg, '영문/숫자 혼합 강제 메시지 없음').toMatch(/영문|숫자|혼합|포함/)
    await ctx.dispose()
  })

  test('숫자만 (8자리) → 400 + 혼합 정책 메시지', async () => {
    const ctx = await request.newContext()
    const resp = await ctx.post(`${BASE}/api/user/auth/signup`, {
      data: payload('12345678'),
      headers: { 'Content-Type': 'application/json' },
      timeout: 10_000,
    })
    expect(resp.status()).toBe(400)
    const body = await resp.json().catch(() => null)
    const msg = JSON.stringify(body)
    expect(msg, '영문/숫자 혼합 강제 메시지 없음').toMatch(/영문|숫자|혼합|포함/)
    await ctx.dispose()
  })

  test('적합 (영문+숫자 8자리) → 정책 위반 메시지 X (다른 필드 fail 은 OK)', async () => {
    const ctx = await request.newContext()
    const resp = await ctx.post(`${BASE}/api/user/auth/signup`, {
      data: payload('abc12345'),
      headers: { 'Content-Type': 'application/json' },
      timeout: 10_000,
    })
    // 응답 상태는 200 또는 400 (휴대폰 인증 미통과 등 다른 사유로 400 가능).
    // 핵심: 응답에 비번 정책 위반 단서가 없어야 함.
    const body = await resp.json().catch(() => null)
    const msg = JSON.stringify(body ?? {})
    expect(
      msg,
      `적합한 비번인데도 정책 메시지 노출됨: ${msg.slice(0, 200)}`,
    ).not.toMatch(/비밀번호는 8|영문과 숫자를/)
    await ctx.dispose()
  })
})
