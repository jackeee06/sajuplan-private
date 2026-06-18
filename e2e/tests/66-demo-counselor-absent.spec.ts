import { test, expect, request } from '@playwright/test'

/**
 * [2026-06-12] m2net 미등록 데모 상담사(dummy_*)는 부재(ABSE)여야 한다.
 * → 목록엔 보이되 카드가 "상담요청하기"(isOffline)로 떠서 헛클릭(연결실패/3분대기) 방지.
 * 데모는 m2net 미등록이라 실제 상담 불가 → tappable(전화/채팅 가용) 상태면 안 됨.
 */

const API = 'https://api.sajuplan.com'
// 현재 노출 데모 상담사 id (dummy_01, dummy_03~10). dummy_02 는 탈퇴(left_at) 제외.
const DEMO_IDS = [102, 104, 105, 106, 107, 108, 109, 110, 111]
const AVAILABLE_STATES = ['IDLE', 'RDCH', 'RDVC', 'CRDY', 'CONN', 'CNCH']

test('데모 상담사는 모두 부재(ABSE) — 가용 상태로 노출되지 않음', async () => {
  const ctx = await request.newContext()
  const r = await ctx.get(`${API}/api/user/counselors?tab=all&limit=300`)
  expect(r.ok()).toBeTruthy()
  const items = (await r.json()).items as Array<{ id: number; state: string }>
  await ctx.dispose()

  const demo = items.filter((x) => DEMO_IDS.includes(x.id))
  console.log('[demo states]', demo.map((d) => `${d.id}:${d.state}`).join(', '))
  expect(demo.length, '데모 상담사가 목록에 보여야(부재로라도)').toBeGreaterThan(0)
  for (const d of demo) {
    expect(AVAILABLE_STATES.includes(d.state), `데모 #${d.id} 가 가용 상태(${d.state})로 노출됨`).toBeFalsy()
    expect(d.state, `데모 #${d.id} state`).toBe('ABSE')
  }
})
