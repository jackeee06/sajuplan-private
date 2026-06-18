import { test, expect } from '@playwright/test'

/**
 * [2026-06-13] 전체메뉴 ↔ 운영 바이블(_HANDBOOK) 용어 자동 동기화 검증.
 *
 * 배경: 전체메뉴(AllMenus) 검색이 손으로 적은 aliases 에만 의존 → 바이블에 있는 용어가
 *       메뉴에 누락되면 검색이 안 됐다. _HANDBOOK/index.json tags 를 검색 소스로 연결해
 *       바이블 용어면 자동으로 위치(연결 메뉴 + 바이블 문서)가 나오게 함.
 *
 * 검증: 메뉴 aliases 엔 없지만 바이블 tag 에만 있는 용어("이중적립")로 검색하면
 *       "운영 바이블 용어" 섹션이 뜨고 매칭 결과가 나온다.
 */

test.use({ storageState: 'storageState.json' })

test('전체메뉴 검색 — 바이블 전용 용어가 자동으로 잡힌다', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/mng/all-menus')
  await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {})

  // 로그인 가드로 튕기지 않았는지
  await expect(page.getByRole('heading', { name: '전체 메뉴' }), '전체 메뉴 페이지 로드').toBeVisible({ timeout: 15_000 })

  // 바이블에만 있는 용어 검색 (handbook index fetch 후 매칭)
  const box = page.locator('input[type="text"]').first()
  await box.fill('이중적립')
  await page.waitForTimeout(1500) // handbook index 로드 + 매칭

  // "운영 바이블 용어" 섹션이 떠야 함
  await expect(
    page.getByRole('heading', { name: /운영 바이블 용어/ }),
    '바이블 전용 용어 검색 시 바이블 섹션 미출현 — 자동 동기화 안 됨',
  ).toBeVisible({ timeout: 10_000 })

  // 매칭 문서에 연결 메뉴 링크 또는 바이블 보기 링크가 있어야 (위치 이동 가능)
  const body = (await page.locator('body').textContent()) ?? ''
  expect(body, '바이블 매칭 결과에 위치/링크 없음').toMatch(/바이블 보기|충전|결제/)
})
