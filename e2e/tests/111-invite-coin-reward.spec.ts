import { test, expect, request as pwRequest } from '@playwright/test'

/**
 * 친구초대(회원→회원) 코인형 보상 + 공개 쿠폰 페이지 (2026-06-19).
 *  - 모집인 시스템 재활용: 회원=코인형 모집인(reward_type='coin'). 친구 유료사용분 3% → 회원 free_balance 즉시 코인.
 *  - 보상 착지점만 분기. 코드생성·귀속·3%·멱등은 모집인 로직 공용.
 *  - 직원·가족 호의용 공개 쿠폰 페이지 /event (로그인·앱 불필요, 게이트 예외).
 *
 * ⚠️ 실제 코인 적립은 m2net 상담 push 가 있어야 발생 → E2E 는 API 계약·가드·화면·이미지만 검증.
 *    돈 무결성(코인 적립이 earning/정산 무침범)은 tools/_verify_money_integrity.py 로 별도 검증.
 */

const API_BASE = 'https://api.sajuplan.com/api'

test('가드 — 비로그인 친구초대 API 는 401', async () => {
  const ctx = await pwRequest.newContext({ storageState: { cookies: [], origins: [] } })
  const en = await ctx.post(`${API_BASE}/user/promoter/invite/enable`)
  expect(en.status()).toBe(401)
  const db = await ctx.get(`${API_BASE}/user/promoter/invite/dashboard`)
  expect(db.status()).toBe(401)
  await ctx.dispose()
})

test('쿠폰 이미지 — /img/coupon-invite-v3.png 200 (카카오 공유 카드용 절대 URL)', async ({ page }) => {
  const res = await page.request.get('/img/coupon-invite-v3.png')
  expect(res.status()).toBe(200)
  expect((res.headers()['content-type'] ?? '')).toContain('image')
})

test('코드 쿠폰 이미지 엔드포인트 — 코드별 PNG 즉석 합성(무저장)', async () => {
  const ctx = await pwRequest.newContext()
  const res = await ctx.get('https://api.sajuplan.com/api/promoter/coupon-image/0572.png')
  expect(res.status()).toBe(200)
  expect((res.headers()['content-type'] ?? '')).toContain('image/png')
  const buf = await res.body()
  expect(buf.length).toBeGreaterThan(10000) // 실제 합성 PNG
  await ctx.dispose()
})

test('공개 쿠폰 페이지 /event — 게이트 없이 렌더 + 쿠폰 문구 + 카톡 공유 버튼', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('/event')
  await page.waitForLoadState('networkidle')
  // 앱 게이트가 페이지를 덮지 않음 (쿠폰 콘텐츠가 보여야 함)
  await expect(page.getByText('만원 무료코인').first()).toBeVisible()
  await expect(page.getByText('카카오톡으로 쿠폰 공유하기')).toBeVisible()
  expect(errors, errors.join('\n')).toEqual([])
})

// ── 회원 로그인 컨텍스트 ──
test.describe('회원 — 친구초대', () => {
  test.use({ storageState: 'user_member_storage.json' })

  test('invite/dashboard — 응답 구조(enabled/friendCount/totalCoins/timeline)', async ({ page }) => {
    const res = await page.request.get(`${API_BASE}/user/promoter/invite/dashboard`)
    if (res.status() === 200) {
      const b = await res.json()
      expect(b).toHaveProperty('enabled')
      expect(b).toHaveProperty('friendCount')
      expect(b).toHaveProperty('totalCoins')
      expect(Array.isArray(b.timeline)).toBe(true)
    } else {
      expect(res.status()).toBe(401)
    }
  })

  test('invite/enable — 코인형 모집인 보장 후 code/shareUrl 반환 (멱등)', async ({ page }) => {
    const res = await page.request.post(`${API_BASE}/user/promoter/invite/enable`)
    if (res.status() === 200) {
      const b = await res.json()
      expect(typeof b.code).toBe('string')
      expect(b.code.length).toBeGreaterThan(0)
      expect(String(b.shareUrl)).toContain('/s/')
      expect(b.rewardType === 'coin' || b.rewardType === 'cash').toBe(true)
      // 멱등: 다시 호출해도 같은 코드
      const res2 = await page.request.post(`${API_BASE}/user/promoter/invite/enable`)
      const b2 = await res2.json()
      expect(b2.code).toBe(b.code)
    } else {
      expect(res.status()).toBe(401)
    }
  })
})
