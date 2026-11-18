import { test, expect } from '@playwright/test'

/**
 * 117 — 앱 유입 깔때기(SEO-안전) + 상담사 내 상담실 링크 공유 (2026-06-25)
 *
 * 정책: 콘텐츠(상담사 프로필·목록)는 웹에서도 보이되, 실제 상담 행동(전화·채팅)은 앱에서만.
 *  - 웹(앱 밖) 에서 전화/채팅을 누르면 상담 모달 대신 "앱에서 상담하기" 시트가 떠야 함.
 *  - 콘텐츠는 가려지지 않아야 함(클로킹/전면팝업 페널티 회피).
 *  - 상담사 마이페이지에 "내 상담실 링크 공유하기" 버튼 → 공유 시트.
 *
 * 주의: 게이트는 navigator.webdriver(E2E 자동화) 를 예외 처리하므로(기존 상담 E2E 보호),
 *  게이트 동작 검증 시에만 addInitScript 로 webdriver=false 로 덮어 일반 웹 브라우저를 흉내낸다.
 */

const BASE = (process.env.TARGET ?? 'prod') === 'prod' ? 'https://sajuplan.com' : 'https://sajumoon.kr'

test.describe('117 앱 유입 깔때기 + 상담실 공유', () => {
  test('웹에서 전화상담 클릭 → 콘텐츠는 보이고, 앱 유도 시트가 뜬다', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: BASE })
    // 일반 웹 브라우저 흉내 — 게이트 활성화
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false })
    })
    const page = await ctx.newPage()
    await page.goto('/counselors')
    await page.waitForLoadState('networkidle')

    // 콘텐츠(상담사 목록)는 정상 노출 = SEO 안전(가려지지 않음)
    const phoneBtn = page.getByRole('button', { name: '전화상담' }).first()
    await phoneBtn.waitFor({ state: 'visible', timeout: 20000 })
    await expect(phoneBtn).toBeVisible()

    // 전화상담 클릭 → 상담 모달이 아니라 앱 유도 시트
    await phoneBtn.click()
    const sheet = page.getByTestId('app-required-sheet')
    await expect(sheet).toBeVisible({ timeout: 8000 })
    await expect(page.getByTestId('app-required-store-btn')).toBeVisible()
    // 상담 모달(보유 코인/상담 시간 선택)은 뜨지 않아야 함
    await expect(page.getByText('상담 시간 선택')).toHaveCount(0)

    await ctx.close()
  })

  test('채팅상담도 동일하게 앱 유도 시트', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: BASE })
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false })
    })
    const page = await ctx.newPage()
    await page.goto('/counselors')
    await page.waitForLoadState('networkidle')

    const chatBtn = page.getByRole('button', { name: '채팅상담' }).first()
    // 채팅 버튼이 있는 상담사가 있을 때만(전부 hideChat/오프라인이면 skip)
    if ((await chatBtn.count()) === 0) {
      test.skip(true, '채팅 가능 상담사 없음 — 환경 의존, skip')
    }
    await chatBtn.click()
    await expect(page.getByTestId('app-required-sheet')).toBeVisible({ timeout: 8000 })

    await ctx.close()
  })

  test('E2E(자동화)는 게이트 예외 — 기존 상담 흐름 보호 확인', async ({ browser }) => {
    // webdriver 덮어쓰기 없음 → navigator.webdriver=true → 게이트 통과(시트 안 뜸)
    const ctx = await browser.newContext({ baseURL: BASE })
    const page = await ctx.newPage()
    await page.goto('/counselors')
    await page.waitForLoadState('networkidle')
    const phoneBtn = page.getByRole('button', { name: '전화상담' }).first()
    await phoneBtn.waitFor({ state: 'visible', timeout: 20000 })
    await phoneBtn.click()
    // 앱 유도 시트는 뜨지 않아야 함(자동화 예외)
    await expect(page.getByTestId('app-required-sheet')).toHaveCount(0)
    await ctx.close()
  })

  test('상담사 마이페이지: "내 상담실 링크 공유하기" 버튼 → 공유 시트', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'user_counselor_storage.json', baseURL: BASE })
    const page = await ctx.newPage()
    await page.goto('/counselor/mypage')
    await page.waitForLoadState('networkidle')

    // 상담사 공지 팝업(PopupLayer)이 떠 있으면 먼저 닫는다(여러 개면 순차).
    for (let i = 0; i < 3; i++) {
      const closeBtn = page.getByRole('button', { name: '닫기' })
      if (await closeBtn.count() === 0 || !(await closeBtn.first().isVisible())) break
      await closeBtn.first().click()
      await page.waitForTimeout(400)
    }

    const shareBtn = page.getByTestId('counselor-share-room-btn')
    await expect(shareBtn).toBeVisible({ timeout: 15000 })
    await expect(shareBtn).toContainText('내 상담실 링크 공유하기')

    await shareBtn.click()
    // 공유 바텀시트(카톡/인스타/페북/링크복사)
    await expect(page.getByRole('dialog', { name: '공유하기' })).toBeVisible({ timeout: 8000 })
    // 링크복사 1순위 — 큰 기본 버튼 + 안내 문구
    await expect(page.getByTestId('share-copy-primary')).toBeVisible()
    await expect(page.getByText('카톡엔')).toBeVisible()
    await expect(page.getByText('가장 확실해요')).toBeVisible()
    await expect(page.getByText('링크복사').first()).toBeVisible()

    await ctx.close()
  })
})
