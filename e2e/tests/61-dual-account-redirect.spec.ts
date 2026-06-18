import { test, expect } from '@playwright/test'
import fs from 'fs'

/**
 * 듀얼계정 링크 폴백 검증 (2026-06-12)
 *  - 상담사(jackee=91, 찬물선생)를 고객 화면(/members/customers/91)으로 열면
 *    whois 로 role 확인 후 상담사 화면(/members/counselors/91)으로 자동 리다이렉트.
 */
const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_dual'
fs.mkdirSync(SHOT, { recursive: true })
const MNG = 'https://sajuplan.com/mng'
const API = 'https://api.sajuplan.com/api'

test.use({ viewport: { width: 1366, height: 900 } })

test('whois + 듀얼계정 고객→상담사 자동 리다이렉트', async ({ page, request }) => {
  // 1) whois API: 91 = counselor
  const w = await request.get(`${API}/admin/members/whois/91`)
  expect(w.ok()).toBeTruthy()
  const who = await w.json()
  expect(who.found).toBe(true)
  expect(who.role, 'jackee(91) 가 counselor 가 아님').toBe('counselor')

  // 2) 고객 화면으로 진입 → 상담사 화면으로 자동 이동
  await page.goto(`${MNG}/members/customers/91`)
  await page.waitForLoadState('load').catch(() => {})
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${SHOT}/01_after_redirect.png` })

  expect(page.url(), `상담사 화면으로 리다이렉트 안 됨: ${page.url()}`).toContain('/members/counselors/91')
  // "고객을 찾을 수 없습니다" 가 더 이상 안 보여야
  await expect(page.getByText('고객을 찾을 수 없습니다')).toHaveCount(0)
})
