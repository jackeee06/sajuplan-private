import { test, expect } from '@playwright/test'

/**
 * 상담사 번호 표시 일관성 (dtmfno + 150) — 실제 클릭 검증.
 *
 * 배경: 원본 자동번호(dtmfno)를 +150 한 "표시번호"가 리스트 카드에만 적용돼 있었고,
 *       상세·공유 카드 등은 원본(예: 4번)을 그대로 노출하는 버그가 있었음 (2026-06-12 수정).
 *
 * 대상: 라온선생 (id=123, dtmfno=4 → 표시번호 154).
 *
 * 검증 포인트 (비로그인 가능):
 *   1. 상세페이지 이름 옆 번호칩 = "154번" (원본 "4번" 아님)
 *   2. 공유 버튼 클릭 → 공유 카드 설명에 "154번" 노출 (원본 "4번" 아님)
 *   3. 리스트 카드 번호가 전부 ≥150 (원본 한자리/두자리 노출 없음)
 *   4. JS 콘솔 에러 없음
 */
const RAON_ID = 123
const RAON_SHOWN = '154번'
const RAON_RAW = '4번'

test.describe('상담사 표시번호 +150 일관성', () => {
  test('상세페이지 번호칩 = 154번 (원본 4번 아님)', async ({ page }) => {
    const consoleErrors: string[] = []
    const isExpectedError = (msg: string) =>
      /Failed to load resource.*status of (401|404|429)/.test(msg) || /favicon/.test(msg)
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isExpectedError(msg.text())) {
        consoleErrors.push(`console.error: ${msg.text()}`)
      }
    })

    await page.goto(`/counselors/${RAON_ID}`)

    // 프로필 헤더가 뜰 때까지 (이름 영역)
    await expect(page.getByText('라온선생').first()).toBeVisible()

    // 1) 번호칩 = 154번
    await expect(page.getByText(RAON_SHOWN).first(), '상세 번호칩이 154번이 아님').toBeVisible()

    // 원본 "4번"이 번호로 노출되면 안 됨 (페이지 어디에도 단독 "4번" 없어야)
    await expect(page.getByText(RAON_RAW, { exact: true }), '원본 4번이 그대로 노출됨').toHaveCount(0)

    expect(consoleErrors, `JS 에러: ${consoleErrors.join(' / ')}`).toHaveLength(0)
  })

  test('공유 카드 설명에 154번 노출', async ({ page }) => {
    await page.goto(`/counselors/${RAON_ID}`)
    await expect(page.getByText('라온선생').first()).toBeVisible()

    // 2) 공유 버튼 클릭 → 공유 시트 오픈
    await page.getByRole('button', { name: '공유하기' }).click()

    // 공유 카드 설명 = "사주 · 154번 · 2,000원/30초" 형태
    const shareDesc = page.getByText(/·\s*154번\s*·/)
    await expect(shareDesc, '공유 카드 설명에 154번이 없음').toBeVisible()
    // 원본 "· 4번 ·" 패턴은 없어야
    await expect(page.getByText(/·\s*4번\s*·/), '공유 카드에 원본 4번 노출').toHaveCount(0)
  })

  test('리스트 카드 번호는 전부 ≥150 (원본 노출 없음)', async ({ page }) => {
    await page.goto('/counselors')
    await expect(page.getByRole('heading', { name: '상담사 리스트' })).toBeVisible()
    await page.waitForTimeout(1200) // 리스트 로드

    // 화면에 보이는 "N번" 형태의 번호를 모두 수집
    const nums = await page.evaluate(() => {
      const out: number[] = []
      const re = /^(\d+)번$/
      document.querySelectorAll('span').forEach((el) => {
        const t = (el.textContent ?? '').trim()
        const m = re.exec(t)
        if (m) out.push(Number(m[1]))
      })
      return out
    })

    expect(nums.length, '번호칩을 하나도 못 찾음').toBeGreaterThan(0)
    const bad = nums.filter((n) => n < 150)
    expect(bad, `150 미만 원본 번호 노출: ${bad.join(', ')}`).toHaveLength(0)
  })
})
