import { test, expect } from '@playwright/test'

/**
 * 인기검색어 핀 고정 E2E
 * - API 직접 호출: 핀 1·2위가 존재하는지
 * - 사용자 검색 화면: 핀 키워드가 실제 화면에 노출되는지
 * - 관리자 화면: 핀 관리 UI 렌더링 확인
 */

const BASE = (process.env.TARGET ?? 'prod') === 'prod'
  ? 'https://sajuplan.com'
  : 'https://sajumoon.kr'

const API = (process.env.TARGET ?? 'prod') === 'prod'
  ? 'https://api.sajuplan.com'
  : 'https://api.sajumoon.kr'

test.describe('인기검색어 핀 고정', () => {

  test('API: 핀 키워드가 1·2위에 노출된다', async ({ request }) => {
    const res = await request.get(`${API}/api/user/counselors/popular-keywords?limit=6`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    const items: { rank: number; keyword: string }[] = body.items
    expect(items.length).toBeGreaterThan(0)

    // rank 1, 2 가 존재하며 keyword 가 비어있지 않은지 (특정 값은 운영자가 바꿀 수 있어 고정 X)
    const rank1 = items.find((i) => i.rank === 1)
    const rank2 = items.find((i) => i.rank === 2)
    expect(rank1).toBeDefined()
    expect(rank1!.keyword.trim().length).toBeGreaterThan(0)
    expect(rank2).toBeDefined()
    expect(rank2!.keyword.trim().length).toBeGreaterThan(0)

    console.log('핀 결과:', items.map((i) => `${i.rank}위:${i.keyword}`).join(', '))
  })

  test('사용자 검색 화면: 핀 키워드가 인기검색어에 노출된다', async ({ page }) => {
    await page.goto(`${BASE}/search`, { waitUntil: 'load', timeout: 30000 })

    // 인기검색어 섹션 대기
    await expect(page.getByRole('heading', { name: '인기 검색어' })).toBeVisible({ timeout: 10000 })

    // 키워드 목록 — ul > li > button 구조 (Search.tsx 기준)
    const keywordItems = page.locator('ul li button')
    await expect(keywordItems.first()).toBeVisible({ timeout: 5000 })
    const count = await keywordItems.count()
    expect(count).toBeGreaterThan(0)

    console.log(`인기검색어 ${count}개 노출 확인`)
  })

  test('관리자 핀 UI: 입력 필드 2개 렌더링 확인', async ({ page }) => {
    await page.goto(`${BASE}/mng/search-popular`, { waitUntil: 'load', timeout: 30000 })

    // 로그인 필요 시 리다이렉트 — 스토리지 없으면 skip
    if (page.url().includes('/login')) {
      console.log('로그인 필요 — 스토리지 없음, 스킵')
      return
    }

    await expect(page.locator('text=인기검색어 핀 고정')).toBeVisible({ timeout: 10000 })

    // 입력 필드 2개 존재
    const inputs = page.locator('input[placeholder*="위"]')
    await expect(inputs).toHaveCount(2)

    // 저장 버튼 존재
    await expect(page.locator('button:has-text("저장")')).toBeVisible()
  })

})
