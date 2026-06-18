import { test, expect, request } from '@playwright/test'

/**
 * [2026-06-12] E2E 자동테스트 계정(e2e_*, 예: id=141 "E2E듀얼")이
 * 사용자 상담사 목록/검색에 노출되지 않아야 한다 (counselors.service: mb_id NOT LIKE 'e2e%').
 */

const API = 'https://api.sajuplan.com'
const E2E_DUAL_ID = 141

async function listIds(tab: string): Promise<Array<{ id: number; name: string }>> {
  const ctx = await request.newContext()
  const r = await ctx.get(`${API}/api/user/counselors?tab=${tab}&limit=300`)
  expect(r.ok()).toBeTruthy()
  const items = (await r.json()).items ?? []
  await ctx.dispose()
  return items.map((x: { id: number; name: string }) => ({ id: x.id, name: x.name }))
}

test.describe('E2E 테스트 계정 사용자 목록 비노출', () => {
  for (const tab of ['all', 'new', 'chat', 'popular']) {
    test(`${tab} 탭에 e2e_dual(#${E2E_DUAL_ID}) / "E2E" 이름 없음`, async () => {
      const items = await listIds(tab)
      expect(items.length, '목록 비어있지 않음').toBeGreaterThan(0)
      expect(items.find((x) => x.id === E2E_DUAL_ID), `${tab}: e2e_dual 노출됨`).toBeFalsy()
      expect(items.some((x) => (x.name ?? '').toUpperCase().includes('E2E')), `${tab}: E2E 이름 노출됨`).toBeFalsy()
    })
  }

  test('검색에 E2E 계정 안 나옴', async () => {
    const ctx = await request.newContext()
    const r = await ctx.get(`${API}/api/user/counselors/search?q=${encodeURIComponent('E2E')}&limit=30`)
    expect(r.ok()).toBeTruthy()
    const items = (await r.json()).items ?? []
    await ctx.dispose()
    expect(items.find((x: { id: number }) => x.id === E2E_DUAL_ID), '검색에 e2e_dual 노출됨').toBeFalsy()
  })
})
