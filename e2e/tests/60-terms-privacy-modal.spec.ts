import { test, expect, request } from '@playwright/test'

/**
 * [2026-06-11] 약관/개인정보처리방침 모달이 실제로 본문을 띄우는지 검증.
 *
 * 버그(수정됨): TermsModal/CounselorApplyNew 가 bare `/api/...` 로 fetch → 프론트 도메인은
 *   /api 를 프록시하지 않아 SPA index.html(200 text/html)을 반환 → r.json() 파싱 실패 →
 *   "불러오기 실패" 만 뜨고 약관 본문이 안 보였다. → `${API_BASE}/...` 로 수정.
 *
 * 이 spec 은 ① API 가 JSON 을 준다 ② 프론트 bare 경로는 HTML 을 준다(함정 박제)
 *   ③ 회원가입 화면에서 모달을 열면 본문이 보이고 "불러오기 실패" 가 없다 를 확인.
 */

const API = 'https://api.sajuplan.com'
const FRONT = 'https://sajuplan.com'

test.describe('약관/개인정보 — API 응답', () => {
  for (const slug of ['terms', 'privacy'] as const) {
    test(`API ${slug} → JSON 200 + content`, async () => {
      const ctx = await request.newContext()
      const r = await ctx.get(`${API}/api/user/pages/${slug}`)
      expect(r.status()).toBe(200)
      expect(r.headers()['content-type']).toContain('application/json')
      const j = await r.json()
      console.log(`[api ${slug}]`, j.title, 'len=', (j.content || '').length)
      expect(j.content, '약관 본문이 비어있음').toBeTruthy()
      expect((j.content as string).length).toBeGreaterThan(50)
      await ctx.dispose()
    })
  }

  test('함정 박제: 프론트 도메인 bare /api/ 는 HTML 을 반환한다', async () => {
    const ctx = await request.newContext()
    const r = await ctx.get(`${FRONT}/api/user/pages/terms`)
    console.log('[front bare /api]', r.status(), r.headers()['content-type'])
    // 200 이지만 JSON 이 아니라 SPA index.html — 그래서 bare 경로는 절대 쓰면 안 됨.
    expect(r.headers()['content-type']).toContain('text/html')
    await ctx.dispose()
  })
})

test.describe('약관/개인정보 — 회원가입 화면 모달 렌더', () => {
  test.use({ viewport: { width: 375, height: 812 }, storageState: { cookies: [], origins: [] } })

  test('회원가입에서 약관/개인정보 모달 본문이 보인다 (불러오기 실패 없음)', async ({ page }) => {
    await page.goto('/signup', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)

    // 약관 동의 행의 "자세히 보기" 버튼(aria-label)으로 모달 오픈.
    const moreBtns = page.locator('[aria-label="자세히 보기"]')
    const n = await moreBtns.count()
    console.log('[signup] "자세히 보기" 버튼 수:', n)
    expect(n, '회원가입 화면에 약관 보기 버튼이 없음 — 화면 구조 변경').toBeGreaterThan(0)

    await moreBtns.first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    // 핵심 단언: "불러오기 실패" 가 없어야 하고, 약관 조항 본문이 보여야 한다.
    await expect(dialog.getByText(/불러오기 실패/)).toHaveCount(0)
    await expect(dialog.getByText(/제\s*1\s*조|목적|개인정보/)).toBeVisible({ timeout: 5000 })
  })
})

test.describe('약관/개인정보 — 홈 푸터 링크 (죽은 href=# 수정)', () => {
  test.use({ viewport: { width: 375, height: 812 }, storageState: { cookies: [], origins: [] } })

  for (const [label, kw] of [['이용약관', /제\s*1\s*조|목적/], ['개인정보취급방침', /개인정보|수집/]] as const) {
    test(`홈 푸터 "${label}" 탭 → 모달 본문 표시`, async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(2000)
      const link = page.getByRole('button', { name: label }).first()
      await link.scrollIntoViewIfNeeded()
      await link.click()
      const dialog = page.getByRole('dialog')
      await expect(dialog, `홈 푸터 ${label} 탭이 모달을 안 엶 (죽은 링크 재발)`).toBeVisible({ timeout: 4000 })
      await expect(dialog.getByText(/불러오기 실패/)).toHaveCount(0)
      await expect(dialog.getByText(kw)).toBeVisible({ timeout: 5000 })
    })
  }
})
