import { test, expect, type Page } from '@playwright/test'

/**
 * [정산 단순화 2026-06-10] 미리보기 손가락 동작 엄격검증.
 *
 * 실제 관리자 클릭 그대로 재현 (jackee, member_id=91 — 실행 전 SSH 로 pending 리셋 전제):
 *   1) [이번 달 미리보기] 토글
 *   2) jackee [정산하기] 클릭 → settle-now API 201 → (새로고침) 지급완료 + 무효화 버튼
 *   3) jackee [무효화] 클릭 → mark-voided API 200 → (새로고침) 무효 + 정산하기 재등장(복구)
 *
 * 클릭 직후 자동갱신 타이밍에 의존하지 않도록, 각 동작은 API 응답으로 확정하고
 * 화면 상태는 새로고침 후 확인한다. admin 세션 없으면 자동 skip.
 */

test.describe.configure({ retries: 0 })

async function enterPreview(page: Page) {
  await page.getByRole('button', { name: '이번 달 미리보기' }).click()
  await expect(page.locator('th', { hasText: '정산예상금액' })).toBeVisible({ timeout: 15_000 })
}
const jackeeRow = (page: Page) =>
  page.locator('tr', { has: page.getByRole('link', { name: 'jackee', exact: true }) })

test.describe('정산 미리보기 — 실제 클릭 동작', () => {
  test('미리보기 → [정산하기] → 지급완료 → [무효화] → 무효(복구)', async ({ page }) => {
    page.on('dialog', (d) => {
      if (d.type() === 'prompt') d.accept('E2E 손가락 검증 복구')
      else d.accept()
    })

    await page.goto('/mng/settlements')
    await page.waitForLoadState('domcontentloaded')
    if (page.url().includes('/mng/login')) {
      console.log('[SKIP] admin 세션 없음 — E2E_ADMIN_ID/E2E_ADMIN_PW 설정 후 재실행')
      test.skip()
      return
    }
    await expect(page.getByRole('heading', { name: '정산 현황' })).toBeVisible()

    await enterPreview(page)
    await expect(jackeeRow(page)).toBeVisible({ timeout: 15_000 })
    console.log('[OK] 미리보기 진입 + jackee 행 노출')

    // ── [정산하기] 클릭 → settle-now API 201 ──
    await expect(jackeeRow(page).getByRole('button', { name: '정산하기' })).toBeVisible()
    const [settleResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/settle-now') && r.request().method() === 'POST'),
      jackeeRow(page).getByRole('button', { name: '정산하기' }).click(),
    ])
    expect(settleResp.ok(), `settle-now status=${settleResp.status()}`).toBeTruthy()
    console.log(`[OK] [정산하기] 클릭 → settle-now API ${settleResp.status()}`)

    // 새로고침 후 화면 반영 확인: 지급완료 + 무효화 버튼
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await enterPreview(page)
    await expect(jackeeRow(page).getByText('지급완료', { exact: true }).first()).toBeVisible({ timeout: 15_000 })
    await expect(jackeeRow(page).getByRole('button', { name: '무효화' })).toBeVisible()
    await expect(jackeeRow(page).getByRole('button', { name: '정산하기' })).toHaveCount(0)
    console.log('[OK] 새로고침 후 → 지급완료 + [무효화] 버튼 (수익금 차감 확정)')

    // ── [무효화] 클릭 → mark-voided API 200 ──
    const [voidResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/mark-voided') && r.request().method() === 'PATCH'),
      jackeeRow(page).getByRole('button', { name: '무효화' }).click(),
    ])
    expect(voidResp.ok(), `mark-voided status=${voidResp.status()}`).toBeTruthy()
    console.log(`[OK] [무효화] 클릭 → mark-voided API ${voidResp.status()}`)

    // 새로고침 후 화면 반영 확인: 무효 + 정산하기 재등장(수익금 복구)
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await enterPreview(page)
    await expect(jackeeRow(page).getByText('무효', { exact: true }).first()).toBeVisible({ timeout: 15_000 })
    await expect(jackeeRow(page).getByRole('button', { name: '정산하기' })).toBeVisible()
    console.log('[OK] 새로고침 후 → 무효 + [정산하기] 재등장 (수익금 복구 확정)')
  })
})
