import { test, expect } from '@playwright/test'

/**
 * 부재(두 토글 모두 off) 상담사도 리스트 노출 검증 (2026-06-17) — 사장님 지시.
 *
 * 배경: 전화·채팅 둘 다 끄면 state=ABSE 인데, 전체/인기 탭 쿼리의
 *       `AND (use_phone OR use_chat)` 때문에 목록에서 빠졌다. → 그 조건 제거.
 *
 * 검증(조작 없이 실데이터): 현재 ABSE(둘 다 off) 상담사가 전체 탭 목록에 실제로 노출되는지 확인.
 *   [2026-07-03] 특정 상담사 id 하드코딩(112/148)은 그 상담사가 상담가능을 켜면 오탐 실패했다.
 *   → 상태 변동에 견고하도록 "런타임에 목록의 ABSE 카드 수"로 검증(99 spec 과 동일 철학).
 */

const API = 'https://api.sajuplan.com/api/user/counselors'

test.use({ storageState: 'user_member_storage.json' })

test('부재(둘 다 off, ABSE) 상담사가 전체 목록에 노출된다', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  const res = await page.evaluate(async (api) => {
    const r = await fetch(`${api}?tab=all&limit=300`, { credentials: 'include' })
    const body = await r.json().catch(() => null)
    const items: { id?: number; nickname?: string; state?: string }[] =
      Array.isArray(body) ? body : body?.items ?? []
    const absent = items.filter((it) => it.state === 'ABSE')
    return {
      total: items.length,
      absentCount: absent.length,
      sample: absent.slice(0, 3).map((it) => ({ id: it.id, nickname: it.nickname })),
    }
  }, API)

  // 전체 목록이 정상적으로 내려왔는지
  expect(res.total, '목록이 비었음').toBeGreaterThan(0)
  // ★ 핵심 — 부재(ABSE, 둘 다 off) 상담사가 목록에 최소 1명 노출됨(쿼리 조건 회귀 방지).
  //   하드코딩 id 대신 런타임 탐색이라 상담사가 켜고 끄는 실데이터 변동에 견고.
  expect(
    res.absentCount,
    `부재(ABSE) 상담사가 목록에 하나도 안 보임 — 노출 쿼리 회귀 의심. sample=${JSON.stringify(res.sample)}`,
  ).toBeGreaterThan(0)
})
