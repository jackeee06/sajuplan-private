import { test, expect, request } from '@playwright/test'

/**
 * 🔮 타로 상담 진입 — 홈 분할 버튼(만세력|타로상담) + 스마트 진입 + 설명 페이지
 *
 * 검증 포인트:
 *   U-1. GET /api/user/consult/tarot-session — 비로그인 401(가드)
 *   U-2. 홈에 "무료 만세력" + "타로상담" 2분할 버튼 노출(로그인 회원)
 *   U-3. 진행 중 타로 상담 없음 → "타로상담" 탭 시 설명 페이지(/tarot-intro)로 이동
 *   U-4. /tarot-intro 직접 진입 — 안내 콘텐츠(진행 방식·CTA) 렌더
 */

const API = 'https://api.sajuplan.com'

test('U-1 tarot-session 비로그인 401 (가드)', async () => {
  const ctx = await request.newContext()
  const r = await ctx.get(`${API}/api/user/consult/tarot-session`)
  expect(r.status()).toBe(401)
  await ctx.dispose()
  console.log('[OK] tarot-session 비로그인 → 401')
})

test.describe('홈 타로 진입 버튼 (로그인 회원)', () => {
  test.use({ storageState: 'user_member_storage.json' })

  test('U-2·U-3 만세력|타로상담 분할 + 진행중 없음→설명 페이지', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})

    // 2분할 버튼 노출
    await expect(page.getByText('무료 만세력', { exact: true })).toBeVisible({ timeout: 15000 })
    const tarotBtn = page.getByRole('button', { name: '타로상담 안내' })
    await expect(tarotBtn).toBeVisible()

    // 진행 중 타로 상담 없음 → 탭하면 설명 페이지로
    await tarotBtn.click()
    await expect(page).toHaveURL(/\/tarot-intro/, { timeout: 10000 })
    await expect(page.getByText('이렇게 진행돼요')).toBeVisible()
    console.log('[OK] 홈 분할 버튼 + 타로상담 → 설명 페이지 이동')
  })
})

test('U-4 /tarot-intro 안내 페이지 렌더', async ({ page }) => {
  await page.goto('/tarot-intro', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: '전화 타로 상담' })).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('같은 카드 화면')).toBeVisible()
  await expect(page.getByText('이렇게 진행돼요')).toBeVisible()
  await expect(page.getByRole('button', { name: /타로 상담사 보러가기/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /무료 타로 체험하러가기/ })).toBeVisible()

  // "타로 상담사 보러가기" → 타로 카테고리 필터된 목록으로 이동
  await page.getByRole('button', { name: /타로 상담사 보러가기/ }).click()
  await expect(page).toHaveURL(/\/counselors\?category=/, { timeout: 10000 })
  console.log('[OK] /tarot-intro 안내 + 상담사(타로필터)/무료체험 버튼')
})

test('U-5 가이드는 상담사 전용 게이트 — 비로그인 차단', async ({ page }) => {
  // 쿠키 없음(외부에서 URL만 들고 온 상황) → /auth/me 401 → 차단 메시지, 본문 숨김
  await page.goto('/tarot-guide.html', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('상담사 전용 페이지입니다')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('한 장씩 공개하며 전화로 해설')).toBeHidden()
  console.log('[OK] 가이드 비로그인 차단(상담사 전용)')
})

test('U-5b 게이트 로직 — 상담사면 본문 노출 / 회원이면 차단 (mock)', async ({ page }) => {
  // 상담사
  await page.route('**/api/user/auth/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, role: 'counselor' }) }))
  await page.goto('/tarot-guide.html', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('한 장씩 공개하며 전화로 해설')).toBeVisible({ timeout: 15000 })

  // 일반 회원 → 차단
  await page.unroute('**/api/user/auth/me')
  await page.route('**/api/user/auth/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 2, role: 'user' }) }))
  await page.goto('/tarot-guide.html', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('상담사 전용 페이지입니다')).toBeVisible({ timeout: 10000 })
  console.log('[OK] 게이트: 상담사=본문, 회원=차단')
})

test.describe('상담사 마이페이지 — 가이드 버튼 (메모장 밑)', () => {
  test.use({ storageState: 'user_dual_storage.json' })

  test('U-6 메모장 밑 "전화타로 상담 사용법" 버튼 노출', async ({ page }) => {
    await page.goto('/counselor/mypage', { waitUntil: 'domcontentloaded' })
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByText('메모장', { exact: true })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('전화타로 상담 사용법')).toBeVisible()
    console.log('[OK] 상담사 마이페이지 메모장 밑 가이드 버튼 노출')
  })
})
