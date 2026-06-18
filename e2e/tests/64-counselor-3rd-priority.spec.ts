import { test, expect } from '@playwright/test'

/**
 * [2026-06-11 · 3순위(상담사 기능) 무관용 검증] 코드 정독에서 확정한 버그 재현/회귀.
 *
 *  F1 🔴 CounselorMyMemo — 자체 API_BASE(/api 누락 + 폐기서버 fallback) → 메모 GET/PUT 전부 404.
 *        수정 전: 요청이 https://api.sajuplan.com/user/counselor-mypage/memo (/api 없음) → 404
 *        수정 후: https://api.sajuplan.com/api/user/counselor-mypage/memo → 200
 *  F4 🟡 CounselorMyConsultStats — 직접입력(custom) 날짜 input 2개 + 검색버튼이 375px 가로 오버플로우.
 *        (date input 네이티브 최소폭 + min-w-0/shrink-0 누락)
 *
 * 상담사 세션(dummy_01 = user_counselor_storage.json) 사용.
 * 배포 전 prod 에서 RED(버그 재현) → 배포 후 GREEN(수정 확인) 사이클로 운용.
 */

const MOBILE = { width: 375, height: 812 }

test.describe('3순위 상담사 기능 회귀 (상담사 로그인, 375px)', () => {
  test.use({ viewport: MOBILE, storageState: 'user_counselor_storage.json' })

  test('F1 메모장 — memo API 가 /api 포함 200 응답 (404 회귀 방지)', async ({ page }) => {
    const memoResponses: { url: string; status: number }[] = []
    page.on('response', (r) => {
      if (/counselor-mypage\/memo/.test(r.url())) {
        memoResponses.push({ url: r.url(), status: r.status() })
      }
    })
    await page.goto('/counselor/mypage/memo', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)

    expect(memoResponses.length, 'memo API 호출이 한 번 이상 발생해야 함').toBeGreaterThan(0)
    for (const r of memoResponses) {
      expect(r.url, `memo 호출 URL 에 /api 포함 (실제: ${r.url})`).toContain('/api/user/counselor-mypage/memo')
      expect(r.status, `memo 응답 < 400 (실제 ${r.status} @ ${r.url})`).toBeLessThan(400)
    }
    // 로딩 종료 후 textarea 렌더 확인
    await expect(page.locator('textarea')).toBeVisible({ timeout: 8000 })
  })

  test('F4 상담통계 — 직접입력 날짜 모드에서 375px 가로 오버플로우 없음', async ({ page }) => {
    await page.goto('/counselor/mypage/consult-stats', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)

    const custom = page.getByRole('button', { name: '직접입력' })
    await expect(custom, '직접입력 프리셋 칩 존재').toBeVisible({ timeout: 8000 })
    await custom.click()
    await page.waitForTimeout(600)

    const overflow = await page.evaluate((w) => {
      const el = document.documentElement
      return el.scrollWidth > w + 1 ? el.scrollWidth : 0
    }, MOBILE.width)
    expect(overflow, `375px 가로 오버플로우 (scrollWidth=${overflow})`).toBe(0)
  })
})
