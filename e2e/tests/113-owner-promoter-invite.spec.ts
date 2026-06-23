import { test, expect } from '@playwright/test'

/**
 * [2026-06-21] 주인 전용 '신규 모집인 초대' — 사업 주인(공동대표)이 카톡으로 직접 초대.
 *
 * 주인 3명: jackee(91, 찬물선생/사장님) · 박기태(123, 라온선생) · 홍사랑(112, 선샤인 선생).
 * 받는 사람은 초대 링크(/promoter?inv=서명토큰)로 가입 시 자동승인되어 즉시 활동.
 *
 * 검증:
 *  1) owner-invite API — 주인(jackee) 200 + shareUrl(서명 inv 토큰) + 닉네임
 *  2) owner-invite API — 비주인(dummy_01) 403 (주인만 사용 가능)
 *  3) 마이페이지 — 주인에게 '카톡 보내기' 버튼 노출
 *  4) 마이페이지 — 비주인에겐 버튼 미노출
 */

const BASE = (process.env.TARGET ?? 'prod') === 'prod' ? 'https://sajuplan.com' : 'https://sajumoon.kr'
const API = (process.env.TARGET ?? 'prod') === 'prod' ? 'https://api.sajuplan.com' : 'https://api.sajumoon.kr'
const BTN = /신규 서포터즈에게 카톡/

test.describe('주인 전용 모집인 초대 — 자동승인 링크', () => {
  test('1. owner-invite API — 주인(jackee) 200 + 서명 초대링크', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'jackee_storage.json', baseURL: BASE })
    const p = await ctx.newPage()
    const res = await p.request.get(`${API}/api/user/promoter/owner-invite`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    // 카톡 앱 가로채기 회피용 OG 경유 단순링크(pi.html?inv=) → client-side 로 /promoter?inv= 이동
    expect(body.shareUrl, 'shareUrl 에 inv 서명토큰 포함(pi.html 경유)').toContain('/pi.html?inv=')
    expect(typeof body.ownerNickname).toBe('string')
    expect(body.ownerNickname.length).toBeGreaterThan(0)
    await ctx.close()
  })

  test('2. owner-invite API — 비주인(dummy_01) 403', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'user_counselor_storage.json', baseURL: BASE })
    const p = await ctx.newPage()
    const res = await p.request.get(`${API}/api/user/promoter/owner-invite`)
    expect(res.status(), '주인 아니면 403').toBe(403)
    await ctx.close()
  })

  test('3. 마이페이지 — 주인에게 카톡 초대 버튼 노출', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'jackee_storage.json', baseURL: BASE })
    const c = await ctx.newPage()
    await c.goto('/counselor/mypage')
    await c.waitForLoadState('domcontentloaded')
    await expect(c.getByRole('button', { name: BTN })).toBeVisible({ timeout: 10_000 })
    await ctx.close()
  })

  test('4. 마이페이지 — 비주인에겐 버튼 미노출', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'user_counselor_storage.json', baseURL: BASE })
    const c = await ctx.newPage()
    await c.goto('/counselor/mypage')
    await c.waitForLoadState('domcontentloaded')
    await c.waitForTimeout(1500)
    await expect(c.getByRole('button', { name: BTN })).toHaveCount(0)
    await ctx.close()
  })
})
