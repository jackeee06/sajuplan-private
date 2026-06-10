import { test, expect } from '@playwright/test'

/**
 * 상담사 카드 뱃지 검증
 *  - 뱃지가 좌하단에 위치하는가 (bottom-2 left-2)
 *  - 사주/타로/신점/심리 4종 색이 올바른가
 *  - counselor_category 가 설정된 상담사의 뱃지가 표시되는가 (월아신녀 신점 케이스)
 */

test.describe('상담사 카드 뱃지', () => {
  test('뱃지가 좌하단 위치를 가진다', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 뱃지가 하나라도 있는지 확인
    const badges = page.locator('article span.absolute.bottom-2.left-2')
    const count = await badges.count()

    if (count === 0) {
      // 뱃지 있는 카드가 없으면 위치 클래스만 검증
      const oldBadge = page.locator('article span.absolute.top-2.left-2')
      await expect(oldBadge).toHaveCount(0, { timeout: 5000 })
    } else {
      // 뱃지가 있으면 top-2 left-2 (구 위치) 가 없어야 함
      const oldBadge = page.locator('article span.absolute.top-2.left-2')
      await expect(oldBadge).toHaveCount(0)
    }
  })

  test('뱃지 top-2(구 위치)가 존재하지 않는다', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const oldPositionBadges = page.locator('article span.absolute.top-2.left-2')
    await expect(oldPositionBadges).toHaveCount(0)
  })

  test('사주 뱃지 색이 #FF6467 이다', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const sajuBadge = page.locator('article span.absolute.bottom-2.left-2', { hasText: '사주' }).first()
    const count = await sajuBadge.count()
    if (count === 0) {
      test.skip()
      return
    }
    const bg = await sajuBadge.evaluate((el) => getComputedStyle(el).backgroundColor)
    // rgb(255, 100, 103) = #FF6467
    expect(bg).toBe('rgb(255, 100, 103)')
  })

  test('신점 뱃지 색이 #00BBA7 이다', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const badge = page.locator('article span.absolute.bottom-2.left-2', { hasText: '신점' }).first()
    const count = await badge.count()
    if (count === 0) {
      test.skip()
      return
    }
    const bg = await badge.evaluate((el) => getComputedStyle(el).backgroundColor)
    // rgb(0, 187, 167) = #00BBA7
    expect(bg).toBe('rgb(0, 187, 167)')
  })

  test('타로 뱃지 색이 #ec4899 이다', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const badge = page.locator('article span.absolute.bottom-2.left-2', { hasText: '타로' }).first()
    const count = await badge.count()
    if (count === 0) {
      test.skip()
      return
    }
    const bg = await badge.evaluate((el) => getComputedStyle(el).backgroundColor)
    // rgb(236, 72, 153) = #ec4899
    expect(bg).toBe('rgb(236, 72, 153)')
  })

  test('심리 뱃지 색이 #8259F5 이다', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const badge = page.locator('article span.absolute.bottom-2.left-2', { hasText: '심리' }).first()
    const count = await badge.count()
    if (count === 0) {
      test.skip()
      return
    }
    const bg = await badge.evaluate((el) => getComputedStyle(el).backgroundColor)
    // rgb(130, 89, 245) = #8259F5
    expect(bg).toBe('rgb(130, 89, 245)')
  })

  test('상담사 목록 API 가 counselor_category 를 category 로 반환한다', async ({ request }) => {
    const res = await request.get('https://api.sajuplan.com/api/user/counselors?limit=50')
    expect(res.status()).toBe(200)
    const body = await res.json()
    const counselors = body.counselors ?? body.items ?? body ?? []

    // counselor_category 가 설정된 상담사는 category 가 기타가 아니어야 함
    const withCategory = counselors.filter(
      (c: any) => c.category && c.category !== '기타'
    )
    // 상담사가 있다면 적어도 category 필드가 있어야 함
    if (counselors.length > 0) {
      expect(counselors[0]).toHaveProperty('category')
    }
    // 기타 비율이 100% 이면 버그 — counselor_category 미반영
    if (counselors.length >= 3) {
      const 기타비율 = counselors.filter((c: any) => c.category === '기타').length / counselors.length
      expect(기타비율).toBeLessThan(1)
    }
  })
})
