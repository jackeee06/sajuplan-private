import { test, expect } from '@playwright/test'

/**
 * 부재(둘 다 off) 상담사 노출 + 상세 CTA 통일 — 실제 손가락 동작 (2026-06-17).
 *
 * 고객이 실제로 누르는 순서 그대로:
 *   1. 상담사 목록(/counselors) 진입 → "더보기"로 전체 펼침
 *   2. 부재 상담사 카드(= "상담요청하기" 버튼이 달린 카드)가 목록에 보임 ★목록 노출
 *   3. 그 카드의 이름을 눌러 상세 진입 → 후기 열람 가능
 *   4. 상세 하단 CTA 도 "상담요청하기" 로 통일됨(전화/채팅 아님) ★상세 통일
 *
 * 특정 상담사에 의존하지 않고, 런타임에 부재 카드를 찾아 그 카드로 진입(상태 변동에 견고).
 */

test.use({
  storageState: 'user_member_storage.json',
  viewport: { width: 390, height: 844 },
})

test('손가락: 부재 카드 목록 노출 → 상세 진입 → 상세도 상담요청하기', async ({ page }) => {
  await page.goto('/counselors', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)

  // "더보기" 펼침 (부재는 맨 뒤라 펼쳐야 보임)
  const more = page.getByRole('button', { name: '더보기' })
  if (await more.isVisible().catch(() => false)) {
    await more.click()
    await page.waitForTimeout(600)
  }

  // 1~2. 부재 카드(상담요청하기 버튼 보유) 1개 찾기
  const absentCard = page.locator('article').filter({ has: page.getByText('상담요청하기') }).first()
  const cardCount = await page.locator('article').filter({ has: page.getByText('상담요청하기') }).count()
  test.skip(cardCount === 0, '현재 부재 상태 상담사가 없어 스킵(모두 접속 중)')

  await absentCard.scrollIntoViewIfNeeded()
  await expect(absentCard, '부재 상담사 카드가 목록에 안 보임').toBeVisible()
  await page.screenshot({ path: 'test-results/_shot_absent_list.png', fullPage: true })

  // 3. 그 카드의 이름 링크 클릭 → 상세 진입
  await absentCard.getByRole('link').first().click()
  await expect(page).toHaveURL(/\/counselors\/\d+/, { timeout: 10_000 })

  // 후기 영역 도달 가능
  await expect(page.getByText(/후기/).first(), '상세에 후기 영역 없음').toBeVisible()

  // 4. ★ 상세 하단 CTA 도 "상담요청하기" (목록과 통일, 전화/채팅 아님) — UI 만 확인, 실제 전송 X
  //    (랜덤 상담사에게 진짜 알림이 가지 않도록 여기선 클릭하지 않는다.)
  const reqBtn = page.getByRole('button', { name: '상담요청하기' })
  await expect(reqBtn, '상세 하단이 상담요청하기로 안 바뀜(부재 미반영)').toBeVisible({ timeout: 8_000 })
  await page.screenshot({ path: 'test-results/_shot_absent_detail.png', fullPage: true })

  // 5. ★ 실제 "상담요청" 전송 검증은 무조건 찬물선생(id 91)에게만 (테스트 스팸 방지 규칙).
  const send = await page.evaluate(async () => {
    const r = await fetch('https://api.sajuplan.com/api/user/counselors/91/request-consult', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
    })
    return { status: r.status, body: await r.json().catch(() => null) }
  })
  // 200(전송) 또는 already=true(24h 중복) 모두 정상
  expect([200, 201].includes(send.status), `상담요청 전송 실패: ${JSON.stringify(send)}`).toBe(true)
})
