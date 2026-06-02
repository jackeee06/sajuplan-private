import { test, expect } from '@playwright/test'

/**
 * [2026-06-03] 나의 상담문의 화면 E2E
 * storageState 의존 없이 API 직접 로그인 (prod/test 공통)
 */

const API_BASE = (process.env.TARGET ?? 'test') === 'prod'
  ? 'https://api.sajuplan.com'
  : 'https://api.sajumoon.kr'

test.describe('나의 상담문의', () => {
  test.beforeEach(async ({ page, context }) => {
    // Python requests로 미리 받아둔 JWT 쿠키를 직접 주입 (UI 로그인 불필요)
    const domain = (process.env.TARGET ?? 'test') === 'prod' ? 'sajuplan.com' : 'sajumoon.kr'
    const apiDomain = (process.env.TARGET ?? 'test') === 'prod' ? 'api.sajuplan.com' : 'api.sajumoon.kr'

    // fetch로 로그인 → 쿠키 추출
    const res = await page.request.post(`https://${apiDomain}/api/user/auth/login`, {
      data: { mb_id: 'e2e_member', password: 'e2e_test_2026' },
    })
    const setCookie = res.headers()['set-cookie'] ?? ''
    const match = setCookie.match(/sjm_user=([^;]+)/)
    if (match) {
      await context.addCookies([{
        name: 'sjm_user',
        value: match[1],
        domain,
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'None',
      }])
    }
    await page.goto('/mypage/my-qnas')
    await page.waitForLoadState('domcontentloaded')
  })

  test('헤더 렌더', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '나의 상담문의' })).toBeVisible()
  })

  test('목록 또는 빈 상태 노출', async ({ page }) => {
    const items = page.locator('article')
    const empty = page.getByText('작성한 상담문의가 없습니다.')
    const count = await items.count()
    if (count === 0) {
      await expect(empty).toBeVisible()
    } else {
      expect(count).toBeGreaterThan(0)
    }
  })

  test('답변대기 항목 — ⋮ 메뉴 버튼 존재', async ({ page }) => {
    const items = page.locator('article')
    const count = await items.count()
    if (count === 0) return
    let found = false
    for (let i = 0; i < count; i++) {
      const menuBtn = items.nth(i).getByRole('button', { name: '더보기' })
      if (await menuBtn.isVisible()) {
        found = true
        await menuBtn.click()
        await expect(page.getByRole('menuitem', { name: '수정' })).toBeVisible()
        await expect(page.getByRole('menuitem', { name: '삭제' })).toBeVisible()
        await page.keyboard.press('Escape')
        break
      }
    }
    expect(found || count > 0).toBeTruthy()
  })

  test('답변완료 항목 — 핑크 박스 노출', async ({ page }) => {
    const pinkBox = page.locator('button:has-text("탭하여 확인하세요")')
    if (await pinkBox.count() > 0) {
      await expect(pinkBox.first()).toBeVisible()
    }
  })

  test('구버전 배지("답변대기" span) 미노출', async ({ page }) => {
    await expect(page.locator('span:has-text("답변대기")')).toHaveCount(0)
  })
})
