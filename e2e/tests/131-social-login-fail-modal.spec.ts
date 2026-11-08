import { test, expect } from '@playwright/test'

/**
 * 소셜 로그인 실패 안내창 (2026-11-08).
 *   배경: 웹(인터넷 창) 카카오 로그인이 카카오 KOE010 으로 전부 실패했는데, 서버가 조용히 /login 으로
 *   돌려보내 고객이 이유도 모른 채 18~36번씩 반복 클릭. 로그인 화면은 ?error= 값을 아예 안 읽었음.
 *   수정: 서버가 실패 시 /login?error=<provider>_<사유> → 로그인 화면이 AlertModal 로 안내.
 *
 * ※ 실제 콜백(가짜 code)을 치는 테스트는 넣지 않는다 — 실패할 때마다 관리자 문의톡이 나가므로
 *   매 실행이 헛알림이 된다. 서버 분기는 배포 직후 1회 수동 확인(완료 보고에 기록).
 */
test('kakao_failed — 인터넷 창 카카오 로그인 실패 안내창(앱으로 유도)', async ({ page }) => {
  await page.goto('/login?error=kakao_failed', { waitUntil: 'domcontentloaded' })
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 5000 })
  await expect(dialog.getByText('카카오 로그인이 잠시 안 되고 있어요')).toBeVisible()
  await expect(dialog.getByText(/사주플랜 앱에서/)).toBeVisible()
  await expect(dialog.getByText(/네이버·아이디 로그인은 정상이에요/)).toBeVisible()
  await page.screenshot({ path: 'test-results/131-kakao-failed-modal.png' })

  // 확인 → 창 닫힘 + 주소창 error 제거(새로고침해도 다시 안 뜸)
  await dialog.getByRole('button', { name: '확인' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).not.toHaveURL(/error=/)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByText('카카오 로그인이 잠시 안 되고 있어요')).toHaveCount(0)
})

test('앱 토큰 실패(naver_token_invalid) — 공통 실패 안내창', async ({ page }) => {
  await page.goto('/login?error=naver_token_invalid', { waitUntil: 'domcontentloaded' })
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('네이버 로그인에 실패했어요')).toBeVisible({ timeout: 5000 })
  // 웹 카카오 전용 문구는 나오면 안 됨
  await expect(dialog.getByText(/인터넷 창/)).toHaveCount(0)
})

test('error 값이 없으면 안내창이 뜨지 않는다 (평소 로그인 화면)', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: '카카오 로그인' })).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('알 수 없는 error 값은 무시 (엉뚱한 창 금지)', async ({ page }) => {
  await page.goto('/login?error=something_weird', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: '카카오 로그인' })).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
