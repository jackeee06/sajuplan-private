import { test, expect, request } from '@playwright/test'

/**
 * [2026-06-12 재확정] 상담사 리스팅 랭킹 — 추천핀 → 상담중(0) → 방금끝남30분(1)
 *   → 전화+채팅 둘 다 가능(2) → 둘 중 하나만 가능(3) → 부재(4).
 *   (변경 전: use_phone=true 면 채팅 여부 무관 2점 → "둘 다"와 "전화만"이 같은 칸에 섞임)
 *
 * 공개 API(GET /api/user/counselors)로 관측 가능한 경계를 검증:
 *   - 추천핀(is_recommended) 묶음이 전부 선두
 *   - 상담중(CONN/CNCH) 묶음이 그 다음, 부재(ABSE/RESV) 묶음이 맨 뒤
 *   - 가용 묶음 안에서 "둘 다 가능"이 "하나만 가능"보다 앞 (이번 정책 변경 핵심)
 *   (방금끝남 tier 는 last_consult_ended_at 가 응답에 없어 관측 불가 → 별도 통제 스크립트로 검증)
 */

const API = 'https://api.sajuplan.com'

// 관측 가능한 큰 그룹: 상담중(0) < 그외 가용(1) < 부재(2)
function stateGroup(state: string): number {
  if (['CONN', 'CNCH'].includes(state)) return 0
  if (['ABSE', 'RESV'].includes(state)) return 2
  return 1
}

async function fetchList(tab: string) {
  const ctx = await request.newContext()
  const r = await ctx.get(`${API}/api/user/counselors?tab=${tab}&limit=50`)
  expect(r.ok(), `목록 응답 OK (tab=${tab})`).toBeTruthy()
  const body = await r.json()
  await ctx.dispose()
  return (body.items ?? []) as Array<{
    id: number
    state: string
    use_phone: boolean
    use_chat: boolean
    is_recommended: boolean
  }>
}

test.describe('상담사 리스팅 랭킹 경계', () => {
  test('전체 탭 — 추천핀 선두 + 상담중→가용→부재 순서 (SQL 정상 동작)', async () => {
    const items = await fetchList('all')
    expect(items.length, '상담사 목록 비어있지 않음').toBeGreaterThan(0)

    // ① 추천핀(true) 이 전부 비추천(false) 보다 앞
    const firstNonRec = items.findIndex((x) => !x.is_recommended)
    if (firstNonRec >= 0) {
      const recAfter = items.slice(firstNonRec).some((x) => x.is_recommended)
      expect(recAfter, '추천핀이 비추천 뒤에 섞이면 안 됨').toBeFalsy()
    }

    // ② 비추천 묶음 안에서 상태그룹(상담중<가용<부재) 단조 비감소
    const nonRec = items.filter((x) => !x.is_recommended).map((x) => stateGroup(x.state))
    for (let i = 1; i < nonRec.length; i++) {
      expect(nonRec[i], `부재가 상담중/가용보다 위로 오면 안 됨 (idx ${i})`).toBeGreaterThanOrEqual(nonRec[i - 1])
    }
  })

  test('전체 탭 — 가용 묶음에서 "전화+채팅 둘 다"가 "하나만"보다 앞 (정책 변경 핵심)', async () => {
    const items = await fetchList('all')
    // 가용(상담중·부재 아님) + 비추천 묶음만 추출 — 이 안에서 둘다(2) < 하나만(3) 검증
    const avail = items.filter(
      (x) => !x.is_recommended && !['CONN', 'CNCH', 'ABSE', 'RESV'].includes(x.state),
    )
    // tier: 둘 다 가능 = 0, 하나만 가능 = 1 (방금끝남은 응답으로 구분 불가 → 둘 다와 같은 0으로 간주해도
    //   "하나만이 둘다보다 위로 오면 안 됨" 단조성 검증엔 영향 없음)
    const tier = (x: { use_phone: boolean; use_chat: boolean }) =>
      x.use_phone && x.use_chat ? 0 : 1
    const seq = avail.map(tier)
    for (let i = 1; i < seq.length; i++) {
      expect(
        seq[i],
        `"하나만 가능"이 "둘 다 가능"보다 위로 오면 안 됨 (idx ${i})`,
      ).toBeGreaterThanOrEqual(seq[i - 1])
    }
  })

  test('채팅 탭 — 상담중→가용→부재 순서', async () => {
    const items = await fetchList('chat')
    expect(items.length).toBeGreaterThan(0)
    const groups = items.map((x) => stateGroup(x.state))
    for (let i = 1; i < groups.length; i++) {
      expect(groups[i], `채팅탭 순서 위반 (idx ${i})`).toBeGreaterThanOrEqual(groups[i - 1])
    }
  })
})
