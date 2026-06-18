import { test, expect } from '@playwright/test'

/**
 * 모집인 가상 시딩(jackee promoter id=5) — 관리자 화면 검증 (2026-06-18).
 *  - 모집인 상세: 미정산 기대수익 합계 + 적립 내역 뱃지(미정산/무효) 정상 표시
 *    (status 도메인 'accrued'/'voided' 버그 수정 후)
 *  storageState: admin
 */

test('관리자 모집인 상세(jackee/5) — 미정산 기대수익 + 적립 뱃지(미정산·무효)', async ({ page }) => {
  await page.goto('/mng/promoters/5')
  await page.waitForLoadState('networkidle')
  // 미정산 기대수익 합계가 0 이 아니라 실제 합(12,720)으로 표시
  //   (옛 'pending' 필터 버그였다면 0 으로 나왔을 것 — 이번 수정으로 'accrued' 기준)
  await expect(page.locator('body')).toContainText('12,720')
  // 적립 내역 뱃지 — accrued='미정산', voided='무효' 둘 다 노출 (RewardStatus 도메인 수정)
  await expect(page.locator('body')).toContainText('미정산')
  await expect(page.locator('body')).toContainText('무효')
})

test('관리자 모집인 목록 — jackee 행에 기대수익 노출', async ({ page }) => {
  await page.goto('/mng/promoters?stx=0572')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('body')).toContainText('이상화')
  // 목록 expected 는 accrued 기준(정상) — 미정산 12,720 포함된 값이 보임
  await expect(page.locator('body')).toContainText('12,720')
})
