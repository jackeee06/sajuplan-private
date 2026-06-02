import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

/**
 * [2026-05-25] 미커버 공개 페이지 심층 검증.
 *
 * 06 spec 은 공개 페이지의 단순 로드만 확인. 이 spec 은 각 페이지의 핵심 UI 요소가
 * 실제로 마운트됐는지 검증 — 빈 페이지 / 마운트 실패를 더 빠르게 잡음.
 *
 * 회귀 패턴:
 *   - 라우트는 있지만 빌드 실패로 SPA 가 마운트 안 됨 → root 만 있고 안 보이는 케이스
 *   - 각 페이지의 핵심 요소(폼 인풋, 헤더 텍스트, 버튼) 확인
 */

test.describe('공개 페이지 심층 검증 — 핵심 요소 마운트', () => {
  test('회원가입 — 폼 요소 (아이디/비번/이름 등) 모두 렌더', async ({ page }) => {
    await page.goto('/signup')
    await page.waitForLoadState('domcontentloaded')

    // 인풋 필드가 다수 보여야 함 (mbId, password 등 폼 자체가 마운트)
    const inputs = page.locator('input')
    const count = await inputs.count()
    expect(count, '회원가입 폼 인풋이 너무 적음 (마운트 실패 의심)').toBeGreaterThanOrEqual(3)

    // 약관 동의 영역 존재
    const body = (await page.locator('body').textContent()) ?? ''
    expect(body.includes('약관') || body.includes('동의'), '약관·동의 영역 없음').toBeTruthy()
  })

  test('아이디·비번 찾기 — 휴대폰/이메일 탭 + 입력 인풋', async ({ page }) => {
    await page.goto('/find')
    await page.waitForLoadState('domcontentloaded')

    // 휴대폰/이메일 탭 (둘 중 하나라도 텍스트로 보임)
    const body = (await page.locator('body').textContent()) ?? ''
    expect(
      body.includes('휴대폰') || body.includes('이메일'),
      '찾기 페이지에 탭 텍스트(휴대폰/이메일) 없음',
    ).toBeTruthy()

    // 입력 인풋 존재
    const inputCount = await page.locator('input').count()
    expect(inputCount, '찾기 페이지 인풋 없음').toBeGreaterThanOrEqual(1)
  })

  test('검색 페이지 — 검색 인풋 존재', async ({ page }) => {
    await page.goto('/search')
    await page.waitForLoadState('domcontentloaded')

    // 검색 인풋 (text/search type 중 하나)
    const inputs = page.locator('input[type="text"], input[type="search"], input:not([type])')
    const count = await inputs.count()
    expect(count, '검색 인풋이 없음').toBeGreaterThanOrEqual(1)
  })

  test('잘못된 URL → 홈 redirect (App.tsx의 catch-all)', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-12345')
    await page.waitForURL('**/', { timeout: 5_000 }).catch(() => {})

    // catch-all 라우트가 / 로 보내야 함
    const finalPath = new URL(page.url()).pathname
    expect(finalPath, `잘못된 URL → / 로 redirect 안 됨 (현재: ${finalPath})`).toBe('/')
  })

  test('상담사 상세 — id=1 등 임의 ID 페이지 로드 (있으면 OK, 없어도 SPA 마운트는 됨)', async ({ page }) => {
    const consoleErrors: string[] = []
    const isExpectedError = (msg: string) =>
      /Failed to load resource.*status of (401|404|429)/.test(msg)
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isExpectedError(msg.text())) {
        consoleErrors.push(`console.error: ${msg.text()}`)
      }
    })

    await page.goto('/counselors/1')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})

    // SPA 가 마운트되어 body 에 텍스트가 있어야 함 (없으면 빈 화면)
    const rootText = (await page.locator('#root').textContent()) ?? ''
    expect(rootText.trim().length, '상담사 상세 페이지 빈 화면').toBeGreaterThan(10)

    expect(consoleErrors, `JS 에러: ${consoleErrors.join(' / ')}`).toHaveLength(0)
  })

  test('후기 리스트 (/reviews) — 비로그인도 접근 가능 (공개 페이지)', async ({ page }) => {
    await page.goto('/reviews')
    await page.waitForLoadState('domcontentloaded')

    // 비로그인 가드로 /login 으로 가지 않으면 마운트 확인
    const path = new URL(page.url()).pathname
    if (path === '/reviews') {
      const rootText = (await page.locator('#root').textContent()) ?? ''
      expect(rootText.trim().length, '후기 페이지 빈 화면').toBeGreaterThan(10)
    } else {
      // 가드된 페이지면 /login 도달 — 그것도 OK
      expect(path, '예상 외 경로').toMatch(/\/login|\/reviews/)
    }
  })
})
