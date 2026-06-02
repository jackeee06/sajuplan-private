import { test, expect } from '@playwright/test'
import { skipIfAdminLoginFailed } from '../helpers/admin-skip'

/**
 * 주요 admin 페이지 렌더링 검증 — 페이지 로드 + JS 에러 없음.
 *
 * 매 배포 후 핵심 admin 페이지 깨지지 않았는지 빠르게 검증.
 * 단순 navigation + 첫 화면 렌더만 검증 (저장/수정 X — read-only).
 */

const ADMIN = 'admin'
const PW = 'test1234!'

const isExpectedError = (msg: string) =>
  /Failed to load resource.*status of 401|status of 404 \(\)/.test(msg)

test.describe('주요 admin 페이지 렌더링', () => {
  test.beforeEach(skipIfAdminLoginFailed)
  test.beforeEach(async ({ page }) => {
    // storageState 로 이미 로그인 — dashboard 진입 시 redirect 되면 form 채우기.
    await page.goto('/mng/dashboard')
    if (page.url().includes('/mng/login')) {
      await page.getByPlaceholder('admin').fill(ADMIN)
      await page.getByPlaceholder('비밀번호를 입력하세요').fill(PW)
      await page.getByRole('button', { name: '로그인' }).click()
      await expect(page).not.toHaveURL(/\/mng\/login/, { timeout: 10_000 })
    }
  })

  const pages = [
    { path: '/mng/dashboard', heading: /대시보드/ },
    { path: '/mng/members/customers', heading: /고객/ },
    { path: '/mng/members/counselors', heading: /상담사/ },
    { path: '/mng/consultations', heading: /상담|사용/ },
    { path: '/mng/refunds', heading: /환불/ },
    { path: '/mng/payments', heading: /결제/ },
    { path: '/mng/settlements', heading: /정산/ },
    { path: '/mng/grade', heading: /등급/ },
    { path: '/mng/settings', heading: /기본환경설정/ },
  ]

  for (const { path, heading } of pages) {
    test(`${path} 페이지 로드 + JS 에러 없음`, async ({ page }) => {
      const consoleErrors: string[] = []
      page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
      page.on('console', (msg) => {
        if (msg.type() === 'error' && !isExpectedError(msg.text())) {
          consoleErrors.push(`console.error: ${msg.text()}`)
        }
      })
      await page.goto(path)
      // networkidle 못 도달해도 OK (chart polling 등). domcontentloaded 만 보장.
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({ timeout: 15_000 })
      expect(consoleErrors, `${path}: ${consoleErrors.join(' / ')}`).toHaveLength(0)
    })
  }
})
