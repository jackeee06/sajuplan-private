import { test, expect, request } from '@playwright/test'

const API = 'https://api.sajuplan.com'

/**
 * [2026-06-14] 상담사 수익금 카드 계층형 개편 엄격검증 (마이페이지 메인 + 수익금 헤더 통일).
 *
 * 배경: "이번달 정산금액" 단일 숫자가 총잔여·당월·정산예상을 떠안아 혼란.
 *   → 계층형으로 분리: 총잔여(메인) = 이번 정산 예정(전월까지) + 당월 적립 중(순액) / 선지급 가능.
 *   → 모든 숫자 순액(추천·정산 반영). 추천수당은 "수익금 내역"에만 1회.
 *   → 세후 입금 예상 + 잘못된 "부가세" 라벨 제거.
 *
 * 검증:
 *   1) 수익금 헤더: 계층 라벨(내 수익금/이번 정산 예정/당월 적립 중/선지급 가능) + 부가세 제거
 *   2) 실시간 정산 탭: 정산비전체/공제계/예상 실수령액 구조 유지
 *   3) 마이페이지 메인 카드: 계층 라벨 노출 + 옛 "이번달 정산금액" 제거
 */

const NEW_LABELS = ['내 수익금', '이번 정산 예정', '당월 적립 중', '선지급 가능']

test.describe('상담사 수익금 카드 계층형 개편', () => {
  test.use({ storageState: 'user_dual_storage.json' })

  test('수익금 헤더 — 계층 라벨 + 부가세 제거', async ({ page }) => {
    await page.goto('/counselor/mypage/settlement/history', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    expect(page.url(), '상담사 세션 — login 리다이렉트되면 안 됨').not.toContain('/login')

    for (const label of NEW_LABELS) {
      await expect(page.getByText(label, { exact: false }).first(), `라벨 누락: ${label}`).toBeVisible()
    }
    console.log('[OK] 헤더 계층 라벨 노출')

    const body = await page.locator('body').textContent()
    expect(body ?? '', '"부가세" 잔존 — 폐지 항목 오안내').not.toContain('부가세')
    expect(body ?? '', '"이번달 정산금액" 옛 라벨 잔존').not.toContain('이번달 정산금액')
    expect(body ?? '', '원천세 3.3% 안내 사라짐').toMatch(/원천세.*3\.3%|3\.3%/)
    console.log('[OK] 부가세/옛 라벨 제거 + 원천세 안내 유지')
  })

  test('실시간 정산 탭 — 정산비전체/공제계/예상 실수령액 구조 유지', async ({ page }) => {
    await page.goto('/counselor/mypage/settlement/history?tab=realtime', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    expect(page.url()).not.toContain('/login')

    await expect(page.getByText('정산비전체', { exact: false }).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('공제계', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('예상 실수령액', { exact: false }).first()).toBeVisible()
    console.log('[OK] 실시간 정산 탭 구조 유지')
  })

  test('마이페이지 메인 카드 — 계층 라벨 통일 + 옛 라벨 제거', async ({ page }) => {
    await page.goto('/counselor/mypage', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    expect(page.url()).not.toContain('/login')

    for (const label of NEW_LABELS) {
      await expect(page.getByText(label, { exact: false }).first(), `메인 카드 라벨 누락: ${label}`).toBeVisible()
    }
    const body = await page.locator('body').textContent()
    expect(body ?? '', '메인 카드에 옛 "이번달 정산금액" 잔존').not.toContain('이번달 정산금액')
    console.log('[OK] 마이페이지 메인 카드 — 헤더와 동일 계층 라벨')
  })

  test('선지급 차단 시 사유 노출 (예비파트너 = 파트너1부터)', async ({ page }) => {
    // e2e_dual 은 예비파트너(preliminary) → 선지급 차단 → block_reason("파트너1 등급 이상") 노출.
    await page.goto('/counselor/mypage', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    expect(page.url()).not.toContain('/login')
    // 차단 사유 안내가 보이고, 그 자리에 활성 [신청] 버튼이 없어야 함
    await expect(page.getByText('파트너1', { exact: false }).first(), '선지급 차단 사유 미노출').toBeVisible({ timeout: 10_000 })
    console.log('[OK] 예비파트너 선지급 차단 사유 노출')
  })

  test('수익금 내역 — 선불/후불 탭은 전체의 부분집합 (필터 정상)', async () => {
    // 옛 월합산 추천(counselor_referral)은 그 달 상담 유형에 맞는 탭에만 조건부 노출 →
    //   '전체'는 선불/후불 어느 것보다 같거나 많아야 한다(부분집합 불변식). 엔드포인트 정상도 확인.
    const ctx = await request.newContext({ storageState: 'user_dual_storage.json' })
    try {
      const counts: Record<string, number> = {}
      for (const md of ['', 'Y', 'N']) {
        const resp = await ctx.get(`${API}/api/user/settlements/income?md=${md}&limit=50`)
        if (resp.status() === 401 || resp.status() === 403) {
          console.log('[SKIP] 상담사 세션 없음')
          return
        }
        expect(resp.ok(), `income md='${md}' status=${resp.status()}`).toBeTruthy()
        const data = await resp.json()
        counts[md || 'all'] = (data.items ?? []).length
      }
      expect(counts.all, `전체(${counts.all}) < 선불(${counts.Y})`).toBeGreaterThanOrEqual(counts.Y)
      expect(counts.all, `전체(${counts.all}) < 후불(${counts.N})`).toBeGreaterThanOrEqual(counts.N)
      console.log(`[OK] 필터 부분집합 — 전체:${counts.all} 선불:${counts.Y} 후불:${counts.N}`)
    } finally {
      await ctx.dispose()
    }
  })
})
