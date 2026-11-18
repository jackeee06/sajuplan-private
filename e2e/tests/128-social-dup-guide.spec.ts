import { test, expect } from '@playwright/test'

/**
 * 카카오 로그인 → 이미 가입된 계정 안내 (2026-07-20).
 *   일반가입자가 카카오 로그인을 눌러 가입창에 빠지던 혼란 방지.
 *   백엔드가 /login?id_dup=<아이디> (또는 ?social_dup=<provider>)로 리다이렉트 → 로그인 페이지가 안내.
 */
test('로그인 페이지 — id_dup 파라미터로 이미 가입된 아이디 안내', async ({ page }) => {
  await page.goto('/login?id_dup=Babylon5', { waitUntil: 'domcontentloaded' })
  // 마스킹: 앞 3글자만 노출('Bab*****')
  await expect(page.getByText(/이미 아이디.*Bab\*.*가입된 계정/)).toBeVisible({ timeout: 5000 })
})

test('로그인 페이지 — social_dup 파라미터로 소셜 계정 안내', async ({ page }) => {
  await page.goto('/login?social_dup=naver', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(/이미 네이버로 가입된 계정/)).toBeVisible({ timeout: 5000 })
})

test('로그인 페이지 — exists 파라미터로 일반 안내(아이디 없을 때 침묵 방지)', async ({ page }) => {
  await page.goto('/login?exists=1', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(/이미 이 전화번호로 가입된 계정/)).toBeVisible({ timeout: 5000 })
})
