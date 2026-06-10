import { test, expect } from '@playwright/test'

/**
 * [2026-06-03] 상담사 신청서 — 스타일 선택 UI 검증
 *
 * 목적: CounselorApplyNew.tsx 에 스타일 선택 UI 추가 후 회귀 방지.
 *
 * 한계 (자동화 불가):
 *   - 휴대폰 인증 (실 SMS 수신 불가)
 *   - 프로필 사진/계약서 업로드
 *   - 실제 폼 제출 (인증 필요)
 *
 * 검증 범위:
 *   1. 페이지 정상 로드 + JS 에러 없음
 *   2. 필수 폼 요소 마운트 확인
 *   3. 스타일 선택 UI 렌더링 확인
 *   4. 스타일 칩 클릭 → 활성화 상태 변경 확인
 *   5. 기존 필드 (이름·전문분야 등) 정상 동작 확인
 */

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('상담사 신청서 — 스타일 선택 UI', () => {
  const jsErrors: string[] = []

  test.beforeEach(async ({ page }) => {
    jsErrors.length = 0
    page.on('pageerror', (e) => jsErrors.push(e.message))

    await page.goto('/mypage/counselor-apply/new')
    await page.waitForLoadState('domcontentloaded')
  })

  /* ── 1. 페이지 기본 로드 ── */
  test('1. 페이지 정상 로드 — JS 에러 없음', async ({ page }) => {
    // SPA 마운트 확인 — 최소 1개 이상의 input 있어야 함
    const inputs = page.locator('input')
    await expect(inputs.first()).toBeVisible({ timeout: 10000 })

    // 페이지 JS 에러 없음
    expect(jsErrors, `JS 에러 발생: ${jsErrors.join(', ')}`).toHaveLength(0)
  })

  /* ── 2. 핵심 폼 요소 마운트 ── */
  test('2. 핵심 폼 요소 마운트 — 이름·예명·상담분야 존재', async ({ page }) => {
    const body = await page.locator('body').textContent() ?? ''

    // 이름 입력 있어야 함
    expect(body.includes('지원자 이름') || body.includes('이름'), '이름 필드 없음').toBeTruthy()

    // 상담분야 선택 있어야 함
    expect(body.includes('상담분야'), '상담분야 필드 없음').toBeTruthy()

    // 전문 상담분야 있어야 함 (기존 기능)
    expect(body.includes('전문 상담분야') || body.includes('전문분야'), '전문분야 필드 없음').toBeTruthy()
  })

  /* ── 3. 스타일 선택 UI 렌더링 ── */
  test('3. 스타일 선택 UI 렌더링 — 칩 목록 표시', async ({ page }) => {
    const body = await page.locator('body').textContent() ?? ''

    // "상담 스타일" 섹션 라벨 존재
    expect(body.includes('상담 스타일'), '"상담 스타일" 섹션이 없음 — UI 렌더 실패 가능성').toBeTruthy()

    // 기본 스타일 옵션 중 최소 1개 이상 보임 (settingsApi 폴백 포함)
    const styleKeywords = ['친절한', '직설적인', '논리적인', '공감형', '예언적인']
    const visibleCount = styleKeywords.filter((k) => body.includes(k)).length
    expect(
      visibleCount,
      `스타일 칩이 하나도 렌더되지 않음 (기대: 1+ / 실제: ${visibleCount})`
    ).toBeGreaterThanOrEqual(1)
  })

  /* ── 4. 스타일 칩 클릭 → 선택 상태 변경 ── */
  test('4. 스타일 칩 클릭 — 활성/비활성 토글', async ({ page }) => {
    // 스타일 칩 찾기 (기본 옵션 중 하나)
    const styleKeywords = ['친절한', '직설적인', '논리적인', '공감형', '예언적인']
    let chip: import('@playwright/test').Locator | null = null
    let keyword = ''

    for (const k of styleKeywords) {
      const candidate = page.getByRole('button', { name: k, exact: true })
      if (await candidate.isVisible().catch(() => false)) {
        chip = candidate
        keyword = k
        break
      }
    }

    expect(chip, '스타일 칩 버튼을 찾을 수 없음').not.toBeNull()
    if (!chip) return

    // 클릭 전 배경색 (비활성 = 흰색 or 회색)
    const bgBefore = await chip.evaluate((el) =>
      getComputedStyle(el).backgroundColor
    )

    // 클릭
    await chip.click()
    await page.waitForTimeout(300)

    // 클릭 후 배경색 변경 확인 (핑크 활성화)
    const bgAfter = await chip.evaluate((el) =>
      getComputedStyle(el).backgroundColor
    )

    expect(bgAfter, `"${keyword}" 칩 클릭 후 배경색 변화 없음 (비활성 유지 의심)`).not.toBe(bgBefore)
  })

  /* ── 5. 전문분야 칩 기존 동작 회귀 방지 ── */
  test('5. 전문분야 칩 — 스타일 추가 후 회귀 없음', async ({ page }) => {
    // "재회" 칩 존재 확인 (기존 specialty 옵션)
    const chip = page.getByRole('button', { name: '재회', exact: true })
    await expect(chip, '"재회" 전문분야 칩이 보이지 않음 — 회귀 의심').toBeVisible({ timeout: 10000 })

    // 클릭 토글
    await chip.click()
    await page.waitForTimeout(300)

    const bgAfter = await chip.evaluate((el) =>
      getComputedStyle(el).backgroundColor
    )
    // 활성화 시 핑크 계열로 변경
    expect(bgAfter, '"재회" 칩 클릭 후 배경색 변화 없음').not.toBe('rgba(0, 0, 0, 0)')

    // JS 에러 없음
    expect(jsErrors, `전문분야 토글 중 JS 에러: ${jsErrors.join(', ')}`).toHaveLength(0)
  })

  /* ── 6. 안내 문구 존재 확인 ── */
  test('6. 스타일 안내 문구 — 힌트 텍스트 렌더', async ({ page }) => {
    const body = await page.locator('body').textContent() ?? ''
    expect(
      body.includes('상담 스타일을 선택') || body.includes('스타일'),
      '스타일 관련 안내 문구 없음'
    ).toBeTruthy()
  })
})
