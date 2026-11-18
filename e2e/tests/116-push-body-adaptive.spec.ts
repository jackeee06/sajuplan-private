import { test, expect } from '@playwright/test'
import { skipIfAdminLoginFailed } from '../helpers/admin-skip'

/**
 * 알림 보내기(수동) — 본문 칸 채널 적응 + 사이드바 메뉴 순서 (2026-06-25).
 *
 *  1. 채널이 "인앱만"이면 본문 한도 1000자(길게) / "푸시 포함"이면 200자(짧게)
 *  2. 채널 선택이 "발송 대상" 바로 아래에 위치(본문 위)
 *  3. 사이드바에서 "알림톡 발송(수동)"이 "알림톡 템플릿(자동)" 아래로 내려감
 */

async function login(page: import('@playwright/test').Page) {
  await page.goto('/mng/push-notifications')
  if (page.url().includes('/mng/login')) {
    await page.getByPlaceholder('admin').fill('admin')
    await page.getByPlaceholder('비밀번호를 입력하세요').fill('test1234!')
    await page.getByRole('button', { name: '로그인' }).click()
    await expect(page).not.toHaveURL(/\/mng\/login/, { timeout: 10_000 })
    await page.goto('/mng/push-notifications')
  }
}

test.use({ viewport: { width: 1366, height: 900 } })

test.describe('알림 본문 적응 + 메뉴 순서', () => {
  test.beforeEach(skipIfAdminLoginFailed)

  test('인앱만=길게(1000) / 푸시 포함=짧게(200), 채널은 본문 위', async ({ page }) => {
    await login(page)
    await page.waitForLoadState('networkidle').catch(() => {})

    // 기본: 인앱만(푸시 OFF) → 본문 한도 1000자 + "길게" 안내
    await expect(page.getByText('0/1000자')).toBeVisible({ timeout: 15_000 })
    const bigBody = page.getByPlaceholder(/길게 써도 됩니다/)
    await expect(bigBody).toBeVisible()

    // 채널 위치 검증 — "보낼 방법(채널)" 라벨이 "본문" 라벨보다 위에 있어야 함
    const chY = await page.getByText('보낼 방법 (채널)').boundingBox()
    const bodyY = await page.getByText('본문 (선택)').boundingBox()
    expect(chY && bodyY && chY.y < bodyY.y, '채널이 본문보다 위에 있어야 함').toBeTruthy()

    // 푸시 켜기 → 한도 200자 + "짧게" 안내로 전환
    await page.locator('label:has-text("푸시(FCM)") input[type=checkbox]').check()
    await expect(page.getByText('0/200자')).toBeVisible()
    await expect(page.getByPlaceholder(/짧게 쓰세요/)).toBeVisible()
  })

  test('사이드바 — 알림톡 발송(수동)이 알림톡 템플릿(자동) 아래', async ({ page }) => {
    await login(page)
    // /push-notifications 에 있으므로 "알림" 그룹은 펼쳐진 상태
    const tmpl = page.getByRole('link', { name: /알림톡 템플릿\(자동\)/ })
    const bulk = page.getByRole('link', { name: /알림톡 발송\(수동\)/ })
    await expect(tmpl).toBeVisible({ timeout: 10_000 })
    await expect(bulk).toBeVisible()
    const tY = await tmpl.boundingBox()
    const bY = await bulk.boundingBox()
    expect(tY && bY && bY.y > tY.y, '발송(수동)이 템플릿(자동)보다 아래여야 함').toBeTruthy()
  })
})
