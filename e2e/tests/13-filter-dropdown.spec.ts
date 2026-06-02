import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

/**
 * [2026-05-29] CounselorList 필터 칩 그리드 회귀 방지.
 *
 * 옛 FilterDropdown(드롭다운) → 새 칩 그리드로 재설계 (사장님 결정 2026-05-29).
 *   - 분야는 더 이상 펼침 X. 한 눈에 보이는 칩.
 *   - 이벤트 상담사 + 분야 칩이 같은 줄.
 *   - "재회" 칩이 항상 첫머리 (PINNED_FIELDS).
 *   - 큰 카테고리(사주/타로/신점) hashtag 는 EXCLUDED_FIELDS 로 분야 칩에 안 나옴.
 *   - 칩 클릭은 단순 토글 (활성/비활성).
 */

test.describe('CounselorList — 분야 칩 그리드 (2026-05-29 재설계)', () => {
  test('이벤트 상담사 칩 + 재회 칩이 함께 노출', async ({ page }) => {
    await page.goto('/counselors')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    // 이벤트 상담사 칩 — 분야 칩들과 같은 줄
    await expect(
      page.getByRole('button', { name: /이벤트 상담사/ }).first(),
      '이벤트 상담사 칩 안 보임',
    ).toBeVisible({ timeout: 5_000 })

    // "재회" 칩 — PINNED, DB hashtag 유무와 무관하게 항상 노출
    await expect(
      page.getByRole('button', { name: /^재회$/ }).first(),
      '재회 칩 (PINNED) 안 보임',
    ).toBeVisible({ timeout: 5_000 })
  })

  test('칩 클릭 → 활성 상태 / 다시 클릭 → 해제', async ({ page }) => {
    await page.goto('/counselors')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const chip = page.getByRole('button', { name: /^재회$/ }).first()
    await expect(chip).toBeVisible()

    // 비활성 상태 — 회색 톤 보더
    await expect(chip).toHaveClass(/border-\[#E5E7EB\]/)

    // 클릭 → 활성 — 핑크 톤 보더 + 글자색
    await chip.click()
    await expect(chip, '클릭 후 활성 스타일 미적용').toHaveClass(/border-\[#f472b6\]/, {
      timeout: 2_000,
    })

    // 다시 클릭 → 해제
    await chip.click()
    await expect(chip, '재클릭 후 해제 안 됨').toHaveClass(/border-\[#E5E7EB\]/, {
      timeout: 2_000,
    })
  })

  test('큰 카테고리(사주/타로/신점) 단독 칩이 분야 줄에 나오지 않음', async ({ page }) => {
    await page.goto('/counselors')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    // 상위 카테고리(큰 탭) 4개는 그대로 노출되어야 한다 — 별도 section.
    // 분야 칩 영역(이벤트 상담사 칩 포함 줄) 안에서만 검증.
    const eventChip = page.getByRole('button', { name: /이벤트 상담사/ }).first()
    const fieldSection = eventChip.locator(
      'xpath=ancestor::section[contains(@class,"flex-wrap")][1]',
    )
    await expect(fieldSection).toBeVisible()

    const fieldChipTexts = (await fieldSection.locator('button').allTextContents()).map((t) =>
      t.replace(/\s+/g, ' ').trim(),
    )

    for (const word of ['사주', '타로', '신점']) {
      expect(
        fieldChipTexts.filter((t) => t === word).length,
        `"${word}" 단독 칩이 분야 영역에 노출됨 (EXCLUDED_FIELDS 누락)`,
      ).toBe(0)
    }
  })

  test('카테고리 전환 시 활성 분야가 새 칩 목록에 없으면 자동 해제', async ({ page }) => {
    await page.goto('/counselors')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    // "전체" 카테고리에서 임의 분야 칩 활성 (이벤트/재회 외 첫 번째)
    const eventChip = page.getByRole('button', { name: /이벤트 상담사/ }).first()
    const fieldSection = eventChip.locator(
      'xpath=ancestor::section[contains(@class,"flex-wrap")][1]',
    )
    const fieldButtons = fieldSection.locator('button')
    const count = await fieldButtons.count()

    // 이벤트(0)·재회(1) 다음으로 동적 hashtag 가 있을 때만 진행
    if (count >= 3) {
      const dynChip = fieldButtons.nth(2)
      const label = (await dynChip.textContent())?.trim() ?? ''
      if (label && label !== '재회' && !label.includes('이벤트')) {
        await dynChip.click()
        await expect(dynChip).toHaveClass(/border-\[#f472b6\]/, { timeout: 2_000 })

        // 다른 카테고리(신점)로 전환 → 동적 hashtag 가 사라질 수 있음 → 활성 자동 해제
        await page.getByRole('button', { name: /^신점$/ }).first().click()
        await page.waitForTimeout(500)

        // 같은 라벨의 칩이 사라졌다면 활성 상태도 사라져야 (자동 해제) — 활성 칩 0 또는 다른 칩
        const stillActive = await fieldSection
          .locator('button.border-\\[\\#f472b6\\]')
          .filter({ hasText: label })
          .count()
        expect(stillActive, '카테고리 전환 후 사라진 분야가 활성 상태 유지').toBe(0)
      }
    }
  })
})
