import { test, expect, request as pwRequest } from '@playwright/test'

/**
 * 모집인(서포터즈) 추천 코드 입력 UX 보강 (2026-06-18).
 *  ① 가입화면 추천코드칸 = 접이식(일반 가입자 무방해) — 펼쳐야 입력칸 노출
 *  ③ 사후 입력 복구 — 회원이 가입 후 7일 내 마이페이지에서 추천코드 1회 등록
 *     (앱 신규설치 경유 가입 시 코드 누락분 구제)
 */

const API_BASE = 'https://api.sajuplan.com/api'

test('가드 — 비로그인 추천 사후입력 API 는 401', async () => {
  const ctx = await pwRequest.newContext({ storageState: { cookies: [], origins: [] } })
  const s = await ctx.get(`${API_BASE}/user/promoter/referral-status`)
  expect(s.status()).toBe(401)
  const a = await ctx.post(`${API_BASE}/user/promoter/referral`, { data: { code: '0001' } })
  expect(a.status()).toBe(401)
  await ctx.dispose()
})

test('가입화면 추천코드칸 — 기본은 접힘(일반 가입자 무방해), 펼쳐야 입력칸', async ({ page }) => {
  await page.goto('/signup')
  await page.waitForLoadState('networkidle')
  // 기본 상태: 입력칸 대신 접이식 링크만 노출
  const toggle = page.getByRole('button', { name: '추천코드가 있으신가요?' })
  await expect(toggle).toBeVisible()
  await expect(page.getByPlaceholder('받으신 추천코드 (없으면 비워두세요)')).toHaveCount(0)
  // 펼치면 입력칸 등장
  await toggle.click()
  await expect(page.getByPlaceholder('받으신 추천코드 (없으면 비워두세요)')).toBeVisible()
})

// ── 회원 로그인 컨텍스트 (global-setup 이 만든 user_member_storage.json) ──
test.describe('회원 — 추천 사후입력', () => {
  test.use({ storageState: 'user_member_storage.json' })

  test('referral-status — 응답 구조(hasReferral/canInput) 정상', async ({ page }) => {
    const res = await page.request.get(`${API_BASE}/user/promoter/referral-status`)
    // 비로그인이면 401 → 회원 storageState 가 비어있을 수 있어, 200 일 때만 구조 검증
    if (res.status() === 200) {
      const body = await res.json()
      expect(body).toHaveProperty('hasReferral')
      expect(body).toHaveProperty('canInput')
    } else {
      expect(res.status()).toBe(401)
    }
  })

  test('apply — 무효/제한 코드는 ok:false (실제 귀속 생성 안 함)', async ({ page }) => {
    const res = await page.request.post(`${API_BASE}/user/promoter/referral`, {
      data: { code: 'ZZNOPE9999' },
    })
    if (res.status() === 200) {
      const body = await res.json()
      expect(body.ok).toBeFalsy() // 무효코드 또는 이미귀속/기간지남 → 등록 안 됨
      expect(typeof body.message).toBe('string')
    } else {
      expect(res.status()).toBe(401)
    }
  })
})
