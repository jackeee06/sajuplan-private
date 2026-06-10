import { test, expect, request } from '@playwright/test'

/**
 * [2026-06-11 운영 직전 정밀점검 · 축2 B-1] 가입/로그인/비번찾기 — 적대적 엣지케이스.
 *
 * "깨뜨리려" 찌른다. 모두 차단/에러 응답을 기대 (실제 계정 생성·인증 우회 없음 → DB 안전).
 *   - check-mb-id: 길이·문자·소셜형식·중복 다층 검증
 *   - 가입: 중복 ID 차단 / SMS 미인증 차단(보안 핵심)
 *   - 로그인: 틀린 비번·없는 ID → 4xx (5xx 아님)
 *   - 비번찾기: 인증번호 없이/틀린 인증번호/미인증 reset → 차단
 */

const API = 'https://api.sajuplan.com'
test.use({ storageState: { cookies: [], origins: [] } })

function signupPayload(over: Record<string, unknown> = {}) {
  return {
    name: 'E2E Edge', nickname: 'e2eedge',
    agree_terms: true, agree_privacy: true,
    mb_id: `e2e_e${Date.now() % 10_000_000}`, password: 'edge1234',
    phone: '01000000000', ...over,
  }
}

test.describe.configure({ retries: 0 })

test.describe('B-1 적대적 엣지 — 가입/로그인/비번찾기', () => {
  test('check-mb-id — 검증 규칙 전수 (중복/길이/문자/소셜형식)', async () => {
    const ctx = await request.newContext()
    const get = (id: string) => ctx.get(`${API}/api/user/auth/check-mb-id?mb_id=${encodeURIComponent(id)}`)

    const dup = await get('e2e_member'); const dupB = await dup.json().catch(() => null)
    console.log('[dup]', dup.status(), JSON.stringify(dupB))
    expect(dup.ok(), '기존 ID 조회는 200').toBeTruthy()

    const fresh = await get(`e2e_f${Date.now() % 10_000_000}`); const freshB = await fresh.json().catch(() => null)
    console.log('[fresh]', fresh.status(), JSON.stringify(freshB))
    expect(fresh.ok()).toBeTruthy()
    expect(JSON.stringify(dupB), '기존/신규 응답 동일 = 중복검사 무력').not.toBe(JSON.stringify(freshB))

    expect((await get('ab')).status(), '2자 ID 통과하면 안 됨').toBe(400)
    expect((await get('ab!@cd')).status(), '특수문자 ID 통과하면 안 됨').toBe(400)
    expect((await get('hacker_K')).status(), '소셜형식(_K) ID 통과하면 안 됨').toBe(400)
    await ctx.dispose()
  })

  test('중복 ID 가입 → 차단', async () => {
    const ctx = await request.newContext()
    const r = await ctx.post(`${API}/api/user/auth/signup`, { data: signupPayload({ mb_id: 'e2e_member' }) })
    console.log('[dup signup]', r.status(), (await r.text()).slice(0, 200))
    expect(r.status(), '중복 ID 가입이 성공하면 안 됨').toBeGreaterThanOrEqual(400)
    await ctx.dispose()
  })

  test('SMS 미인증 가입 → 차단 (보안 핵심)', async () => {
    const ctx = await request.newContext()
    const r = await ctx.post(`${API}/api/user/auth/signup`, { data: signupPayload() })
    console.log('[unverified signup]', r.status(), (await r.text()).slice(0, 200))
    expect(r.status(), 'SMS 인증 없이 가입 성공 = 보안 구멍').toBeGreaterThanOrEqual(400)
    await ctx.dispose()
  })

  test('로그인 틀린 비번 → 4xx', async () => {
    const ctx = await request.newContext()
    const r = await ctx.post(`${API}/api/user/auth/login`, { data: { mb_id: 'e2e_member', password: 'definitely_wrong_99' } })
    console.log('[wrong pw]', r.status(), (await r.text()).slice(0, 200))
    expect([400, 401, 403]).toContain(r.status())
    await ctx.dispose()
  })

  test('로그인 없는 ID → 4xx (5xx 아님)', async () => {
    const ctx = await request.newContext()
    const r = await ctx.post(`${API}/api/user/auth/login`, { data: { mb_id: `nobody_${Date.now()}`, password: 'whatever1' } })
    console.log('[nobody]', r.status(), (await r.text()).slice(0, 200))
    expect(r.status()).toBeGreaterThanOrEqual(400)
    expect(r.status(), '없는 계정 로그인이 5xx 면 안 됨').toBeLessThan(500)
    await ctx.dispose()
  })

  test('비번찾기(find/phone) 인증번호 없이 → 400', async () => {
    const ctx = await request.newContext()
    const r = await ctx.post(`${API}/api/user/auth/find/phone`, { data: { phone: '01012345678' } })
    console.log('[find no-code]', r.status(), (await r.text()).slice(0, 200))
    expect(r.status()).toBe(400)
    await ctx.dispose()
  })

  test('비번찾기(find/phone) 틀린 인증번호 → 4xx (인증 우회 X)', async () => {
    const ctx = await request.newContext()
    const r = await ctx.post(`${API}/api/user/auth/find/phone`, { data: { phone: '01012345678', code: '000000' } })
    console.log('[find wrong-code]', r.status(), (await r.text()).slice(0, 200))
    expect(r.status()).toBeGreaterThanOrEqual(400)
    expect(r.status()).toBeLessThan(500)
    await ctx.dispose()
  })

  test('비번재설정(reset) 미인증 phone → 400 (우회 차단)', async () => {
    const ctx = await request.newContext()
    const r = await ctx.post(`${API}/api/user/auth/find/phone/reset`, { data: { phone: '01099998888', new_password: 'newpass123' } })
    console.log('[reset unverified]', r.status(), (await r.text()).slice(0, 200))
    expect(r.status()).toBe(400)
    await ctx.dispose()
  })
})
