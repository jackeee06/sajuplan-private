import { test, expect } from '@playwright/test'

/**
 * 상담사 리스트 매출 — 전화(070)/채팅 정확 분리 검증 (2026-06-12)
 *  - 이전: preflag 기준이라 채팅이 070(전화)에 섞였음(지안선생 채팅 4천이 070으로).
 *  - 변경: roomid 기준 → 채팅은 this_month_chat, 전화는 this_month_070. 총합은 동일.
 */

const API = 'https://api.sajuplan.com/api'

test('지안선생 채팅매출이 전화(070) 아닌 채팅 칸으로 분리된다', async ({ request }) => {
  const r = await request.get(`${API}/admin/members/counselors?limit=100`)
  expect(r.ok()).toBeTruthy()
  const body = await r.json()
  const jian = (body.items as Array<Record<string, unknown>>).find((c) => c.nickname === '지안선생')
  test.skip(!jian, '지안선생 데이터 없음 — 전제 미충족')

  const call = Number(jian!.this_month_070 ?? 0)
  const chat = Number(jian!.this_month_chat ?? 0)

  // 지안선생은 이번달 채팅상담 2건(2000×2=4000)만 — 전화는 0이어야
  expect(call, `전화(070)에 매출이 잡힘(채팅이 섞였을 가능성): call=${call}`).toBe(0)
  expect(chat, `채팅 매출이 4000 아님: chat=${chat}`).toBe(4000)

  // 응답에 더 이상 this_month_060 키가 없어야(060 제거)
  expect('this_month_060' in jian!, 'this_month_060 키가 아직 있음').toBe(false)
})
