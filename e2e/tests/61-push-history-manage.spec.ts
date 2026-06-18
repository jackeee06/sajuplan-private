import { test, expect } from '@playwright/test'

/**
 * [2026-06-11] 푸시 알림 내역 보완 — ① 개별(단건) 삭제 ② 행 클릭 → 상세(본문) 팝업.
 *
 *  - 단건 삭제: 새 엔드포인트 DELETE /api/admin/notifications/push-history/:id
 *  - 상세: 목록 행 클릭 시 제목/본문/대상/URL/시각 팝업 (본문은 API 에 이미 있음)
 *
 * 관리자 세션(storageState.json) 사용.
 */

const API = 'https://api.sajuplan.com'

test.describe('푸시 알림 내역 관리 (관리자)', () => {
  test.use({ storageState: 'storageState.json' })

  test('단건 삭제 — 생성 → 단건 삭제 → 내역에서 사라짐', async ({ page }) => {
    // 1) 대상 회원 1명 확보
    const mres = await page.request.get(`${API}/api/admin/members?q=e2e_member&limit=5`)
    expect(mres.ok()).toBeTruthy()
    const members = (await mres.json()).items ?? []
    test.skip(members.length === 0, 'e2e_member 없음 — 스킵')
    const memberId = members[0].id

    const marker = `E2E단건삭제검증-${Date.now()}`

    // 2) 개별 푸시 발송 → notification_log 1 row 생성 (FCM 미설정/토큰없음이면 로그만)
    const send = await page.request.post(`${API}/api/admin/notifications/push-send`, {
      data: { target: String(memberId), title: marker, content: '단건 삭제 검증용 본문', link_url: '' },
    })
    console.log('[push-send]', send.status())
    expect(send.ok()).toBeTruthy()

    // 3) 내역에서 marker 로 찾기
    const h1 = await page.request.get(`${API}/api/admin/notifications/push-history?q=${encodeURIComponent(marker)}&limit=10`)
    const items1 = (await h1.json()).items ?? []
    const row = items1.find((x: { id: number; title: string }) => x.title === marker)
    expect(row, '방금 보낸 알림이 내역에 있어야').toBeTruthy()

    // 4) 단건 삭제
    const del = await page.request.delete(`${API}/api/admin/notifications/push-history/${row.id}`)
    console.log('[delete]', del.status(), await del.text())
    expect(del.ok()).toBeTruthy()
    expect((await (await page.request.get(`${API}/api/admin/notifications/push-history?q=${encodeURIComponent(marker)}&limit=10`)).json()).items
      .find((x: { id: number }) => x.id === row.id), '삭제 후 내역에 없어야').toBeFalsy()
  })

  // UI(행 클릭 → 상세 본문 팝업 + 삭제)는 손가락 동작 전용 spec 62 에서 전담 검증.
})
