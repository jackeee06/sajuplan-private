import { test, expect, request as pwRequest } from '@playwright/test'

/**
 * 모집인(서포터즈) 회원모집 보상 — 공개 페이지/엔드포인트 검증 (2026-06-18 신규 기능).
 *
 * 백엔드 핵심(적립/정산/환불void)은 실제 m2net 상담 push 가 있어야 발생하므로
 * 별도 prod 스모크 테스트(_smoke_promoter.py)로 검증함. 여기서는 사용자-노출 표면:
 *   1. 공개 코드유효성 API 동작
 *   2. 모집인 대시보드(/promoter) — 비로그인 시 휴대폰 OTP 로그인 화면 노출(앱게이트 우회)
 *   3. 모집인 랜딩(/s/:code) — 코드 안내 화면 노출(앱게이트 우회)
 */

const API_BASE = 'https://api.sajuplan.com/api'

test('공개 by-code API — 없는 코드면 exists=false', async () => {
  const ctx = await pwRequest.newContext()
  const res = await ctx.get(`${API_BASE}/promoter/by-code/ZZNOPE0000`)
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body).toHaveProperty('exists')
  expect(body.exists).toBeFalsy()
  await ctx.dispose()
})

test('대시보드 가드 — 비로그인 me/dashboard 는 401', async () => {
  const ctx = await pwRequest.newContext()
  const res = await ctx.get(`${API_BASE}/promoter/me/dashboard`)
  expect(res.status()).toBe(401)
  await ctx.dispose()
})

test('서포터즈 첫화면 — 헤더 "서포터즈" + 역할·혜택 + 휴대폰 로그인', async ({ page }) => {
  await page.goto('/promoter')
  await page.waitForLoadState('networkidle')
  expect(page.url()).toContain('/promoter')
  // 사용자 화면 용어 = "서포터즈" (내부용어 "모집인" 아님)
  await expect(page.locator('h1', { hasText: '서포터즈' })).toBeVisible()
  // 중앙 역할·혜택 + 휴대폰 로그인 둘 다 존재
  await expect(page.locator('body')).toContainText('사주플랜 서포터즈')
  await expect(page.locator('body')).toContainText('이렇게 적립돼요') // 설명형 타임라인
  await expect(page.locator('body')).toContainText('상담 이용할 때마다 적립')
  await expect(page.getByPlaceholder("'-' 없이 숫자만 입력")).toBeVisible()
  await expect(page.getByRole('button', { name: '서포터즈 화면 바로가기 추가' })).toBeVisible()
  // 공식 스토어 배지
  await expect(page.locator('body')).toContainText('App Store')
  await expect(page.locator('body')).toContainText('Google Play')
})

test('모집인 랜딩(/s/:code) — 코드 안내 화면 렌더(앱게이트 우회)', async ({ page }) => {
  await page.goto('/s/SMOKE9999')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('body')).toContainText(/코드|추천|모집|사주플랜|가입|유효하지/)
})

test('모집인 페이지 제목 = "사주플랜 서포터즈" (북마크/바로가기 이름)', async ({ page }) => {
  await page.goto('/promoter')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveTitle('사주플랜 서포터즈')
})

test('홈화면 바로가기 이름 출처 = manifest 교체 (서포터즈 페이지만 promoter.webmanifest)', async ({ page }) => {
  // ★ 안드로이드 "홈 화면에 추가" 이름은 manifest 가 결정 → 서포터즈 페이지에선 promoter.webmanifest 여야 함
  await page.goto('/promoter')
  await page.waitForLoadState('networkidle')
  const href = await page.getAttribute('link[rel="manifest"]', 'href')
  expect(href).toContain('/promoter.webmanifest')
  const m = await (await page.request.get('https://sajuplan.com/promoter.webmanifest')).json()
  expect(m.name).toBe('사주플랜 서포터즈') // 바로가기 이름
  expect(m.display).toBe('browser') // WebAPK 안 생김 → Play 프로텍트 경고 없음

  // 메인은 그대로 site.webmanifest(name 사주플랜) — 무영향
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const mainHref = await page.getAttribute('link[rel="manifest"]', 'href')
  expect(mainHref).toContain('/site.webmanifest')
})

test('공유 깨끗한 경로(/r/{코드}) — 방문자는 /s/{코드}로 자동 이동', async ({ page }) => {
  await page.goto('/r/SMOKE9999')
  // /r/ 가 OG 페이지(sp.html)로 서빙되고, JS location.replace 로 랜딩 경로로 이동
  await page.waitForURL(/\/s\/SMOKE9999/, { timeout: 10_000 })
  expect(page.url()).toContain('/s/SMOKE9999')
})
