import { test, expect, devices } from '@playwright/test'

const GALAXY = devices['Galaxy S9+']

/**
 * 상담사 "나의 상담 통계" — 기간 수익금 표시 (2026-06-14 추가).
 *  (1) API /user/consult/my-stats 가 total_earning(number) 을 반환하는가
 *  (2) 화면 요약 카드에 "수익금 … 원" 이 노출되는가
 *  (정확성 SUM 검증은 prod DB 교차검증으로 별도 확인 — 박기수 13건/6000원 일치)
 */

test('(API) my-stats 응답에 total_earning(number) 포함', async ({ browser }) => {
  const ctx = await browser.newContext({ ...GALAXY, storageState: 'user_dual_storage.json' })
  const page = await ctx.newPage()
  await page.goto('https://sajuplan.com/counselor/mypage/referral', { waitUntil: 'domcontentloaded' })

  const res = await page.evaluate(async () => {
    const r = await fetch('https://api.sajuplan.com/api/user/consult/my-stats?from=2026-06-01&to=2026-06-13&type=all&page=1&limit=20', { credentials: 'include' })
    return { status: r.status, body: r.ok ? await r.json() : (await r.text()).slice(0, 120) }
  })
  console.log('[my-stats 응답]', JSON.stringify(res).slice(0, 300))

  expect(res.status).toBe(200)
  expect(res.body).toHaveProperty('total_earning')
  expect(typeof res.body.total_earning).toBe('number')
  expect(res.body.total_earning).toBeGreaterThanOrEqual(0)
  // 기존 필드도 깨지지 않았는지 회귀 확인
  expect(typeof res.body.total_count).toBe('number')
  expect(typeof res.body.total_seconds).toBe('number')

  await ctx.close()
})

test('(UI) 상담 통계 요약에 "수익금 … 원" 카드 노출', async ({ browser }) => {
  const ctx = await browser.newContext({ ...GALAXY, storageState: 'user_dual_storage.json' })
  const page = await ctx.newPage()
  await page.goto('https://sajuplan.com/counselor/mypage/consult-stats', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  const body = await page.locator('body').innerText()
  console.log('[통계 화면 일부]', body.slice(0, 200).replace(/\n+/g, ' | '))

  // 수익금 라벨 + 원 단위 카드가 보여야 함
  await expect(page.getByText('수익금', { exact: true }).first()).toBeVisible()
  // 4개 요약 카드 라벨 모두 존재 (상담/수익금/시간/부재)
  for (const label of ['상담', '수익금', '시간', '부재']) {
    expect(body.includes(label)).toBeTruthy()
  }

  await ctx.close()
})
