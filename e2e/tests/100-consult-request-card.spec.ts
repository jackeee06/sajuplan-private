import { test, expect } from '@playwright/test'

/**
 * 상담사 대시보드 "지금 상담 켜기" 카드 — 데이터원 API + 렌더 무에러 (2026-07-03).
 *
 * getMyConsultRequests: 부재중 쌓인 미응답 상담요청(callback_sent_at IS NULL, 24h내) 목록.
 *   - 상담사 세션(dual)으로 GET /me/consult-requests → 200 + 배열 + 항목 스키마
 *   - /counselor/mypage 진입 시 JS 에러 없이 렌더
 *
 * 카드 노출(부재+요청 존재)의 결정적 검증은 DB 레벨(tools/_verify_consult_requests.py)로 수행.
 *   여기선 엔드포인트 실동작 + 대시보드 렌더 안정성만 확인(실회원 알림 부작용 방지).
 */

const API = 'https://api.sajuplan.com'

test.use({ storageState: 'user_dual_storage.json' })

test('상담사 대시보드 — 상담요청 조회 API 200/배열 + 무에러 렌더', async ({ page }) => {
  const consoleErrors: string[] = []
  const isExpected = (m: string) => /status of (401|404|429)/.test(m) || /favicon/.test(m)
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' && !isExpected(m.text())) consoleErrors.push(m.text())
  })

  await page.goto('/counselor/mypage', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)

  const res = await page.evaluate(async (api) => {
    const r = await fetch(`${api}/api/user/counselors/me/consult-requests`, { credentials: 'include' })
    const body = await r.json().catch(() => null)
    return {
      status: r.status,
      isArray: Array.isArray(body),
      len: Array.isArray(body) ? body.length : -1,
      sample: Array.isArray(body) && body[0] ? body[0] : null,
    }
  }, API)

  // dual 계정이 상담사면 200 배열, 아니면 400/403(상담사 아님) — 어느 쪽이든 라우트는 정상 매칭
  test.skip(res.status === 400 || res.status === 403, `dual 계정이 상담사가 아니어서 스킵 (status=${res.status})`)

  expect(res.status, `consult-requests 응답 ${res.status}`).toBe(200)
  expect(res.isArray, '응답이 배열이 아님').toBe(true)

  // 항목이 있으면 스키마 확인 (requester_nick / channel / requested_at)
  if (res.sample) {
    expect(res.sample, 'requester_nick 누락').toHaveProperty('requester_nick')
    expect(res.sample, 'requested_at 누락').toHaveProperty('requested_at')
    expect(res.sample, 'channel 키 누락').toHaveProperty('channel')
  }
  console.log(`[OK] consult-requests: status=${res.status}, 건수=${res.len}`)

  // 대시보드가 JS 에러 없이 렌더됐는지 (카드 로직 포함)
  expect(page.url()).not.toContain('/login')
  expect(consoleErrors, `JS 에러: ${consoleErrors.join(' / ')}`).toHaveLength(0)
})
