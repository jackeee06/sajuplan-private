import { test, expect } from '@playwright/test'

/**
 * 인앱 알림(useAlert) 교체 — 영향받은 페이지 렌더 스모크.
 *
 * window.alert → 인앱 AlertModal 교체로 각 페이지에 useAlert 훅을 추가했다.
 * 훅 추가가 페이지 렌더를 깨지 않는지(런타임 크래시 없음) 확인한다.
 * (인앱 모달 노출 메커니즘 자체는 81-counselor-bank-confirm 에서 검증됨)
 */
test.describe('인앱 알림 교체 — 페이지 렌더 스모크', () => {
  test.use({ storageState: 'user_dual_storage.json' })

  const pages = [
    { path: '/notifications', name: '알림함' },
    { path: '/mypage/charge', name: '코인 충전' },
    { path: '/counselor/mypage/referral', name: '추천 현황' },
    { path: '/mypage/counselor-apply', name: '상담사 신청 목록' },
    { path: '/counselor/mypage/reviews', name: '후기 관리' },
  ]

  for (const { path, name } of pages) {
    test(`${name} (${path}) — 크래시 없이 렌더`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))

      await page.goto(path, { waitUntil: 'domcontentloaded' })
      expect(page.url()).not.toContain('/login')

      // 비동기 로딩 완료까지 대기 — 본문이 로딩 placeholder("불러오는 중…", 20자) 이상으로 채워짐
      await expect
        .poll(async () => (await page.locator('body').textContent())?.length ?? 0, { timeout: 12000 })
        .toBeGreaterThan(40)

      // 페이지 레벨 JS 예외 없어야 함 (= 렌더 크래시 없음, 핵심 검증)
      expect(errors, errors.join('\n')).toEqual([])
      console.log(`[OK] ${name}: ${page.url()}`)
    })
  }
})
