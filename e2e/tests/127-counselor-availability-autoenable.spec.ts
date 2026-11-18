import { test, expect } from '@playwright/test'

/**
 * 상담 켜기 함정 방지 (2026-07-16).
 *   칠백별 사고: use_phone/use_chat 이 둘 다 꺼진(f/f) 상담사가 "상담 켜기"(available:true)를 눌러도
 *   켤 채널이 없어 부재(ABSE)로 튕겨 온라인이 안 됐다.
 *   → setMyAvailability: available 이면서 전화·채팅 둘 다 꺼져 있으면 자동으로 둘 다 켠다.
 *      단, 하나라도 켜둔 상담사(전화만/채팅만)는 그 선택을 존중한다.
 */

const API = 'https://api.sajuplan.com/api'
test.use({ storageState: 'user_dual_storage.json' })

test('둘 다 꺼진 채 상담 켜기 → 자동으로 둘 다 켜짐(RDVC)', async ({ page }) => {
  const res = await page.request.patch(`${API}/user/counselors/me/availability`, {
    data: { available: true, use_phone: false, use_chat: false },
  })
  test.skip(res.status() === 401, 'e2e_dual 세션 없음 (global-setup 전)')
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body.use_phone).toBe(true)
  expect(body.use_chat).toBe(true)
  expect(body.state).toBe('RDVC')
})

test('전화만 켜면 전화만 유지(선택 존중, IDLE)', async ({ page }) => {
  const res = await page.request.patch(`${API}/user/counselors/me/availability`, {
    data: { available: true, use_phone: true, use_chat: false },
  })
  test.skip(res.status() === 401, 'e2e_dual 세션 없음')
  const body = await res.json()
  expect(body.use_phone).toBe(true)
  expect(body.use_chat).toBe(false)
  expect(body.state).toBe('IDLE')
})

test.afterAll(async ({ request }) => {
  // 테스트 계정 원복 — 부재로 끄기 (실제 리스트에 온라인으로 남지 않게)
  await request.patch(`${API}/user/counselors/me/availability`, {
    data: { available: false },
  }).catch(() => {})
})
