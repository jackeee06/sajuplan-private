import { test, expect, devices } from '@playwright/test'

const GALAXY = devices['Galaxy S9+']

/**
 * 경로2(상담사 프로필발 후기 작성) 폐지 검증.
 *  (1) 상담사 상세 후기 탭에 "후기 작성하기" 버튼 없음 + "마이페이지 > 상담내역" 안내 노출
 *  (2) 숨은 URL /counselors/:id/reviews/new → 상담사 프로필(후기 탭)로 redirect
 */
test('(1) 후기 탭 — 작성 버튼 제거 + 상담내역 안내', async ({ browser }) => {
  const ctx = await browser.newContext({ ...GALAXY, storageState: 'user_member_storage.json' })
  const page = await ctx.newPage()
  await page.goto('https://sajuplan.com/counselors/112?tab=reviews', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  const body = await page.locator('body').innerText()
  console.log('[후기 탭 안내 일부]', body.replace(/\n+/g, ' | ').slice(0, 220))

  // 안내 문구(상담내역 유도) 노출
  expect(body).toContain('상담내역')
  expect(body).toContain('마이페이지')
  // "후기 작성하기" 버튼/링크는 사라져야 함
  await expect(page.getByRole('link', { name: '후기 작성하기' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '후기 작성하기' })).toHaveCount(0)

  await ctx.close()
})

test('(2) 숨은 URL /counselors/:id/reviews/new → 프로필로 redirect', async ({ browser }) => {
  const ctx = await browser.newContext({ ...GALAXY, storageState: 'user_member_storage.json' })
  const page = await ctx.newPage()
  await page.goto('https://sajuplan.com/counselors/112/reviews/new', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  // 깨진 후기 폼(my-reviews/new)이 아니라 상담사 상세로 가야 함
  console.log('[redirect 최종 URL]', page.url())
  expect(page.url()).toContain('/counselors/112')
  expect(page.url()).not.toContain('/my-reviews/new')

  await ctx.close()
})
