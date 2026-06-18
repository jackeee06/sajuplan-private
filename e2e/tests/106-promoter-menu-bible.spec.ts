import { test, expect } from '@playwright/test'

/**
 * 모집인 — 전체메뉴 등록 + 메뉴→바이블 deep-link (2026-06-18).
 *  - 전체메뉴(/all-menus)에 "모집인 관리(서포터즈)" 노출 + 📖 바이블 deep-link
 *  - 바이블 ?slug= 진입으로 모집인 문서(01 개요 / 03 신규)가 열림 (handbook 동기화 반영 확인)
 * storageState: admin (global-setup)
 */

test('전체메뉴 — "모집인 관리" 노출 + 바이블 deep-link(promoter/01-overview)', async ({ page }) => {
  await page.goto('/mng/all-menus')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('body')).toContainText('모집인 관리')
  // HANDBOOK_MAP 매핑이 적용돼 해당 메뉴에 바이블 deep-link(a[href*=promoter/01-overview]) 가 걸림
  await expect(page.locator('a[href*="slug=promoter/01-overview"]').first()).toHaveCount(1)
})

test('바이블 deep-link — ?slug=promoter/01-overview 진입 시 모집인 개요 문서', async ({ page }) => {
  await page.goto('/mng/handbook?slug=promoter/01-overview')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('body')).toContainText(/모집인|서포터즈/)
})

test('바이블 — 신규 03 문서(자가신청·사후입력) 동기화 반영', async ({ page }) => {
  await page.goto('/mng/handbook?slug=promoter/03-signup-attribution')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('body')).toContainText(/자가신청|사후 입력|추천코드/)
})
