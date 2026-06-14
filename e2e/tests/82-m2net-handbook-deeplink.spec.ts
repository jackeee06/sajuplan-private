import { test, expect } from '@playwright/test'

/**
 * [2026-06-14] m2net 완전판 운영바이블 deep-link 검증.
 *
 * 배경: m2net push(돈의 심장) 지식을 _HANDBOOK/payment/01-m2net-relation 완전판으로 박제하고,
 *       전체메뉴의 "사용(상담) 내역"(/consultations) → 이 문서로 deep-link 연결했다.
 *
 * 검증:
 *   A) 전체메뉴에 payment/01-m2net-relation 으로 가는 📖 deep-link 앵커가 존재한다 (consultations 연결).
 *   B) /mng/handbook?slug=payment/01-m2net-relation 진입 시 해당 문서 item API 호출 + m2net 본문 렌더.
 *
 * admin 세션(storageState.json) 없으면 graceful skip.
 */

test.use({ storageState: 'storageState.json', viewport: { width: 1280, height: 900 } })

test.describe('m2net 운영바이블 deep-link', () => {
  test('A) 전체메뉴에 m2net 문서 deep-link 앵커 존재', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/mng/all-menus', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    if (/\/mng\/login/.test(page.url())) test.skip(true, 'admin 세션 없음')

    expect(errors, 'all-menus JS 예외 0').toEqual([])
    // 📖 링크는 hover 시 보이지만 DOM 엔 항상 존재 — href 로 직접 탐색
    const link = page.locator('a[href*="slug=payment/01-m2net-relation"]')
    await expect(link.first(), 'consultations → m2net 문서 deep-link 앵커').toHaveCount(1)
  })

  test('B) ?slug=payment/01-m2net-relation 가 m2net 문서를 연다', async ({ page }) => {
    const itemReqs: string[] = []
    page.on('request', (r) => {
      if (/\/admin\/handbook\/item\?slug=/.test(r.url())) itemReqs.push(decodeURIComponent(r.url()))
    })
    await page.goto('/mng/handbook?slug=payment/01-m2net-relation', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    if (/\/mng\/login/.test(page.url())) test.skip(true, 'admin 세션 없음')

    expect(
      itemReqs.some((u) => u.includes('slug=payment/01-m2net-relation')),
      `?slug= 가 m2net 문서 item API 호출 유도 (호출: ${itemReqs.join(', ') || '없음'})`,
    ).toBeTruthy()

    // 본문 렌더 — m2net + 이번 세션 박제 핵심 문구(선결제 amt=0 정상)
    await expect(page.getByText('m2net', { exact: false }).first(), 'm2net 본문 렌더').toBeVisible({ timeout: 8000 })
    await expect(
      page.getByText('선결제', { exact: false }).first(),
      '선결제 정상상태 안내 렌더',
    ).toBeVisible({ timeout: 8000 })
  })
})
