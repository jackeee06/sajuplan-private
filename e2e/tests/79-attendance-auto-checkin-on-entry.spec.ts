import { test, expect } from '@playwright/test'

/**
 * [2026-06-12] 출석 자동화 검증 — 로그인 상태로 앱에 진입하면(로그인 폼을 거치지 않아도)
 * 하루 1회 출석 checkin 이 자동 호출되어야 한다.
 *
 * 배경: 기존엔 비밀번호 로그인 직후에만 checkin 이 호출돼, 간편로그인/세션유지 사용자가
 *       매일 앱을 써도 출석이 안 잡혔다(박기수 사례). AttendanceToast 가 member 감지 →
 *       하루 1회 자동 checkin 하도록 변경.
 *
 * 검증: storageState(이미 로그인된 세션)로 홈 진입 시 POST /user/attendance/checkin 요청이 발생한다.
 *       (localStorage 가드는 fresh 브라우저 컨텍스트라 비어있어 첫 진입에 반드시 호출됨)
 */

test.use({ storageState: 'user_member_storage.json' })

test('로그인 상태로 앱 진입 시 출석 checkin 이 자동 호출된다', async ({ page }) => {
  test.setTimeout(60_000)

  const checkinReq = page.waitForRequest(
    (req) => req.url().includes('/user/attendance/checkin') && req.method() === 'POST',
    { timeout: 20_000 },
  )

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

  const req = await checkinReq
  expect(req, '앱 진입 시 출석 checkin 자동 호출 안 됨').toBeTruthy()

  // 응답이 정상(2xx)인지도 확인 — 서버가 출석 처리(또는 already)를 정상 응답해야 함
  const res = await req.response()
  expect(res, 'checkin 응답 없음').toBeTruthy()
  expect(res!.status(), `checkin 응답 상태 ${res!.status()}`).toBeLessThan(300)
})
