import { test, expect, request } from '@playwright/test'

/**
 * 알림 채널 분리(인앱/푸시) — Phase 1 + 2 영구 회귀 스펙 (2026-06-19)
 *
 * 규칙: 푸시는 항상 인앱과 함께 발송된다("푸시만"은 존재하지 않음 — 폰 알림 지워도 종모양에서 내용 복구 가능).
 *  1) 백엔드 — 인앱만 / 푸시(→인앱 강제) / 엣지 400 / 이력 채널 필터 / jackee 종모양
 *  2) UI — 알림 보내기 채널 + 푸시 켜면 인앱 자동 잠금 + 콘텐츠/노출 그룹 + 배너/팝업 안내
 *
 * 발송은 전부 개별(찬물선생 jackee id=91)로만 → 실사용자 스팸 없음. 생성분은 테스트 끝에 자동 삭제.
 */
const API = 'https://api.sajuplan.com'
const WEB = 'https://sajuplan.com/mng'
const TAG = '[E2E-CH]'

test.describe('알림 채널(인앱/푸시) 분리', () => {
  test.use({ storageState: 'storageState.json' }) // 슈퍼관리자

  test('백엔드 — 푸시는 인앱 강제 동반 + 채널/엣지/이력필터/종모양 + 자동정리', async ({ request: req }) => {
    const send = (title: string, channels: { inapp: boolean; push: boolean }) =>
      req.post(`${API}/api/admin/notifications/push-send`, {
        data: { target: '91', title, content: 'e2e', channels },
      })

    // A. 인앱만 (푸시 false) → 인앱-only
    const rIn = await send(`${TAG} 인앱만`, { inapp: true, push: false })
    expect(rIn.ok(), '인앱만 발송 성공').toBeTruthy()
    expect(String((await rIn.json()).pushed?.error ?? ''), '인앱만 → FCM 미발사').toContain('인앱만')
    // B. 푸시 요청(인앱 false) → 인앱 강제 포함
    expect((await send(`${TAG} 푸시강제인앱`, { inapp: false, push: true })).ok()).toBeTruthy()

    // 엣지 — 둘 다 false / 빈 제목 → 400
    expect((await send(`${TAG} 둘다off`, { inapp: false, push: false })).status(), '둘다off → 400').toBe(400)
    expect((await req.post(`${API}/api/admin/notifications/push-send`, {
      data: { target: '91', title: '', channels: { inapp: true } },
    })).status(), '빈제목 → 400').toBe(400)

    // C. 이력 채널 필터
    const pick = (j: { items: { title: string }[] }) => j.items.filter((i) => i.title.startsWith(TAG)).map((i) => i.title)
    const inapp = pick(await (await req.get(`${API}/api/admin/notifications/push-history?channel=inapp&limit=200`)).json())
    const push = pick(await (await req.get(`${API}/api/admin/notifications/push-history?channel=push&limit=200`)).json())
    expect(inapp).toContain(`${TAG} 인앱만`)
    expect(inapp, '푸시도 인앱 강제 → inapp 필터에 포함').toContain(`${TAG} 푸시강제인앱`)
    expect(push, 'push 필터는 인앱만 제외').not.toContain(`${TAG} 인앱만`)
    expect(push).toContain(`${TAG} 푸시강제인앱`)

    // D. jackee 종모양 — 푸시도 인앱 강제라 둘 다 노출(내용 복구 가능)
    const jackee = await request.newContext({ storageState: 'jackee_storage.json' })
    const bell = (await (await jackee.get(`${API}/api/user/notifications`)).json()).items
      .filter((i: { title?: string }) => String(i.title ?? '').startsWith(TAG))
      .map((i: { title: string }) => i.title)
    expect(bell).toContain(`${TAG} 인앱만`)
    expect(bell, '푸시도 종모양에 남음(내용 복구)').toContain(`${TAG} 푸시강제인앱`)
    await jackee.dispose()

    // G. 자동 정리
    const all = await (await req.get(`${API}/api/admin/notifications/push-history?limit=200`)).json()
    const ids = all.items.filter((i: { title: string }) => i.title.startsWith(TAG)).map((i: { id: number }) => i.id)
    for (const id of ids) await req.delete(`${API}/api/admin/notifications/push-history/${id}`)
    const after = await (await req.get(`${API}/api/admin/notifications/push-history?limit=200`)).json()
    expect(after.items.filter((i: { title: string }) => i.title.startsWith(TAG)).length, '정리 완료').toBe(0)
  })

  test('UI — 채널(푸시→인앱 잠금) + 콘텐츠/노출 그룹 + 배너/팝업 안내', async ({ page }) => {
    await page.goto(`${WEB}/push-notifications`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /알림 보내기/ })).toBeVisible({ timeout: 12000 })
    const inapp = page.locator('label:has-text("인앱(종모양)") input[type=checkbox]')
    const push = page.locator('label:has-text("푸시(FCM)") input[type=checkbox]')
    // 디폴트: 인앱 ON / 푸시 OFF
    await expect(inapp).toBeChecked()
    await expect(push).not.toBeChecked()
    // 푸시 켜면 인앱 자동 ON + 잠금(못 끔)
    await push.check()
    await expect(inapp, '푸시 켜면 인앱 자동 ON').toBeChecked()
    await expect(inapp, '푸시 켜면 인앱 잠금').toBeDisabled()
    await expect(page.getByText('푸시는 항상 인앱과 함께 발송')).toBeVisible()

    // 알림 이력(분리된 페이지) — 채널 컬럼
    await page.goto(`${WEB}/notification-history`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: '알림 이력' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('columnheader', { name: '채널' })).toBeVisible()

    await page.goto(`${WEB}/all-menus`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('콘텐츠/노출').first()).toBeVisible({ timeout: 10000 })

    await page.goto(`${WEB}/banners`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: '배너 관리' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('홈에 띄우는 콘텐츠')).toBeVisible()
  })
})
