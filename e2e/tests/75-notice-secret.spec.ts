import { test, expect } from '@playwright/test'

/**
 * [2026-06-12] 공지 비공개(is_secret) — 관리자 임시저장 플래그 검증.
 *  비공개 공지는 사용자 목록에 노출되지 않아야 한다. 공개 공지는 노출.
 */
const API = 'https://api.sajuplan.com'

test('공지 비공개(is_secret) — 사용자 목록 노출 제어', async ({ playwright }) => {
  const admin = await playwright.request.newContext()
  const login = await admin.post(`${API}/api/admin/auth/login`, { data: { mb_id: 'admin_e2e', password: '1234!' } })
  test.skip(!login.ok(), 'admin 세션 없음')

  const tag = `E2ENOTICE${Date.now()}`
  const mk = async (secret: boolean): Promise<number> => {
    const r = await admin.post(`${API}/api/admin/notices`, {
      data: { title: `${tag}_${secret ? 'secret' : 'public'}`, content: '<p>t</p>', is_secret: secret },
    })
    return Number((await r.json()).id)
  }

  const ids: number[] = []
  try {
    ids.push(await mk(false), await mk(true))
    const anon = await playwright.request.newContext()
    const r = await anon.get(`${API}/api/user/notices?page=1&limit=100`)
    const body = await r.json()
    const items = body.items ?? body ?? []
    const titles = items.map((i: { title: string }) => i.title).filter((t: string) => String(t).startsWith(tag))
    expect(titles, '공개 공지는 노출').toContain(`${tag}_public`)
    expect(titles, '비공개 공지는 미노출').not.toContain(`${tag}_secret`)
    await anon.dispose()
  } finally {
    for (const id of ids) await admin.delete(`${API}/api/admin/notices/${id}`).catch(() => undefined)
    await admin.dispose()
  }
})
