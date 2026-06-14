import { test, expect } from '@playwright/test'

/**
 * [2026-06-14] 상세화면 타임라인 — 문의 대응용.
 *  A) 상담사 상세 → "💰 수익금 타임라인" 펼치면 건별(날짜·상담시간·대상·m2net실과금·적립) 렌더.
 *     point_history(earning) 기준이라 선결제(amt=0)도 실제 적립이 보임.
 *  B) 고객 상세 → "💰 코인 타임라인" 펼치면 증감·사유·잔액 렌더.
 * admin 세션(storageState.json) 없으면 graceful skip.
 */

test.use({ storageState: 'storageState.json', viewport: { width: 1400, height: 1000 } })

test.describe('상세화면 코인/수익 타임라인', () => {
  test('A) 상담사 상세 — 수익금 타임라인 펼침 + 건별 렌더', async ({ page }) => {
    const earningReqs: string[] = []
    page.on('request', (r) => {
      if (/\/admin\/members\/counselors\/\d+\/earning-history/.test(r.url())) earningReqs.push(r.url())
    })
    // 라온선생(123) — 실제 수익금 22건 보유
    await page.goto('/mng/members/counselors/123', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    if (/\/mng\/login/.test(page.url())) test.skip(true, 'admin 세션 없음')

    const header = page.getByText('💰 수익금 타임라인', { exact: false }).first()
    await expect(header, '수익금 타임라인 섹션 존재').toBeVisible({ timeout: 8000 })
    await header.click()
    await page.waitForTimeout(2000)

    expect(earningReqs.length, 'earning-history API 호출됨').toBeGreaterThan(0)
    // 사용(상담)내역과 동일 포맷 컬럼
    await expect(page.getByText('상담시간', { exact: false }).first(), '상담시간 컬럼').toBeVisible({ timeout: 6000 })
    await expect(page.getByText('상담사수익금', { exact: false }).first(), '상담사수익금 컬럼').toBeVisible()
    // 사주플랜매출(회사 매출)은 슈퍼관리자 전용 — E2E 는 비-슈퍼(admin_e2e)라 숨겨져야 함
    await expect(page.getByText('사주플랜매출', { exact: false }), '비-슈퍼는 사주플랜매출 숨김').toHaveCount(0)
    // 헤드라인: 라이브 잔액 기반 "현재 받을 수 있는 총 수익금" (합계 아님 — 정산 후에도 정확)
    await expect(page.getByText('현재 받을 수 있는 총 수익금', { exact: false }).first(), '라이브 잔액 헤드라인').toBeVisible()
  })

  test('B) 고객 상세 — 코인 타임라인 펼침 + 증감/사유 렌더', async ({ page }) => {
    const histReqs: string[] = []
    page.on('request', (r) => {
      if (/\/admin\/members\/customers\/\d+\/point-history/.test(r.url())) histReqs.push(r.url())
    })
    // 최순덕(130) — 충전·차감·환불 내역 보유
    await page.goto('/mng/members/customers/130', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    if (/\/mng\/login/.test(page.url())) test.skip(true, 'admin 세션 없음')

    const header = page.getByText('💰 코인 타임라인', { exact: false }).first()
    await expect(header, '코인 타임라인 섹션 존재').toBeVisible({ timeout: 8000 })
    await header.click()
    await page.waitForTimeout(2000)

    expect(histReqs.length, 'point-history API 호출됨').toBeGreaterThan(0)
    await expect(page.getByText('사유', { exact: false }).first(), '사유 컬럼').toBeVisible({ timeout: 6000 })
    await expect(page.getByText('잔액', { exact: false }).first(), '잔액 컬럼').toBeVisible()
  })
})
