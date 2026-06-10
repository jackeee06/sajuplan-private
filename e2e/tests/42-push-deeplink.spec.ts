import { test, expect } from '@playwright/test'

/**
 * [2026-06-10] 푸시 딥링크 event_url 검증
 *
 * 작업 내용:
 *   - 채팅요청 푸시: data.link → data.event_url = '/chat/{roomId}'
 *   - 전화요청 푸시: data.link '/mypage' → data.event_url '/counselor'
 *
 * 검증 전략:
 *   1. 푸시가 이동시키는 목적지 페이지가 실제로 존재하고 정상 로드되는지
 *   2. API 빌드 이후 관련 엔드포인트가 정상 응답하는지
 *   3. JS 에러 없이 SPA 마운트되는지
 *
 * ※ FCM 푸시 탭 자체는 실기기 없이 Playwright 에서 재현 불가.
 *    대신 이동 목적지 페이지(event_url)의 유효성을 직접 검증한다.
 */

const BASE = 'https://sajuplan.com'
const API  = 'https://api.sajuplan.com'

// ── 1. 비로그인 상태에서 목적지 URL 도달 가능성 확인 ───────────────────────
test.describe('푸시 딥링크 목적지 — 비로그인 접근', () => {
  test('/counselor — 전화요청 푸시 목적지 (비로그인 → 로그인 redirect 또는 200)', async ({ page }) => {
    const jsErrors: string[] = []
    page.on('pageerror', (e) => jsErrors.push(e.message))

    const res = await page.goto(`${BASE}/counselor`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    // 404 가 아니어야 함 (redirect 포함 최종 응답)
    const status = res?.status() ?? 200
    expect(status, '/counselor 가 404 반환').not.toBe(404)

    // SPA 루트 div 마운트 확인 (first() — body + #root 둘 다 매칭되는 strict mode 오류 방지)
    await expect(page.locator('#root').first()).toBeAttached()

    // Critical JS 에러 없음
    const critical = jsErrors.filter(e =>
      /TypeError|ReferenceError|SyntaxError/.test(e) &&
      !/extension|chrome-extension/.test(e)
    )
    expect(critical, `JS 에러 발생: ${critical.join(' | ')}`).toHaveLength(0)
  })

  test('/chat — 채팅요청 푸시 목적지 (비로그인 → redirect 또는 200)', async ({ page }) => {
    const jsErrors: string[] = []
    page.on('pageerror', (e) => jsErrors.push(e.message))

    const res = await page.goto(`${BASE}/chat`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const status = res?.status() ?? 200
    expect(status, '/chat 가 404 반환').not.toBe(404)

    await expect(page.locator('#root').first()).toBeAttached()

    const critical = jsErrors.filter(e =>
      /TypeError|ReferenceError|SyntaxError/.test(e) &&
      !/extension|chrome-extension/.test(e)
    )
    expect(critical, `JS 에러 발생: ${critical.join(' | ')}`).toHaveLength(0)
  })

  test('/chat/999 — 채팅방 직행 URL (roomId 포함 형태) 404 아님', async ({ page }) => {
    const jsErrors: string[] = []
    page.on('pageerror', (e) => jsErrors.push(e.message))

    // 존재하지 않는 roomId 999 → 앱이 "방 없음" 처리하더라도 SPA 자체는 로드돼야 함
    const res = await page.goto(`${BASE}/chat/999`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const status = res?.status() ?? 200
    // SPA 는 모든 경로를 index.html 로 서빙 — nginx 설정 정상이면 항상 200
    expect(status, '/chat/999 가 404 반환 — nginx try_files 미설정 가능성').not.toBe(404)

    const critical = jsErrors.filter(e =>
      /TypeError|ReferenceError|SyntaxError/.test(e) &&
      !/extension|chrome-extension/.test(e)
    )
    expect(critical, `JS 에러 발생: ${critical.join(' | ')}`).toHaveLength(0)
  })
})

// ── 2. 상담사(듀얼) 로그인 상태에서 목적지 페이지 정상 렌더 확인 ────────────
test.describe('푸시 딥링크 목적지 — 상담사 로그인 상태', () => {
  test.use({ storageState: 'user_dual_storage.json' })

  test.beforeEach(async ({ page, context }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
    const cookies = await context.cookies()
    if (cookies.length === 0) {
      test.skip(true, 'e2e_dual 세션 없음 — global-setup 확인')
    }
  })

  test('/counselor — 전화요청 푸시 목적지: 상담사 영역 정상 렌더', async ({ page }) => {
    const jsErrors: string[] = []
    page.on('pageerror', (e) => jsErrors.push(e.message))

    await page.goto('/counselor', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    // 상담사 영역 핵심 UI 존재 확인 (상담사 모드 배너 or 하단 네비)
    const hasCounselorArea = await page.locator('text=/상담사|수익금|counselor/i').count()
    expect(hasCounselorArea, '/counselor 에서 상담사 영역 UI 없음').toBeGreaterThan(0)

    const critical = jsErrors.filter(e =>
      /TypeError|ReferenceError|SyntaxError/.test(e) &&
      !/extension|chrome-extension/.test(e)
    )
    expect(critical, `JS 에러: ${critical.join(' | ')}`).toHaveLength(0)
  })

  test('/chat — 채팅요청 푸시 목적지: 로그인 상태로 접근 가능', async ({ page }) => {
    const jsErrors: string[] = []
    page.on('pageerror', (e) => jsErrors.push(e.message))

    const res = await page.goto('/chat', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    expect(res?.status() ?? 200, '/chat 가 404').not.toBe(404)

    const critical = jsErrors.filter(e =>
      /TypeError|ReferenceError|SyntaxError/.test(e) &&
      !/extension|chrome-extension/.test(e)
    )
    expect(critical, `JS 에러: ${critical.join(' | ')}`).toHaveLength(0)
  })
})

// ── 3. API 엔드포인트 — 푸시 발송 코드 경로 정상 확인 ────────────────────────
test.describe('푸시 딥링크 — API 빌드 후 관련 엔드포인트 정상', () => {
  test('GET /api/health — 빌드 후 서버 정상 기동', async ({ request }) => {
    const res = await request.get(`${API}/api/health`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  test('GET /api/user/counselors — counselors.service.ts 빌드 정상 (전화요청 발송 코드 포함)', async ({ request }) => {
    const res = await request.get(`${API}/api/user/counselors?page=1&limit=1`)
    // 200 또는 401 (인증 필요) — 500 이 아니면 빌드 정상
    expect([200, 401, 403]).toContain(res.status())
  })

  test('POST /api/user/consult/chat — consult.service.ts 빌드 정상 (채팅요청 발송 코드 포함)', async ({ request }) => {
    // 인증 없이 호출 → 401 이어야 함 (500 이면 빌드/런타임 오류)
    const res = await request.post(`${API}/api/user/consult/chat`, {
      data: { counselor_id: 1 },
    })
    expect([401, 403, 400]).toContain(res.status())
  })

  test('POST /api/user/consult/phone — counselors.service.ts 빌드 정상 (전화요청 발송 코드 포함)', async ({ request }) => {
    const res = await request.post(`${API}/api/user/consult/phone`, {
      data: { counselor_id: 1 },
    })
    expect([401, 403, 400]).toContain(res.status())
  })
})
