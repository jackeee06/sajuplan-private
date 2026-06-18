import { test, expect } from '@playwright/test'

/**
 * unit_seconds 30초 고정 정책 검증 (2026-06-12)
 *  - 관리자가 단가 수정 시 call/chat_unit_seconds 에 30 외 값(60·90)을 보내도 서버가 무시하고 30 유지.
 *  - 화면 "30초당 단가" 표시와 DB 가 항상 일치하도록 강제.
 */

const API = 'https://api.sajuplan.com/api'
const COUNSELOR_ID = 141 // e2e_dual

test('단가 수정에 60/90 보내도 unit_seconds 는 30으로 강제', async ({ request }) => {
  // 30 외 값 주입 시도
  const patch = await request.patch(`${API}/admin/members/counselors/${COUNSELOR_ID}`, {
    data: { call_unit_seconds: 90, chat_unit_seconds: 60 },
  })
  expect(patch.ok(), `수정 요청 실패: ${patch.status()} ${await patch.text()}`).toBeTruthy()

  // 관리자 조회 — 전화·채팅 모두 30
  const adm = await request.get(`${API}/admin/members/counselors/${COUNSELOR_ID}`)
  const a = await adm.json()
  expect(Number(a.call_unit_seconds), 'call_unit_seconds 가 30 아님').toBe(30)
  expect(Number(a.chat_unit_seconds), 'chat_unit_seconds 가 30 아님').toBe(30)

  // 공개(사용자) 조회 — 화면용 unit_seconds 도 30
  const pub = await request.get(`${API}/user/counselors/${COUNSELOR_ID}`)
  const c = await pub.json()
  expect(Number(c.unit_seconds), '공개 unit_seconds 가 30 아님').toBe(30)
})
