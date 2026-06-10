import { test, expect } from '@playwright/test'

/**
 * [2026-06-04] 고객 전화상담 내역 실데이터 전환 검증
 *
 * 검증 포인트:
 *   1. 헤더 "전화상담 내역" 렌더
 *   2. 로딩 → 완료 전환 (로딩 스피너 사라짐)
 *   3. 실데이터 응답: 카드 목록 OR 빈 상태 메시지 (둘 중 하나여야 함)
 *   4. Mock 패턴 잔존 금지: "불러오는 중…" 이 최종 상태로 남아있으면 안 됨
 *   5. API 호출 확인: /user/consult/history?role=member&type=call 요청 발생
 */

test.use({ storageState: 'user_dual_storage.json' })

test.describe('고객 전화상담 내역 — 실데이터 전환 검증', () => {
  test('헤더 렌더 확인', async ({ page }) => {
    await page.goto('/mypage/calls', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: '전화상담 내역' })).toBeVisible()
  })

  test('API 호출 발생 + 로딩 완료', async ({ page }) => {
    // waitForResponse 를 goto 전에 등록 → useEffect 비동기 호출도 캡처
    const apiResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/user/consult/history') && res.url().includes('type=call'),
      { timeout: 12_000 },
    )

    await page.goto('/mypage/calls', { waitUntil: 'domcontentloaded' })

    // API 응답 수신 확인 (2xx or 401)
    const apiRes = await apiResponsePromise
    expect([200, 401]).toContain(apiRes.status())

    // 로딩 스피너 사라짐 확인
    await expect(page.getByText('불러오는 중…')).not.toBeVisible({ timeout: 8_000 })
  })

  test('카드 목록 또는 빈 상태 메시지 노출 (둘 중 하나)', async ({ page }) => {
    await page.goto('/mypage/calls', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const cards = page.locator('article.py-5')
    const emptyMsg = page.getByText('아직 전화상담 내역이 없습니다.')
    const errorMsg = page.locator('.text-\\[\\#FB2C36\\]')

    const cardCount = await cards.count()

    if (cardCount > 0) {
      // 카드가 있으면 카드 구조 검증
      const firstCard = cards.first()
      // 시작시간 라벨 확인
      await expect(firstCard.getByText('시작시간')).toBeVisible()
      // 사용 코인 라벨 확인
      await expect(firstCard.getByText('사용 코인')).toBeVisible()
    } else {
      // 에러가 아니라 빈 상태여야 함
      const isError = await errorMsg.isVisible()
      if (!isError) {
        await expect(emptyMsg).toBeVisible({ timeout: 5_000 })
      }
    }
  })

  test('에러 상태가 최종 결과가 아님', async ({ page }) => {
    await page.goto('/mypage/calls', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    // 에러 텍스트가 있으면 fail
    const errorEl = page.locator('.text-\\[\\#FB2C36\\]')
    const errorVisible = await errorEl.isVisible()
    if (errorVisible) {
      const errorText = await errorEl.textContent()
      throw new Error(`전화상담 내역 에러 발생: ${errorText}`)
    }
  })
})
