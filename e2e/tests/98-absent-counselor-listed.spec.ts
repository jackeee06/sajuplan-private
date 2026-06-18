import { test, expect } from '@playwright/test'

/**
 * 부재(두 토글 모두 off) 상담사도 리스트 노출 검증 (2026-06-17) — 사장님 지시.
 *
 * 배경: 전화·채팅 둘 다 끄면 state=ABSE 인데, 전체/인기 탭 쿼리의
 *       `AND (use_phone OR use_chat)` 때문에 목록에서 빠졌다. → 그 조건 제거.
 *
 * 검증(조작 없이 실데이터): 현재 둘 다 off(ABSE) + 프로필 보유 상담사가
 *   전체 탭 목록에 실제로 노출되는지 확인.
 *   - 선샤인 선생(id 112) / 채홍(id 148) — 조회 시점 둘 다 ABSE(둘다 off).
 */

const API = 'https://api.sajuplan.com/api/user/counselors'
// 조회 시점 둘 다 off(ABSE) 인 실제 상담사 (프로필 보유) — 이들이 보이면 수정 성공
const KNOWN_ABSENT_IDS = [112, 148]

test.use({ storageState: 'user_member_storage.json' })

test('부재(둘 다 off, ABSE) 상담사가 전체 목록에 노출된다', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  const res = await page.evaluate(async (api) => {
    const r = await fetch(`${api}?tab=all&limit=300`, { credentials: 'include' })
    const body = await r.json().catch(() => null)
    const items: { id?: number; nickname?: string; state?: string }[] =
      Array.isArray(body) ? body : body?.items ?? []
    return {
      total: items.length,
      absentCount: items.filter((it) => it.state === 'ABSE').length,
      hits: items
        .filter((it) => it.id != null && [112, 148].includes(it.id))
        .map((it) => ({ id: it.id, nickname: it.nickname, state: it.state })),
    }
  }, API)

  // 전체 목록이 정상적으로 내려왔는지
  expect(res.total, '목록이 비었음').toBeGreaterThan(0)
  // ★ 핵심 — 부재(둘 다 off) 상담사가 목록에 노출됨
  expect(res.hits.length, `부재 상담사(${KNOWN_ABSENT_IDS.join(',')})가 목록에 안 보임`).toBeGreaterThan(0)
  // 노출된 부재 상담사의 상태가 실제로 ABSE 인지 (둘다 off 케이스 확정)
  for (const h of res.hits) {
    expect(h.state, `id ${h.id} 노출됐지만 ABSE 아님 (state=${h.state})`).toBe('ABSE')
  }
  // 부재 카드가 목록에 1개 이상 섞여 있음(전반 회귀)
  expect(res.absentCount, '목록에 ABSE 카드가 하나도 없음').toBeGreaterThan(0)
})
