import { test, expect, type APIRequestContext } from '@playwright/test'

/**
 * [2026-06-12] 팝업 대상 구분(전체/회원만/상담사만) + 위치(home/counselor) 필터 검증.
 *
 *  전체(all) / 회원만(member) / 상담사만(counselor) 팝업 3개 생성 후:
 *   - 익명 home   → all 만 (member·counselor 제외)
 *   - 익명 counselor → 우리 counselor 팝업 안 보임(비로그인=상담사영역 없음)
 *   - 상담사계정 home     → all + member (counselor 제외)
 *   - 상담사계정 counselor → all + counselor (member 제외)
 * 끝나면 3개 삭제.
 */

const API = 'https://api.sajuplan.com'

async function titles(ctx: APIRequestContext, area: string, tag: string): Promise<string[]> {
  const r = await ctx.get(`${API}/api/user/popups?area=${area}`)
  const items = (await r.json().catch(() => ({ items: [] }))).items ?? []
  return items.map((i: { title: string }) => i.title).filter((t: string) => String(t).startsWith(tag))
}

test('팝업 대상(audience)+위치(area) 필터', async ({ playwright }) => {
  const admin = await playwright.request.newContext()
  const login = await admin.post(`${API}/api/admin/auth/login`, { data: { mb_id: 'admin_e2e', password: '1234!' } })
  test.skip(!login.ok(), 'admin 세션 없음')

  const tag = `E2EAUD${Date.now()}`
  const now = Date.now()
  const mk = async (aud: string): Promise<number> => {
    const r = await admin.post(`${API}/api/admin/popup-layers`, {
      data: {
        device: 'both',
        starts_at: new Date(now - 3_600_000).toISOString(),
        ends_at: new Date(now + 86_400_000).toISOString(),
        title: `${tag}_${aud}`,
        is_active: true,
        audience: aud,
      },
    })
    return Number((await r.json()).id)
  }

  const ids: number[] = []
  try {
    ids.push(await mk('all'), await mk('member'), await mk('counselor'))

    // 1) 익명
    const anon = await playwright.request.newContext()
    const anonHome = await titles(anon, 'home', tag)
    expect(anonHome, '익명 home: all 노출').toContain(`${tag}_all`)
    expect(anonHome, '익명 home: member 제외').not.toContain(`${tag}_member`)
    expect(anonHome, '익명 home: counselor 제외').not.toContain(`${tag}_counselor`)
    const anonCsr = await titles(anon, 'counselor', tag)
    expect(anonCsr, '익명 counselor영역: 우리 counselor 안보임').not.toContain(`${tag}_counselor`)
    await anon.dispose()

    // 2) 상담사 계정(dummy_01)
    const csr = await playwright.request.newContext()
    const cl = await csr.post(`${API}/api/user/auth/login`, { data: { mb_id: 'dummy_01', password: 'dummy_pass_2026!' } })
    expect(cl.ok(), '상담사 로그인').toBeTruthy()
    const csrHome = await titles(csr, 'home', tag)
    expect(csrHome, '상담사 home: all').toContain(`${tag}_all`)
    expect(csrHome, '상담사 home: member').toContain(`${tag}_member`)
    expect(csrHome, '상담사 home: counselor 제외').not.toContain(`${tag}_counselor`)
    const csrArea = await titles(csr, 'counselor', tag)
    expect(csrArea, '상담사영역: counselor 노출').toContain(`${tag}_counselor`)
    expect(csrArea, '상담사영역: all 노출').toContain(`${tag}_all`)
    expect(csrArea, '상담사영역: member 제외').not.toContain(`${tag}_member`)
    await csr.dispose()
  } finally {
    for (const id of ids) await admin.delete(`${API}/api/admin/popup-layers/${id}`).catch(() => undefined)
    await admin.dispose()
  }
})
