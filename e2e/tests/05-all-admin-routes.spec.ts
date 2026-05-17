import { test, expect, Page } from '@playwright/test'

/**
 * 모든 admin 페이지 자동 렌더 검증.
 *
 * App.tsx 의 정적 Route path 를 모두 나열 — 외부 의존 (사이드바) 없이 안정적.
 * 새 페이지 추가 시 이 list 에만 path 추가하면 됨.
 *
 * 검증:
 *   - HTTP 200 응답
 *   - env placeholder 치환됨
 *   - #root 비어있지 않음 (SPA 마운트 완료)
 *   - 페이지 로드 중 JS 에러 없음
 */

const ADMIN = 'admin'
const PW = 'test1234!'

// 401: 비로그인 상태에서 호출되는 API
// 404: 신규/없는 데이터 조회
// 429: 자동 테스트 자체가 rate limit 에 걸리는 경우 — 페이지 렌더링 본질과 무관
const isExpectedError = (msg: string) =>
  /Failed to load resource.*status of (401|404|429)/.test(msg)

// App.tsx 의 정적 Route path 전체 (동적 :id, :slug 제외)
const ROUTES: string[] = [
  // 대시보드
  '/mng/dashboard',
  // 회원
  '/mng/members/customers',
  '/mng/members/counselors',
  '/mng/members/counselor-apply',
  '/mng/attendance',
  '/mng/grade',
  // 매출
  '/mng/consultations',
  '/mng/refunds',
  '/mng/ops-kpi',
  '/mng/charge-amounts',
  '/mng/payments',
  '/mng/points/history',
  '/mng/settlements',
  // 쿠폰
  '/mng/coupon-zones',
  // 상담관리
  '/mng/posts/review',
  '/mng/review-reports',
  '/mng/chat-history',
  // 게시판
  '/mng/search-keywords',
  '/mng/search-popular',
  '/mng/faqs',
  '/mng/notices',
  '/mng/events',
  '/mng/post-reports',
  '/mng/posts-overview',
  '/mng/posts/qa',
  '/mng/posts/qa_counselor',
  // 알림
  '/mng/push-notifications',
  '/mng/alimtalk-bulk',
  '/mng/alimtalk-templates',
  // 통계
  '/mng/stats',
  // 권한
  '/mng/admin-users',
  // 기타
  '/mng/banners',
  '/mng/popup-layers',
  '/mng/saju-config',
  // 환경설정
  '/mng/settings',
  '/mng/contents',
]

async function loginIfNeeded(page: Page) {
  await page.goto('/mng/dashboard')
  if (page.url().includes('/mng/login')) {
    await page.getByPlaceholder('admin').fill(ADMIN)
    await page.getByPlaceholder('비밀번호를 입력하세요').fill(PW)
    await page.getByRole('button', { name: '로그인' }).click()
    await expect(page).not.toHaveURL(/\/mng\/login/, { timeout: 10_000 })
  }
}

test.describe('모든 admin 페이지 자동 검증', () => {
  test(`총 ${ROUTES.length}개 페이지 모두 정상 로드`, async ({ page }) => {
    test.setTimeout(180_000) // 36 페이지 × ~3초 → 약 2분
    await loginIfNeeded(page)

    const failures: Array<{ path: string; reason: string }> = []
    for (const path of ROUTES) {
      const errors: string[] = []
      const consoleHandler = (msg: any) => {
        if (msg.type() === 'error' && !isExpectedError(msg.text())) {
          errors.push(msg.text().slice(0, 200))
        }
      }
      const pageErrHandler = (e: Error) => {
        errors.push(`pageerror: ${e.message.slice(0, 200)}`)
      }
      page.on('console', consoleHandler)
      page.on('pageerror', pageErrHandler)

      try {
        const resp = await page.goto(path, { timeout: 30_000 })
        if (resp && resp.status() >= 400) {
          failures.push({ path, reason: `HTTP ${resp.status()}` })
          continue
        }
        await page.waitForLoadState('domcontentloaded')
        await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})

        const config = await page.evaluate(() => (window as any).__SAJUMOON_CONFIG)
        if (config?.env === '__SAJUMOON_ENV__') {
          failures.push({ path, reason: 'env placeholder 치환 누락' })
          continue
        }

        const rootText = (await page.locator('#root').textContent()) ?? ''
        if (rootText.trim().length < 20) {
          failures.push({ path, reason: `비어있음 (root.len=${rootText.length})` })
          continue
        }

        if (errors.length > 0) {
          failures.push({ path, reason: `JS: ${errors.slice(0, 2).join(' / ')}` })
          continue
        }
      } catch (e) {
        failures.push({ path, reason: `예외: ${(e instanceof Error ? e.message : String(e)).slice(0, 150)}` })
      } finally {
        page.off('console', consoleHandler)
        page.off('pageerror', pageErrHandler)
      }
      // rate limit 회피 — 페이지 사이 휴식 (default 1200/분 제한 회피)
      await page.waitForTimeout(1500)
    }

    if (failures.length > 0) {
      console.log(`\n❌ ${failures.length}/${ROUTES.length} 실패:`)
      for (const f of failures) console.log(`  ${f.path} → ${f.reason}`)
    } else {
      console.log(`\n✅ ${ROUTES.length}개 페이지 모두 정상`)
    }
    expect(failures, `${failures.length}개 페이지 깨짐`).toEqual([])
  })
})
