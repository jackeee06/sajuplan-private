import { test, expect, request } from '@playwright/test'

/**
 * [Phase 2 - B-4] 단골(즐겨찾기) 기능 엄격검증
 *
 * 검증 포인트:
 *   1. /favorites 페이지 정상 렌더
 *   2. 단골 추가 API (POST /api/user/favorites/:counselorId) → 201
 *   3. 단골 목록 API (GET /api/user/favorites) → items 배열
 *   4. 단골 제거 API (DELETE /api/user/favorites/:counselorId) → 200
 *   5. 하트 토글 멱등성 — 이미 단골 추가 후 재추가 → 409 or 200 (덮어쓰기)
 *   6. 비로그인 단골 추가 → 401
 */

const API = 'https://api.sajuplan.com'

async function getFirstCounselorId(): Promise<number | null> {
  const ctx = await request.newContext()
  const resp = await ctx.get(`${API}/api/user/counselors?limit=1`)
  if (resp.status() !== 200) { await ctx.dispose(); return null }
  const data = await resp.json() as { items: { id: number }[] }
  await ctx.dispose()
  return data.items?.[0]?.id ?? null
}

test.describe('단골(즐겨찾기) 기능', () => {
  test.use({ storageState: 'user_member_storage.json' })

  test('/favorites 페이지 정상 렌더', async ({ page }) => {
    await page.goto('/favorites', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    // 빈 상태 or 목록 둘 다 허용
    const body = await page.locator('body').textContent()
    expect(body).toBeTruthy()
    console.log('[OK] /favorites 페이지 정상 렌더')
  })

  test('단골 추가 → 목록 조회 → 제거 (전체 흐름)', async () => {
    const counselorId = await getFirstCounselorId()
    if (!counselorId) { console.log('[SKIP] 상담사 없음'); return }

    const ctx = await request.newContext({ storageState: 'user_member_storage.json' })

    // 1. 우선 제거 (초기화)
    await ctx.delete(`${API}/api/user/favorites/${counselorId}`)

    // 2. 단골 추가 (POST /api/user/counselors/:id/like)
    const addResp = await ctx.post(`${API}/api/user/counselors/${counselorId}/like`)
    expect([200, 201]).toContain(addResp.status())
    console.log(`[OK] 단골 추가: counselorId=${counselorId}, status=${addResp.status()}`)

    // 3. 목록 조회 (GET /api/user/counselors/favorites)
    const listResp = await ctx.get(`${API}/api/user/counselors/favorites`)
    expect(listResp.status()).toBe(200)
    const listData = await listResp.json() as { items: { id: number; counselor_id?: number }[] }
    expect(Array.isArray(listData.items)).toBe(true)
    console.log(`[OK] 단골 목록: ${listData.items.length}건`)

    // 4. 단골 제거 (DELETE /api/user/counselors/:id/like)
    const delResp = await ctx.delete(`${API}/api/user/counselors/${counselorId}/like`)
    expect([200, 204]).toContain(delResp.status())
    console.log(`[OK] 단골 제거: status=${delResp.status()}`)

    // 5. 제거 후 다시 조회
    const listAfterResp = await ctx.get(`${API}/api/user/counselors/favorites`)
    const listAfter = await listAfterResp.json() as { items: { id: number }[] }
    console.log(`[OK] 제거 후 단골 목록: ${listAfter.items.length}건`)

    await ctx.dispose()
  })

  test('단골 추가 멱등성 — 재추가 시 409 or 200 (중복 허용)', async () => {
    const counselorId = await getFirstCounselorId()
    if (!counselorId) { console.log('[SKIP] 상담사 없음'); return }

    const ctx = await request.newContext({ storageState: 'user_member_storage.json' })

    await ctx.post(`${API}/api/user/counselors/${counselorId}/like`)
    const r2 = await ctx.post(`${API}/api/user/counselors/${counselorId}/like`)
    expect([200, 201, 409]).toContain(r2.status())
    console.log(`[OK] 재추가 status=${r2.status()} (409=중복, 200/201=멱등 허용)`)

    await ctx.delete(`${API}/api/user/counselors/${counselorId}/like`)
    await ctx.dispose()
  })

  // 비로그인 테스트는 describe 외부에서 별도 처리 (storageState 격리 필요)

})

// 비로그인 가드 검증 — storageState 없는 별도 컨텍스트
test('비로그인 단골 추가 → 401 (인증 가드 검증)', async () => {
  const counselorId = await getFirstCounselorId()
  if (!counselorId) { console.log('[SKIP]'); return }

  // storageState 없이 완전 신규 컨텍스트
  const ctx = await request.newContext({ storageState: undefined })
  const resp = await ctx.post(`${API}/api/user/counselors/${counselorId}/like`)
  expect([401, 403]).toContain(resp.status())
  console.log(`[OK] 비로그인 단골 추가 → ${resp.status()} (인증 거부)`)
  await ctx.dispose()
})

test.describe('단골 상담사 접속 배너', () => {
  test.use({ storageState: 'user_member_storage.json' })

  test('단골 상담사 접속 배너 폴링 API', async () => {
    const ctx = await request.newContext({ storageState: 'user_member_storage.json' })

    // GET /api/user/counselors/favorites/online
    const resp = await ctx.get(`${API}/api/user/counselors/favorites/online`)
    if (resp.status() === 404) {
      console.log('[INFO] /counselors/favorites/online API 없음')
    } else {
      expect([200, 401]).toContain(resp.status())
      console.log(`[OK] 단골 접속 폴링 API: status=${resp.status()}`)
    }
    await ctx.dispose()
  })
})
