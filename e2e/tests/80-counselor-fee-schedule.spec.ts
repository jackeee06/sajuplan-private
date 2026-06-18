import { test, expect, request } from '@playwright/test'

/**
 * 실시간 상담수수료 — 상담사 마이페이지 신규 메뉴 엄격검증
 *
 * 검증 포인트:
 *   1. GET /api/user/counselor-mypage/grade/fee-schedule — 등급별 정책표 응답 구조
 *   2. 시간당 상담료 = 고객이용료 × 120 × 정산률 (서버 계산 정확성)
 *   3. 상담사 마이페이지에 "실시간 상담수수료" 메뉴 노출 + 클릭 이동
 *   4. 수수료 페이지 — 표(등급/고객이용료/시간당 상담료) + 홍보 이미지 렌더
 *   5. /img/sunggup.jpg 정상 로드 (404 아님)
 */

const API = 'https://api.sajuplan.com'
const GRADES = ['preliminary', 'partner1', 'partner2', 'partner3', 'partner4', 'partner5']

test.describe('실시간 상담수수료 API', () => {
  test('fee-schedule — 응답 구조 + 시간당 상담료 계산 검증', async () => {
    const ctx = await request.newContext({ storageState: 'user_dual_storage.json' })

    const resp = await ctx.get(`${API}/api/user/counselor-mypage/grade/fee-schedule`)
    expect(resp.status()).toBe(200)

    const rows = await resp.json() as Array<{
      grade: string
      grade_label: string
      threshold_hours: number
      revenue_rate: number
      options: Array<{ customer_fee: number; hourly_earning: number }>
    }>

    // 6개 등급 전부 + 순서
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.map((r) => r.grade)).toEqual(GRADES)

    // 예비파트너 임계값 0
    expect(rows[0].threshold_hours).toBe(0)

    for (const r of rows) {
      expect(GRADES).toContain(r.grade)
      expect(typeof r.grade_label).toBe('string')
      expect(r.grade_label.length).toBeGreaterThan(0)
      // 정산률 0~1
      expect(r.revenue_rate).toBeGreaterThan(0)
      expect(r.revenue_rate).toBeLessThanOrEqual(1)
      // 단가 옵션 1개 이상
      expect(r.options.length).toBeGreaterThan(0)
      for (const o of r.options) {
        expect(o.customer_fee).toBeGreaterThan(0)
        // 시간당 상담료 = 고객이용료 × 120 × 정산률 (반올림)
        const expected = Math.round(o.customer_fee * 120 * r.revenue_rate)
        expect(o.hourly_earning).toBe(expected)
      }
      console.log(`[OK] ${r.grade_label}: ${r.threshold_hours}h~, rate=${r.revenue_rate}, opts=${r.options.length}`)
    }

    await ctx.dispose()
  })

  test('fee-schedule — 미인증은 401', async () => {
    const ctx = await request.newContext() // no storageState
    const resp = await ctx.get(`${API}/api/user/counselor-mypage/grade/fee-schedule`)
    expect(resp.status()).toBe(401)
    await ctx.dispose()
  })
})

test.describe('실시간 상담수수료 페이지', () => {
  test.use({ storageState: 'user_dual_storage.json' })

  test('상담사 마이페이지에 메뉴 노출 + 클릭 이동', async ({ page }) => {
    await page.goto('/counselor/mypage', { waitUntil: 'domcontentloaded' })
    expect(page.url()).not.toContain('/login')

    const menu = page.getByRole('link', { name: /실시간 상담수수료/ })
    await expect(menu).toBeVisible()
    // 메뉴가 페이지 하단에 있어 뷰포트 밖일 수 있음 — 스크롤 후 클릭 (팝업 오버레이 회피)
    await menu.scrollIntoViewIfNeeded()
    await menu.click()

    await expect(page).toHaveURL(/\/counselor\/mypage\/fee-schedule/, { timeout: 15000 })
    console.log('[OK] 메뉴 클릭 → 수수료 페이지 이동')
  })

  test('수수료 페이지 — 라이브 배너 + 표 + 홍보 이미지 렌더', async ({ page }) => {
    await page.goto('/counselor/mypage/fee-schedule', { waitUntil: 'domcontentloaded' })
    expect(page.url()).not.toContain('/login')

    // ① 라이브 승급 배너 — 핵심 메시지 강조
    await expect(page.getByText('실시간 승급 — 시간만 채우면 바로!')).toBeVisible()
    // 본인 등급 "현재" 마커 (상담사 세션이면 항상 노출)
    await expect(page.getByText('현재', { exact: true })).toBeVisible()
    console.log('[OK] 라이브 승급 배너 + 현재 등급 마커')

    // 타이틀 배너
    await expect(page.getByText('사주플랜 상담수수료')).toBeVisible()

    // 표 컬럼 헤더 (<th> → columnheader)
    await expect(page.getByRole('columnheader', { name: '달성시간' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '고객이용료' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '시간당 상담료' })).toBeVisible()

    // 등급 라벨 (예비파트너 + 파트너5 존재)
    await expect(page.getByRole('cell', { name: '예비파트너' })).toBeVisible()
    await expect(page.getByRole('cell', { name: '파트너5' })).toBeVisible()

    // 원 단위 금액 셀 최소 1개
    const wonCells = page.getByRole('cell', { name: /원$/ })
    expect(await wonCells.count()).toBeGreaterThan(0)

    // 홍보 이미지 — 실제 로드 성공(naturalWidth>0) 확인
    const img = page.locator('img[src="/img/sunggup.jpg"]')
    await expect(img).toBeVisible()
    const naturalWidth = await img.evaluate((el) => (el as HTMLImageElement).naturalWidth)
    expect(naturalWidth).toBeGreaterThan(0)
    console.log(`[OK] 표 + 홍보 이미지 렌더 (img naturalWidth=${naturalWidth})`)
  })
})
