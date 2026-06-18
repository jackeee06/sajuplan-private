import { test, expect } from '@playwright/test'

/**
 * [2026-06-12] 상담사 리스팅 랭킹 — 실제 화면(손가락) 검증.
 *
 * 모바일 뷰포트로 상담사 리스트(/counselors, 홈 '전체' 탭과 동일 랭킹 API)를 띄워
 * 렌더된 카드 순서가 [상담중 → 가용 → 부재(상담요청하기)] 로 정렬되는지 눈에 보이는 그대로 확인.
 * (방금끝남 30분 tier 는 카드에 시각 구분이 없어 '가용'으로 보임 → 통제검증은 63 + 별도 스크립트 담당)
 */

test.use({ viewport: { width: 390, height: 844 } })

// 카드 1장의 버튼 텍스트로 상태 그룹 분류: 상담중(0) < 가용(1) < 부재(2)
function groupOf(cardText: string): number {
  if (cardText.includes('상담중')) return 0
  if (cardText.includes('상담요청하기') || cardText.includes('요청됨')) return 2
  return 1 // 전화상담/채팅상담/오프라인 = 가용 묶음
}

test('상담사 리스트 화면 — 카드가 상담중→가용→부재 순서로 보인다', async ({ page }) => {
  await page.goto('/counselors', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500) // 리스트 로드 (networkidle 금지)

  // 상담사 카드 = 가격("30초당") 이 있는 article
  const cards = page.locator('article:has-text("30초당")')
  const n = await cards.count()
  expect(n, '상담사 카드가 화면에 보여야').toBeGreaterThan(0)

  const groups: number[] = []
  for (let i = 0; i < n; i++) {
    const t = (await cards.nth(i).innerText()).replace(/\s+/g, '')
    groups.push(groupOf(t))
  }
  console.log('[card groups]', groups.join(','))

  // 화면에 보이는 순서가 단조 비감소(상담중 먼저, 부재 마지막)
  for (let i = 1; i < groups.length; i++) {
    expect(groups[i], `화면 정렬 위반: idx ${i} (${groups[i - 1]}→${groups[i]})`).toBeGreaterThanOrEqual(groups[i - 1])
  }
})
