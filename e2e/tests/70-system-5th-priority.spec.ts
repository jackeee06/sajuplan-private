import { test, expect } from '@playwright/test'

/**
 * [2026-06-12 · 5순위 시스템/설정] 확정 수정 검증.
 *  - E-4 이벤트: 사용자 목록에 미시작(upcoming/예정·초안) 이벤트가 노출되지 않아야 (백엔드 기본 필터)
 *  - 콘텐츠 XSS sanitize 는 렌더 무회귀로 간접 확인(공지/이벤트/알림/약관 페이지 정상 로드는 11·60 스펙)
 */

test.describe('5순위 — 이벤트 노출 필터', () => {
  test('사용자 이벤트 목록에 upcoming(미시작) 이벤트 미노출', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'https://api.sajuplan.com' })
    const res = await ctx.get('/api/user/events?page=1&limit=50')
    expect(res.ok(), `이벤트 목록 API 200 (실제 ${res.status()})`).toBeTruthy()
    const body = await res.json()
    const items: Array<{ status?: string }> = body.items ?? body ?? []
    const upcoming = items.filter((e) => e.status === 'upcoming')
    expect(
      upcoming.length,
      `사용자 목록에 예정(upcoming) 이벤트 ${upcoming.length}건 노출됨 — 숨겨야 함`,
    ).toBe(0)
    await ctx.dispose()
  })
})
