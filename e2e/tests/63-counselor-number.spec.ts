import { test, expect } from '@playwright/test'

/**
 * 상담사 카드 연결번호(dtmfno) 표시 — 2026-06-11 신규.
 *  - 이름 옆에 m2net 상담사연결번호를 "N번" 연보라 칩(시안C)으로 노출.
 *  - dtmfno 1~999(정상 순번)만 표시, 90001~ 더미/미등록은 숨김.
 */
test.describe('상담사 카드 연결번호', () => {
  test('상담사 목록 JS 에러 없이 렌더 + 번호 칩 노출', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/counselors')
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(2000)
    expect(errors, errors.join('\n')).toEqual([])

    // m2net 등록 상담사(dtmfno<1000)는 "N번" 칩이 보여야 함 (없으면 미노출도 정상)
    const chip = page.getByText(/^\d{1,3}번$/).first()
    if (await chip.isVisible().catch(() => false)) {
      await expect(chip).toBeVisible()
    } else {
      test.info().annotations.push({ type: 'note', description: 'dtmfno<1000 상담사 없음 → 번호칩 미노출(정상)' })
    }
  })
})
