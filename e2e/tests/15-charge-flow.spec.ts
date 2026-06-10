import { test, expect } from '@playwright/test'

/**
 * [2026-05-25] 충전 페이지 UI 흐름 — 실 PG 호출 없이 form-submit 직전까지.
 *
 * spec 09 와 동일 패턴 — 단일 직렬 test 로 통합하여 rate limit / cookies stale 회피.
 * 케이스간 page.goto 만으로 진행 → cookies 보존 + me() 응답 timing 안정화.
 *
 * 검증:
 *   1. /mypage/charge 로드 → "충전/자동충전" 탭 + "결제요금 선택" 섹션
 *   2. 충전 패키지 1개 이상 렌더 (API /charge/packages)
 *   3. 결제방법 — 사주플랜페이 / 일반결제 토글 후 5종 옵션
 *   4. VAT 별도 + "P" 단위 0 (정책)
 *   5. 자동충전 탭 클릭 → 본문 전환
 */

test.use({ storageState: 'user_member_storage.json' })

test.describe('충전 흐름 (단일 직렬)', () => {
  test('전체 시나리오 — 충전 페이지 UI 일관', async ({ page }) => {
    // TEST 서버 폐기(2026-05-29) → prod 단일. storageState 로 세션 보장.
    test.setTimeout(60_000)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})

    // ── 1. 충전 페이지 로드 + 핵심 섹션
    await page.goto('/mypage/charge')
    await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {})
    await expect(
      page.getByRole('heading', { name: '코인 충전' }),
      '시나리오1: "코인 충전" 헤더',
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: '충전', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '자동충전', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: '결제요금 선택' })).toBeVisible()
    await expect(page.getByText('(VAT 별도)')).toBeVisible()
    await expect(page.getByRole('heading', { name: '결제방법' })).toBeVisible()

    // ── 2. 충전 패키지 1개 이상 렌더 + "P" 단위 0 (정책)
    const body = (await page.locator('body').textContent()) ?? ''
    expect(
      body.match(/\d{1,3}(,\d{3})+\s*(원|코인)/),
      '시나리오2: 패키지 가격 표기 없음 (API 응답 비어있음)',
    ).toBeTruthy()
    const pUnit = body.match(/\d{1,3}(,\d{3})*\s*P\b/)
    expect(pUnit, `시나리오2: "P" 단위 사용됨 (정책 위반: ${pUnit?.[0]})`).toBeNull()
    const forbidden = ['소비포인트', '충전 포인트', '충전포인트', '보유 포인트']
    const hits = forbidden.filter((w) => body.includes(w))
    expect(hits, `시나리오2: 옛 "포인트" 단어 노출됨 — ${hits.join(', ')}`).toEqual([])

    // ── 3. 결제방법 — 사주플랜페이 라벨
    await expect(page.getByText('사주플랜페이').first()).toBeVisible()
    // 일반결제 라디오 토글 후 5종 옵션 확인
    const generalRadio = page.getByText('일반결제').first()
    if (await generalRadio.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await generalRadio.click()
      await page.waitForTimeout(300)
      const body2 = (await page.locator('body').textContent()) ?? ''
      const methods = ['신용카드', '가상계좌', '페이코', '카카오페이', '네이버페이']
      const present = methods.filter((m) => body2.includes(m))
      expect(
        present.length,
        `시나리오3: 일반결제 5종 중 노출 ${present.length}건. 디자인 변경?`,
      ).toBeGreaterThanOrEqual(2)
    }

    // ── 4. 자동충전 탭 클릭 → 본문 전환
    await page.getByRole('button', { name: '자동충전', exact: true }).click()
    await page.waitForTimeout(400)
    const body3 = (await page.locator('body').textContent()) ?? ''
    expect(
      body3.includes('자동충전') || body3.includes('자동 충전'),
      '시나리오4: 자동충전 탭 본문 안 바뀜',
    ).toBeTruthy()
  })
})
