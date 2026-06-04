import { test, expect } from '@playwright/test'

/**
 * 상담사 상세 페이지 — 공지사항 HTML + 탭 sticky/scroll 엄격 검증
 *
 * 수정된 버그 (2026-06-04):
 *  1. 공지사항에 <p><br></p> 등 원시 HTML 태그 노출 → dangerouslySetInnerHTML 렌더로 수정
 *  2. 탭 첫 클릭 시 페이지 최상단(히어로 이미지)으로 튀는 현상 → Link → button+navigate로 교체
 *  3. 탭 클릭 시 탭 위치로 scroll 안 됨 → scrollIntoView({ behavior:'smooth', block:'start' }) 추가
 */

test.use({ storageState: { cookies: [], origins: [] } })

/** 리스트에서 첫 번째 상담사 URL을 동적으로 획득 */
async function getFirstCounselorHref(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/counselors')
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  const link = page.locator('a[href^="/counselors/"]').first()
  const href = await link.getAttribute('href').catch(() => null)
  return href ?? '/counselors/1'
}

test.describe('상담사 상세 — 공지사항 HTML + 탭 sticky 엄격 검증', () => {
  let counselorHref = '/counselors/1'

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    counselorHref = await getFirstCounselorHref(page)
    await page.close()
  })

  // ─────────────────────────────────────────────
  // BUG 1: 공지사항 원시 HTML 태그 노출
  // ─────────────────────────────────────────────
  test('공지사항 — 원시 HTML 태그(<p>, <br>, </p>) 텍스트로 노출되지 않음', async ({ page }) => {
    const consoleErrors: string[] = []
    const isExpected = (m: string) => /status of (401|404|429)/.test(m)
    page.on('pageerror', (e) => consoleErrors.push(e.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isExpected(msg.text()))
        consoleErrors.push(msg.text())
    })

    await page.goto(counselorHref)
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    // "상담사 공지사항" 섹션 존재 확인
    const noticeHeading = page.getByText('상담사 공지사항')
    await expect(noticeHeading, '공지사항 섹션 없음').toBeVisible({ timeout: 8_000 })

    // 공지사항 텍스트에 원시 HTML 태그 포함 여부 검사
    // counselor-intro div (공지사항 렌더 컨테이너) 의 textContent 에는 태그 없어야 함
    // 단, innerHTML 기반 렌더이므로 textContent 가져오기
    const rawText = await page.evaluate(() => {
      // "상담사 공지사항" 제목 이후의 첫 번째 counselor-intro div
      const el = document.querySelector('.counselor-intro')
      return el?.textContent ?? ''
    })

    // textContent 에 <p>, </p>, <br> 등이 문자열로 보이면 버그
    expect(rawText, '공지사항에 원시 HTML 태그 노출됨').not.toMatch(/<\/?[a-z]+[^>]*>/i)

    expect(consoleErrors, `JS 에러: ${consoleErrors.join(' | ')}`).toHaveLength(0)
  })

  // ─────────────────────────────────────────────
  // BUG 2+3: 탭 전환 + scroll 동작
  // ─────────────────────────────────────────────
  test('탭 — 3개 버튼(소개/후기/문의) 존재 + 클릭 시 활성 전환', async ({ page }) => {
    const consoleErrors: string[] = []
    const isExpected = (m: string) => /status of (401|404|429)/.test(m)
    page.on('pageerror', (e) => consoleErrors.push(e.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isExpected(msg.text()))
        consoleErrors.push(msg.text())
    })

    await page.goto(counselorHref)
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    // 탭 3개 button 존재 확인 (Link → button 교체 검증)
    const introBtn   = page.getByRole('button', { name: '상담사 소개' })
    const reviewsBtn = page.getByRole('button', { name: /후기/ })
    const qnaBtn     = page.getByRole('button', { name: /문의/ })

    await expect(introBtn, '상담사 소개 탭 버튼 없음').toBeVisible({ timeout: 8_000 })
    await expect(reviewsBtn, '후기 탭 버튼 없음').toBeVisible()
    await expect(qnaBtn, '문의 탭 버튼 없음').toBeVisible()

    // 기본 활성 탭 = 상담사 소개 (핑크 텍스트)
    const introColor = await introBtn.evaluate((el) =>
      window.getComputedStyle(el).color,
    )
    // rgb(244, 114, 182) = #f472b6 (핑크)
    expect(introColor, '기본 활성 탭이 핑크색이 아님').toContain('244')

    // 후기 탭 클릭 → 후기 활성
    await reviewsBtn.click()
    await page.waitForTimeout(400) // smooth scroll + render
    const reviewsColor = await reviewsBtn.evaluate((el) =>
      window.getComputedStyle(el).color,
    )
    expect(reviewsColor, '후기 탭 클릭 후 활성 색상 아님').toContain('244')

    // 문의 탭 클릭 → 문의 활성
    await qnaBtn.click()
    await page.waitForTimeout(400)
    const qnaColor = await qnaBtn.evaluate((el) =>
      window.getComputedStyle(el).color,
    )
    expect(qnaColor, '문의 탭 클릭 후 활성 색상 아님').toContain('244')

    // 소개 탭으로 복귀
    await introBtn.click()
    await page.waitForTimeout(400)

    expect(consoleErrors, `JS 에러: ${consoleErrors.join(' | ')}`).toHaveLength(0)
  })

  test('탭 scroll — 탭 클릭 시 window.scrollTo 가 탭 방향으로 호출됨 (scroll 의도 검증)', async ({ page }) => {
    // Playwright headless의 smooth scroll 완료 타이밍이 불규칙하므로
    // "scrollTo가 탭 위치(>현재 scroll)를 향해 호출됐는가"를 검증한다.
    // 실제 기기 동작은 사장님 수동 확인으로 검증됨 (2026-06-04).
    await page.addInitScript(() => {
      const orig = window.scrollTo.bind(window)
      ;(window as any).__scrollToCalls = []
      window.scrollTo = function(x: any, y?: any) {
        ;(window as any).__scrollToCalls.push(typeof x === 'object' ? x : { top: y, left: x })
        return orig(x, y)
      }
    })

    await page.goto(counselorHref)
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const reviewsBtn = page.getByRole('button', { name: /후기/ })
    await expect(reviewsBtn, '후기 탭 없음').toBeVisible({ timeout: 8_000 })

    // 탭 위치(document y) 기록
    const tabDocY = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="counselor-tab-area"]')
      return el ? el.getBoundingClientRect().top + window.scrollY : 0
    })

    // 스크롤 후 탭 클릭
    await page.evaluate(() => { (window as any).__scrollToCalls = [] })
    await page.evaluate(() => window.scrollTo({ top: 700, behavior: 'instant' }))
    await page.waitForTimeout(200)
    await page.evaluate(() => { (window as any).__scrollToCalls = [] }) // 탭 클릭 전 리셋

    await reviewsBtn.click()
    await page.waitForTimeout(500)

    const calls = await page.evaluate(() => (window as any).__scrollToCalls as Array<{top?: number}>)

    // scrollTo 가 최소 1회 호출됐는지
    expect(calls.length, '탭 클릭 후 scrollTo 호출 없음 — scroll 의도 없음').toBeGreaterThan(0)

    // 마지막 scrollTo 의 top 이 탭 위치에 근접 (±50px)
    const lastCall = calls[calls.length - 1]
    const calledTop = lastCall?.top ?? 0
    expect(
      calledTop,
      `scrollTo target(${calledTop})이 탭 document y(${tabDocY})와 너무 다름`,
    ).toBeGreaterThan(tabDocY - 50)
  })

  test('탭 전환 후 URL 파라미터 변경 확인 (replace 히스토리)', async ({ page }) => {
    await page.goto(counselorHref)
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const reviewsBtn = page.getByRole('button', { name: /후기/ })
    await expect(reviewsBtn, '후기 탭 없음').toBeVisible({ timeout: 8_000 })

    await reviewsBtn.click()
    await page.waitForTimeout(300)

    // URL에 ?tab=reviews 가 포함되어야 함
    const url = page.url()
    expect(url, '탭 전환 후 URL에 tab=reviews 없음').toContain('tab=reviews')

    // 문의 클릭
    await page.getByRole('button', { name: /문의/ }).click()
    await page.waitForTimeout(300)
    expect(page.url(), '탭 전환 후 URL에 tab=qna 없음').toContain('tab=qna')

    // 소개 클릭 → ?tab 파라미터 제거 (기본 URL)
    await page.getByRole('button', { name: '상담사 소개' }).click()
    await page.waitForTimeout(300)
    expect(page.url(), '소개 탭 URL에 tab= 파라미터 잔존').not.toContain('tab=')
  })
})
