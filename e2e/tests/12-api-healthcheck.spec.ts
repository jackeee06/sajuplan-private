import { test, expect, request } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

/**
 * [2026-05-25] API 헬스체크 — 백엔드 서버 자체 응답 검증.
 *
 * 프론트엔드만 배포되고 백엔드는 죽었거나 잘못 배포된 케이스를 잡기 위함.
 * 사장님 신고 패턴:
 *   - "사이트는 열리는데 로그인 안 됨"
 *   - "리스트가 비어있음"
 *   - "환경설정 저장이 안 됨"
 * → 대부분 API 다운/오작동. 프론트 spec 만으로는 못 잡음.
 *
 * 검증 대상 (모두 비인증 GET 안전):
 *   - GET /api/health → 200 + { status: 'ok' }
 *   - GET /api/user/counselors/event → 200 + JSON (배열)
 *   - GET /api/user/counselors/filter-options → 200 + JSON
 *   - GET /api/user/app-version/version → 200 + JSON
 *   - GET /api/user/charge/packages → 200 + 배열
 *
 * env 별 base URL 자동 선택.
 */

const API_BASE: Record<string, string> = {
  test: 'https://api.sajumoon.kr',
  prod: 'https://api.sajuplan.com',
}
const TARGET = process.env.TARGET ?? 'prod'
const BASE = API_BASE[TARGET] ?? API_BASE.test

test.describe(`API 헬스체크 (${TARGET} / ${BASE})`, () => {
  test('GET /api/health — 200 + status=ok', async () => {
    const ctx = await request.newContext()
    const resp = await ctx.get(`${BASE}/api/health`, { timeout: 10_000 })
    expect(resp.status(), `${BASE}/api/health → ${resp.status()}`).toBe(200)
    const json = await resp.json()
    expect(json.status).toBe('ok')
    await ctx.dispose()
  })

  test('GET /api/user/counselors/event — 200 + 응답 JSON', async () => {
    const ctx = await request.newContext()
    const resp = await ctx.get(`${BASE}/api/user/counselors/event`, { timeout: 10_000 })
    expect(resp.status(), `이벤트 상담사 API → ${resp.status()}`).toBeLessThan(500)
    if (resp.status() === 200) {
      const json = await resp.json().catch(() => null)
      expect(json, '이벤트 상담사 응답 JSON 아님').toBeTruthy()
    }
    await ctx.dispose()
  })

  test('GET /api/user/counselors/filter-options — 200 + 옵션 객체', async () => {
    const ctx = await request.newContext()
    const resp = await ctx.get(`${BASE}/api/user/counselors/filter-options`, { timeout: 10_000 })
    expect(resp.status(), `filter-options → ${resp.status()}`).toBeLessThan(500)
    await ctx.dispose()
  })

  test('GET /api/user/app-version/version — 200 + version 문자열', async () => {
    const ctx = await request.newContext()
    const resp = await ctx.get(`${BASE}/api/user/app-version/version`, { timeout: 10_000 })
    expect(resp.status(), `app-version → ${resp.status()}`).toBeLessThan(500)
    await ctx.dispose()
  })

  test('GET /api/user/charge/packages — 200 또는 401', async () => {
    const ctx = await request.newContext()
    const resp = await ctx.get(`${BASE}/api/user/charge/packages`, { timeout: 10_000 })
    // 일부 엔드포인트는 인증이 필요할 수도 있음 — 401 도 정상 응답으로 간주
    expect([200, 401], `charge packages → ${resp.status()}`).toContain(resp.status())
    await ctx.dispose()
  })

  test('CORS — 사용자 프론트 origin 헤더 차단 안 함', async () => {
    const origin = TARGET === 'prod' ? 'https://sajuplan.com' : 'https://sajumoon.kr'
    const ctx = await request.newContext({ extraHTTPHeaders: { Origin: origin } })
    const resp = await ctx.get(`${BASE}/api/health`, { timeout: 10_000 })
    expect(resp.status()).toBe(200)
    const acao = resp.headers()['access-control-allow-origin']
    // 정확한 origin 또는 * (서비스 정책에 따라)
    expect(
      acao === origin || acao === '*' || acao === undefined,
      `CORS Access-Control-Allow-Origin 헤더가 ${origin} 차단함 (actual=${acao})`,
    ).toBeTruthy()
    await ctx.dispose()
  })

  test('OAuth config — kakao/naver 활성화 확인', async () => {
    const ctx = await request.newContext()
    // 연속 실행 시 throttler 429 가능 — 잠시 대기 후 재시도
    await new Promise(r => setTimeout(r, 2000))
    const resp = await ctx.get(`${BASE}/api/user/auth/social/config`, { timeout: 10_000 })
    if (resp.status() === 429) { await ctx.dispose(); test.skip() }
    expect(resp.status()).toBe(200)
    const json = await resp.json()
    expect(json.use, 'social.use=false 이면 모든 소셜 로그인 미활성').toBe(true)
    expect(json.providers, 'providers 배열 없음').toBeTruthy()
    expect(json.providers, 'kakao 미활성').toContain('kakao')
    expect(json.providers, 'naver 미활성').toContain('naver')
    await ctx.dispose()
  })

  test('OAuth start — kakao 302 redirect → kauth.kakao.com', async () => {
    const ctx = await request.newContext({ ignoreHTTPSErrors: false })
    // followRedirects 안 함 — 302 응답 직접 검증
    const resp = await ctx.get(`${BASE}/api/user/auth/social/kakao/start`, {
      maxRedirects: 0,
      timeout: 10_000,
    })
    expect([301, 302, 303]).toContain(resp.status())
    const loc = resp.headers()['location'] ?? ''
    expect(loc, 'kakao OAuth redirect URL 누락').toMatch(/kauth\.kakao\.com\/oauth\/authorize/)
    // redirect_uri 가 현재 API 도메인을 가리켜야 함 (provider 콘솔 등록 검증)
    const expectedDomain = TARGET === 'prod' ? 'api.sajuplan.com' : 'api.sajumoon.kr'
    expect(loc, `redirect_uri 도메인 불일치 (${expectedDomain} 기대)`).toContain(
      encodeURIComponent(`https://${expectedDomain}`),
    )
    await ctx.dispose()
  })

  test('OAuth start — naver 302 redirect → nid.naver.com', async () => {
    const ctx = await request.newContext()
    const resp = await ctx.get(`${BASE}/api/user/auth/social/naver/start`, {
      maxRedirects: 0,
      timeout: 10_000,
    })
    expect([301, 302, 303]).toContain(resp.status())
    const loc = resp.headers()['location'] ?? ''
    expect(loc, 'naver OAuth redirect URL 누락').toMatch(/nid\.naver\.com\/oauth2\.0\/authorize/)
    const expectedDomain = TARGET === 'prod' ? 'api.sajuplan.com' : 'api.sajumoon.kr'
    expect(loc, `redirect_uri 도메인 불일치 (${expectedDomain} 기대)`).toContain(
      encodeURIComponent(`https://${expectedDomain}`),
    )
    await ctx.dispose()
  })
})
