import { test, expect } from '@playwright/test'

/**
 * [2026-06-12] 충전 페이지 "첫 결제 50% 추가 적립" 안내 배너 제거 검증.
 *
 * 배경: 사주플랜페이 결제방법 아래 핑크 박스("첫 결제 시 코인 50% 추가 적립!")는
 *       실제 백엔드 적립 로직이 없는 문구만 있는 배너였다. 사장님 지시로 제거.
 *
 * 검증: /mypage/charge (기본 결제방법=사주플랜페이) 진입 시 해당 문구가 화면에 없어야 한다.
 */

test.use({ storageState: 'user_member_storage.json' })

test('충전 페이지에 "첫 결제 50% 추가 적립" 배너가 없다', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})

  await page.goto('/mypage/charge')
  await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {})

  // 페이지 정상 로드 확인
  await expect(
    page.getByRole('heading', { name: '코인 충전' }),
    '충전 페이지 로드',
  ).toBeVisible({ timeout: 15_000 })

  // 사주플랜페이가 기본 선택 — 과거 이 상태에서 배너가 노출됐었음
  await expect(page.getByText('사주플랜페이').first()).toBeVisible()

  const body = (await page.locator('body').textContent()) ?? ''
  expect(body, '제거된 배너 문구가 여전히 노출됨').not.toContain('첫 결제 시 코인 50% 추가 적립')
  expect(body, '제거된 배너 부가문구가 여전히 노출됨').not.toContain('최초 1회 결제에 한해 제공되는 혜택')
})
