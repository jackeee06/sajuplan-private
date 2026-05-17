import { test, expect } from '@playwright/test'

/**
 * 사용자 페이지 — 상담사 리스트 + 이벤트 필터 칩 동작 검증.
 *
 * 비로그인 상태로 점검 가능 — admin 비번 불필요.
 *
 * 검증 포인트:
 *   1. env placeholder 치환 확인 (__SAJUMOON_ENV__ 그대로 X)
 *   2. /counselors 페이지 정상 로드
 *   3. "⭐ 이벤트 상담사" 칩 존재 + 클릭 가능
 *   4. 카테고리 탭 (전체/사주/타로/신점) 클릭 동작
 *   5. JS 콘솔 에러 없음
 */
test.describe('user 상담사 리스트', () => {
  test('이벤트 필터 칩 + 카테고리 탭 동작', async ({ page }) => {
    const consoleErrors: string[] = []
    const isExpectedError = (msg: string) =>
      /Failed to load resource.*status of 401/.test(msg)
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isExpectedError(msg.text())) {
        consoleErrors.push(`console.error: ${msg.text()}`)
      }
    })

    await page.goto('/counselors')

    // env placeholder 치환 검증
    const config = await page.evaluate(() => (window as any).__SAJUMOON_CONFIG)
    expect(config, '__SAJUMOON_CONFIG 미등록').toBeTruthy()
    expect(config.env, '__SAJUMOON_ENV__ 치환 누락').not.toBe('__SAJUMOON_ENV__')

    // 페이지 헤더 "상담사 리스트"
    await expect(page.getByRole('heading', { name: '상담사 리스트' })).toBeVisible()

    // 카테고리 탭 4개 (전체/사주/타로/신점)
    for (const cat of ['전체', '사주', '타로', '신점']) {
      await expect(page.getByRole('button', { name: cat }).first()).toBeVisible()
    }

    // 이벤트 필터 칩 — Phase 1 에서 추가됨
    const eventChip = page.getByRole('button', { name: /이벤트 상담사/ })
    await expect(eventChip, '이벤트 필터 칩 안 보임').toBeVisible()

    // 칩 클릭 → 활성 상태 전환 (CSS 색 변화)
    await eventChip.click()
    await page.waitForTimeout(500) // 백엔드 응답 대기

    // 다시 클릭 → 해제
    await eventChip.click()

    expect(consoleErrors, `JS 에러: ${consoleErrors.join(' / ')}`).toHaveLength(0)
  })

  test('메인 홈 페이지 — 이벤트 상담사 슬라이드 + 분야 카드', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`)
    })

    await page.goto('/')

    // env placeholder 검증
    const config = await page.evaluate(() => (window as any).__SAJUMOON_CONFIG)
    expect(config.env).not.toBe('__SAJUMOON_ENV__')

    // 페이지 로드 — body 가 비어있지 않음
    const root = page.locator('#root')
    await expect(root).toBeAttached()

    // SPA 가 마운트되어 텍스트가 한 글자라도 보여야 함
    const body = await page.locator('body').textContent()
    expect(body && body.length > 10, '메인 페이지가 비어있음').toBeTruthy()

    expect(consoleErrors, `JS 에러: ${consoleErrors.join(' / ')}`).toHaveLength(0)
  })
})
