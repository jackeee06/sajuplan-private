import { test, expect } from '@playwright/test'

/**
 * [2026-06-13] 앱 복귀 시 코인(회원정보) 자동 갱신 검증.
 *
 * 배경: 전화 상담은 앱 밖(통화)에서 진행 → 통화 후 앱 복귀 시 라우트가 안 바뀌면
 *       me() 미갱신 → 차감된 코인이 헤더/마이페이지에 반영 안 되던 문제("차감 안 됨" 불만).
 * 수정: auth-context 가 visibilitychange(visible) 시 refresh()(=GET /user/auth/me) 호출.
 *
 * 검증: 로그인 상태로 진입 후 visibilitychange 를 발생시키면 /user/auth/me 가 재호출된다.
 */

test.use({ storageState: 'user_member_storage.json' })

test('앱 복귀(visibilitychange) 시 회원정보(코인) 자동 갱신', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})

  // 복귀 시 me 재호출 대기
  const meReq = page.waitForRequest(
    (r) => r.url().includes('/user/auth/me') && r.method() === 'GET',
    { timeout: 10_000 },
  )

  // 백그라운드 → 복귀 시뮬레이션 (visible 상태에서 visibilitychange 발화)
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })

  const req = await meReq
  expect(req, '앱 복귀 시 me() 자동 호출 안 됨').toBeTruthy()
  const res = await req.response()
  expect(res, 'me 응답 없음').toBeTruthy()
  expect(res!.status(), `me 응답 상태 ${res!.status()}`).toBeLessThan(400)
})
