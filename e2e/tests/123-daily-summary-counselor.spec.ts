import { test, expect, request } from '@playwright/test'

/**
 * [2026-07-03] 일일 운영 요약 알림톡에 '신규 상담사' 줄 추가 회귀 방지.
 *
 * 매일 09:00 사장님 카톡으로 가는 요약(daily-summary)에 신규 회원만 있고
 * 신규 상담사(공급측 KPI)가 빠져 있어 추가함. 실수신자 스팸 없이 검증하려고
 * ?test=1 dry-run 진입점을 만들었다 (등급·정산 cron 과 동일 컨벤션, sent=0).
 *
 * 검증 영역 (회귀 시 즉시 fail):
 *  1) /api/cron/daily-summary?test=1 — dry-run 이므로 sent=0 (실발송 금지 회귀 방지)
 *  2) summary 에 '신규 상담사' 줄 존재 (라인 누락 회귀 방지)
 *  3) '신규 회원' 줄도 여전히 존재 (기존 항목 보존)
 *  4) cron token 미보유 호출은 401/403 (보안 가드)
 *
 * env 별 base URL + CRON_TOKEN 자동 (process.env.CRON_TOKEN_PROD/TEST).
 */

const API_BASE: Record<string, string> = {
  test: 'https://api.sajumoon.kr',
  prod: 'https://api.sajuplan.com',
}
const TARGET = process.env.TARGET ?? 'prod'
const BASE = API_BASE[TARGET] ?? API_BASE.test
const CRON_TOKEN =
  TARGET === 'prod'
    ? process.env.CRON_TOKEN_PROD ?? process.env.CRON_TOKEN ?? ''
    : process.env.CRON_TOKEN_TEST ?? process.env.CRON_TOKEN ?? ''

test.describe(`일일 요약 신규 상담사 줄 (${TARGET})`, () => {
  test.describe.configure({ mode: 'serial' })

  test('1) daily-summary dry-run — sent=0 + 신규 상담사/신규 회원 줄 존재', async () => {
    test.skip(!CRON_TOKEN, 'CRON_TOKEN 미설정 — spec skip')
    const ctx = await request.newContext()
    const resp = await ctx.get(`${BASE}/api/cron/daily-summary?test=1`, {
      headers: { 'X-Cron-Token': CRON_TOKEN },
      timeout: 20_000,
    })
    expect(resp.status(), `${BASE}/api/cron/daily-summary?test=1 → ${resp.status()}`).toBe(200)
    const json = await resp.json()
    // dry-run 이므로 실제 발송 0 — 실수신자 스팸 방지 회귀
    expect(json.sent).toBe(0)
    expect(typeof json.summary).toBe('string')
    // 신규 상담사 줄 (이번 추가분) + 신규 회원 줄 (기존 보존)
    expect(json.summary).toContain('신규 상담사')
    expect(json.summary).toContain('신규 회원')
    await ctx.dispose()
  })

  test('2) cron token 미보유 호출은 401/403 — 보안 가드 회귀 방지', async () => {
    const ctx = await request.newContext()
    const resp = await ctx.get(`${BASE}/api/cron/daily-summary?test=1`, { timeout: 10_000 })
    expect([401, 403]).toContain(resp.status())
    await ctx.dispose()
  })
})
