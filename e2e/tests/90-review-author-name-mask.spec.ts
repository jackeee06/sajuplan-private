import { test, expect } from '@playwright/test'

/**
 * 후기 작성자 표기 — 이름 중간 별표(마스킹) 표기 확인 (실제 손가락).
 *
 * 사장님 결정(2026-06-14): 아이디 표기는 가짜 아이디 의심을 부를 수 있어,
 * 이름 중간 별표(예: 강*림)가 신뢰도 면에서 더 안전 → 이름 마스킹으로 유지.
 */
const COUNSELOR_ID = 112

test.use({ storageState: 'user_member_storage.json' })

test('상담사 상세 후기탭 — 작성자 이름 마스킹(중간 별표)로 표시', async ({ page }) => {
  const names: string[] = []
  page.on('response', async (r) => {
    if (r.url().includes(`/user/counselors/${COUNSELOR_ID}/reviews`)) {
      try {
        const j = (await r.json()) as { items?: { reviewer_name?: string }[] }
        for (const it of j.items ?? []) if (it.reviewer_name) names.push(it.reviewer_name)
      } catch {
        /* ignore */
      }
    }
  })

  // 상세 진입 → 후기 탭 클릭 (손가락)
  await page.goto(`/counselors/${COUNSELOR_ID}`, { waitUntil: 'domcontentloaded' })
  await page.getByText(/후기\(\d+\)/).first().click()
  await page.waitForTimeout(2500)

  console.log('작성자 표기:', JSON.stringify(names))
  expect(names.length, '후기 1건 이상').toBeGreaterThan(0)

  // 이름 마스킹: 한글 + '*' 포함 (예: 강*림). 한 건 이상 존재해야 함.
  const hangulMasked = names.filter((n) => /[가-힣]/.test(n) && n.includes('*'))
  expect(hangulMasked.length, '이름 마스킹(한글+별표) 작성자가 보여야 함').toBeGreaterThan(0)

  // 화면에도 실제로 마스킹 이름이 보이는지
  await expect(page.getByText(hangulMasked[0], { exact: false }).first()).toBeVisible({ timeout: 8000 })
  console.log('[OK] 후기 작성자 이름 마스킹 표시 확인:', hangulMasked.slice(0, 6))
})
