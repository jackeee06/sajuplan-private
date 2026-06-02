import { test, expect, request } from '@playwright/test'

/**
 * [2026-05-27] 5분 알림 회귀 방지 — 7차 엄격검증 후 자동화.
 *
 * 5분 알림은 실 시나리오 (실제 5분 통화) 로 테스트하기 어려움.
 * → cron endpoint shape + UI 분기 + GlobalAlerts polling 동작을 정적/네트워크 차원에서 검증.
 *
 * 검증 영역 (회귀 시 즉시 fail):
 *  1) /api/cron/chat/five-min-alert  — JSON shape { fired:number, rooms:number[] }
 *  2) /api/cron/phone/five-min-alert — JSON shape { fired:number, calls:string[] }
 *  3) GlobalAlerts polling — 로그인 사용자가 사이트 진입 시 /api/user/notifications/pending 요청 발생
 *  4) ChatRoom 5분 모달 회원/상담사 분기 — 빌드 산출물 또는 소스에 두 텍스트 모두 존재
 *
 * 실패 의미:
 *  - 1, 2: cron 안전망 사라짐 / endpoint 변경 → 5분 알림 누락 위험
 *  - 3: GlobalAlerts 마운트 빠짐 → 회원이 다른 페이지 보고 있을 때 알림 누락
 *  - 4: 회원/상담사 분기 사라짐 → 상담사에게 충전 버튼 노출 (이전 사고 재발)
 *
 * env 별 base URL + CRON_TOKEN 자동 (process.env.CRON_TOKEN_TEST/PROD).
 */

const API_BASE: Record<string, string> = {
  test: 'https://api.sajumoon.kr',
  prod: 'https://api.sajuplan.com',
}
const WEB_BASE: Record<string, string> = {
  test: 'https://sajumoon.kr',
  prod: 'https://sajuplan.com',
}
const TARGET = process.env.TARGET ?? 'test'
const BASE = API_BASE[TARGET] ?? API_BASE.test
const WEB = WEB_BASE[TARGET] ?? WEB_BASE.test
const CRON_TOKEN =
  TARGET === 'prod'
    ? process.env.CRON_TOKEN_PROD ?? process.env.CRON_TOKEN ?? ''
    : process.env.CRON_TOKEN_TEST ?? process.env.CRON_TOKEN ?? ''

test.describe(`5분 알림 회귀 방지 (${TARGET})`, () => {
  test.describe.configure({ mode: 'serial' })

  test('1) chat-five-min-alert cron endpoint shape', async () => {
    test.skip(!CRON_TOKEN, 'CRON_TOKEN 미설정 — spec skip')
    const ctx = await request.newContext()
    const resp = await ctx.get(`${BASE}/api/cron/chat/five-min-alert`, {
      headers: { 'X-Cron-Token': CRON_TOKEN },
      timeout: 15_000,
    })
    expect(resp.status(), `${BASE}/api/cron/chat/five-min-alert → ${resp.status()}`).toBe(200)
    const json = await resp.json()
    expect(typeof json.fired).toBe('number')
    expect(Array.isArray(json.rooms)).toBe(true)
    await ctx.dispose()
  })

  test('2) phone-five-min-alert cron endpoint shape', async () => {
    test.skip(!CRON_TOKEN, 'CRON_TOKEN 미설정 — spec skip')
    const ctx = await request.newContext()
    const resp = await ctx.get(`${BASE}/api/cron/phone/five-min-alert`, {
      headers: { 'X-Cron-Token': CRON_TOKEN },
      timeout: 15_000,
    })
    expect(resp.status(), `${BASE}/api/cron/phone/five-min-alert → ${resp.status()}`).toBe(200)
    const json = await resp.json()
    expect(typeof json.fired).toBe('number')
    expect(Array.isArray(json.calls)).toBe(true)
    await ctx.dispose()
  })

  test('3) cron token 미보유 호출은 401/403 — 보안 가드 회귀 방지', async () => {
    const ctx = await request.newContext()
    const resp = await ctx.get(`${BASE}/api/cron/chat/five-min-alert`, { timeout: 10_000 })
    expect([401, 403]).toContain(resp.status())
    await ctx.dispose()
  })

  test('4) GlobalAlerts polling — 로그인 후 /notifications/pending 요청 발생', async ({ page }) => {
    if (TARGET === 'prod') test.skip()
    // e2e_member 인증 (test 환경에만 존재)
    await page.goto(`${WEB}/`, { waitUntil: 'domcontentloaded' })
    const loginOk = await page.evaluate(async (base) => {
      const r = await fetch(`${base}/api/user/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mb_id: 'e2e_member', password: 'e2e_test_2026' }),
        credentials: 'include',
      })
      return r.ok
    }, BASE)
    test.skip(!loginOk, 'e2e_member 로그인 실패 — test 서버 미작동')

    // 페이지 reload → GlobalAlerts mount → polling 시작
    const pendingRequests: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/api/user/notifications/pending')) {
        pendingRequests.push(req.url())
      }
    })
    await page.goto(`${WEB}/`, { waitUntil: 'domcontentloaded' })
    // 첫 polling 즉시 발생 (useEffect 초기 호출). 안전 마진 5초.
    await page.waitForTimeout(5000)
    expect(pendingRequests.length, 'GlobalAlerts polling 누락 — 컴포넌트 마운트 빠졌을 가능성').toBeGreaterThan(0)
  })

  test('5) ChatRoom 빌드 산출물 — 회원/상담사 5분 모달 텍스트 모두 존재', async ({ page }) => {
    // 페이지 진입 후 모든 chunked JS 다운로드. 두 텍스트 모두 발견되어야 함.
    // 분기 사라지면 둘 중 하나 없음 → 사고 재발 (상담사에게 충전 버튼).
    await page.goto(`${WEB}/`, { waitUntil: 'networkidle' })
    // dist 의 모든 chunked JS body 합쳐 검색
    const allScripts = await page.evaluate(async () => {
      const scripts = Array.from(document.querySelectorAll('script[src]'))
        .map((s) => (s as HTMLScriptElement).src)
        .filter((src) => src.includes('/assets/'))
      const bodies = await Promise.all(
        scripts.map((src) =>
          fetch(src).then((r) => (r.ok ? r.text() : '')).catch(() => ''),
        ),
      )
      return bodies.join('\n')
    })
    expect(allScripts).toContain('마무리 멘트')  // 상담사 분기 문구
    expect(allScripts).toContain('충전하시면 끊김 없이')  // 회원 분기 문구
  })
})
