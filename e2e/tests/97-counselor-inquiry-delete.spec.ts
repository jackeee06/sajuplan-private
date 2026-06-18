import { test, expect } from '@playwright/test'

/**
 * 상담사 본인 문의 작성→삭제 — 실제 사용자 손가락 동작 (2026-06-15).
 *
 * 손가락 흐름 그대로 (UI 클릭/타이핑만, 자체 생성→삭제라 잔여물 없음):
 *   1. 문의하기 목록 → "문의하기" 버튼 클릭 → 작성 폼
 *   2. 분류 셀렉트 열어 "상담" 선택 + 제목/내용 타이핑 → "작성완료"
 *   3. 목록으로 돌아와 방금 쓴 문의 보임
 *   4. 그 문의 휴지통 클릭 → "삭제할까요?" 수락 → 목록에서 사라짐
 *   5. 새로고침 후에도 안 보임(소프트 삭제 영속)
 */

test.use({
  storageState: 'user_dual_storage.json',
  viewport: { width: 390, height: 844 },
})

test('손가락: 문의 작성 → 목록 → 휴지통 삭제 → 사라짐', async ({ page }) => {
  const uniqueTitle = `손가락삭제_${Date.now()}`

  // 1. 목록 → "문의하기" 버튼
  await page.goto('/counselor/mypage/qnas', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '문의하기', exact: true }).click()
  await expect(page.getByRole('heading', { name: '문의하기 작성' })).toBeVisible({ timeout: 10_000 })

  // 2. 분류 "상담" 선택
  await page.getByRole('button', { name: '분류 선택' }).click()
  await page.getByRole('option', { name: '상담', exact: true }).click()
  // 제목/내용 타이핑
  await page.getByPlaceholder('제목을 입력해주세요.').fill(uniqueTitle)
  await page.getByPlaceholder('문의내용을 작성해주세요').fill('손가락 동작 E2E — 작성 후 삭제 테스트.')
  // 작성완료
  await page.getByRole('button', { name: '작성완료' }).click()

  // 3. 목록 복귀 + 방금 쓴 문의 보임 (캐시 회피 위해 새로고침)
  await expect(page).toHaveURL(/\/counselor\/mypage\/qnas$/, { timeout: 10_000 })
  await page.reload({ waitUntil: 'domcontentloaded' })
  const row = page.locator('li', { hasText: uniqueTitle })
  await expect(row, '작성한 문의가 목록에 안 보임').toBeVisible({ timeout: 15_000 })

  // 4. 휴지통 클릭 → confirm 수락 → 사라짐
  page.on('dialog', (d) => d.accept())
  await row.getByRole('button', { name: '문의 삭제' }).click()
  await expect(page.locator('li', { hasText: uniqueTitle }), '삭제 후에도 문의가 남아있음')
    .toHaveCount(0, { timeout: 10_000 })

  // 5. 새로고침 후에도 안 보임
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('li', { hasText: uniqueTitle })).toHaveCount(0)
})
