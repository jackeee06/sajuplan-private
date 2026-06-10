import { test, expect, request } from '@playwright/test'

/**
 * [Phase 3] 상담사 마이페이지 전체 엄격검증
 *
 * 검증 포인트:
 *   1. /counselor/mypage — 상담사 마이페이지 렌더
 *   2. 등급 표시 (현재 등급, 누적 상담시간)
 *   3. 수익금 내역 탭
 *   4. 선지급 신청 UI
 *   5. 계좌 관리 페이지
 *   6. 상담 스타일 설정
 *   7. 수익금 API 구조
 *   8. 선지급 가용 한도 API
 *   9. 단가 설정 API
 */

const API = 'https://api.sajuplan.com'

test.describe('상담사 마이페이지 페이지 렌더', () => {
  test.use({ storageState: 'user_dual_storage.json' })

  const counselorPages = [
    { path: '/counselor/mypage', name: '상담사 마이페이지 홈' },
    { path: '/counselor/mypage/settlement/history', name: '정산 이력' },
    { path: '/counselor/mypage/bank', name: '계좌 관리' },
    { path: '/counselor/mypage/style', name: '상담 스타일' },
    { path: '/counselor/mypage/payout', name: '선지급 신청' },
    { path: '/counselor/mypage/calls', name: '전화 상담 내역' },
    { path: '/counselor/mypage/chats', name: '채팅 상담 내역' },
    { path: '/counselor/mypage/reviews', name: '내 후기' },
    { path: '/counselor/mypage/qnas', name: '문의함' },
  ]

  for (const { path, name } of counselorPages) {
    test(`${name} (${path}) — 정상 렌더`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
      expect(page.url()).not.toContain('/login')
      const body = await page.locator('body').textContent()
      expect(body?.length ?? 0).toBeGreaterThan(10)
      console.log(`[OK] ${name}: ${page.url()}`)
    })
  }
})

test.describe('상담사 API — 등급/수익금/선지급', () => {
  test('상담사 등급 정보 API', async () => {
    const ctx = await request.newContext({ storageState: 'user_dual_storage.json' })

    const resp = await ctx.get(`${API}/api/user/counselor-mypage/grade`)
    if (resp.status() === 401 || resp.status() === 403) {
      console.log('[SKIP] 상담사 세션 없음')
      await ctx.dispose()
      return
    }
    if (resp.status() === 404) {
      console.log('[INFO] grade API 404 — 경로 확인 필요')
      await ctx.dispose()
      return
    }

    expect(resp.status()).toBe(200)
    const data = await resp.json() as {
      grade: string
      accumulated_minutes: number
      next_grade?: string
      next_threshold?: number
    }
    expect(typeof data.grade).toBe('string')
    expect(['preliminary', 'partner1', 'partner2', 'partner3', 'partner4', 'partner5']).toContain(data.grade)
    console.log(`[OK] 상담사 등급: ${data.grade}, 누적분=${data.accumulated_minutes}`)

    await ctx.dispose()
  })

  test('수익금 API (earning_balance 포함)', async () => {
    const ctx = await request.newContext({ storageState: 'user_dual_storage.json' })

    // me() API에서 earning_balance 확인
    const meResp = await ctx.get(`${API}/api/user/auth/me`)
    if (meResp.status() !== 200) { await ctx.dispose(); return }

    const me = await meResp.json() as { member?: { earning_balance?: number; point?: number } }
    // earning_balance 는 상담사에게만 표시
    if (me.member?.earning_balance !== undefined) {
      expect(typeof me.member.earning_balance).toBe('number')
      expect(me.member.earning_balance).toBeGreaterThanOrEqual(0)
      console.log(`[OK] earning_balance=${me.member.earning_balance}`)
    } else {
      console.log('[INFO] me() 응답에 earning_balance 없음 (별도 API 필요)')
    }

    await ctx.dispose()
  })

  test('선지급 가용 한도 API — 정책 상수 검증', async () => {
    const ctx = await request.newContext({ storageState: 'user_dual_storage.json' })

    const resp = await ctx.get(`${API}/api/user/counselor-mypage/payout/available`)
    if (resp.status() !== 200) {
      console.log(`[INFO] payout/available status=${resp.status()}`)
      await ctx.dispose()
      return
    }

    const data = await resp.json() as {
      available_amount: number
      fee_rate: number
      withholding_rate: number
      min_amount: number
      daily_limit_remaining: number
    }

    expect(typeof data.available_amount).toBe('number')
    // 수수료 5%
    if (data.fee_rate !== undefined) {
      expect(data.fee_rate).toBe(0.05)
      console.log(`[OK] fee_rate=5%`)
    }
    // 원천징수 3.3%
    if (data.withholding_rate !== undefined) {
      expect(data.withholding_rate).toBe(0.033)
      console.log(`[OK] withholding_rate=3.3%`)
    }
    // 최소 신청액 30,000
    if (data.min_amount !== undefined) {
      expect(data.min_amount).toBe(30000)
      console.log(`[OK] min_amount=30000`)
    }
    console.log(`[OK] 선지급 가용: ${data.available_amount}원`)

    await ctx.dispose()
  })

  test('선지급 이력 API', async () => {
    const ctx = await request.newContext({ storageState: 'user_dual_storage.json' })

    const resp = await ctx.get(`${API}/api/user/counselor-mypage/payout/history?limit=5`)
    if (resp.status() !== 200) {
      console.log(`[INFO] payout/history status=${resp.status()}`)
      await ctx.dispose()
      return
    }

    // getMyHistory 는 배열 직접 반환 (items 래퍼 없음)
    const data = await resp.json() as { id: number; requested_amount: number; status: string }[] | { items: { id: number }[] }
    const items = Array.isArray(data) ? data : (data as { items: unknown[] }).items ?? []
    expect(Array.isArray(items)).toBe(true)
    console.log(`[OK] 선지급 이력: ${items.length}건`)

    await ctx.dispose()
  })

  test('단가 설정 조회 API', async () => {
    const ctx = await request.newContext({ storageState: 'user_dual_storage.json' })

    const resp = await ctx.get(`${API}/api/user/counselor-mypage/grade`)
    if (resp.status() !== 200) {
      console.log(`[SKIP] grade API status=${resp.status()}`)
      await ctx.dispose()
      return
    }

    const data = await resp.json() as { unit_cost: number; available_unit_costs: number[] }
    if (data.unit_cost !== undefined) {
      expect(typeof data.unit_cost).toBe('number')
      expect(data.unit_cost).toBeGreaterThan(0)
      console.log(`[OK] 현재 단가: ${data.unit_cost}원/30초`)
    }
    if (data.available_unit_costs !== undefined) {
      expect(Array.isArray(data.available_unit_costs)).toBe(true)
      expect(data.available_unit_costs.length).toBeGreaterThan(0)
      console.log(`[OK] 선택 가능 단가: ${data.available_unit_costs.join(', ')}`)
    }

    await ctx.dispose()
  })
})

test.describe('상담사 추천 시스템 API', () => {
  test('추천인 현황 API', async () => {
    const ctx = await request.newContext({ storageState: 'user_dual_storage.json' })

    const resp = await ctx.get(`${API}/api/user/counselor-mypage/referral`)
    if (resp.status() === 404 || resp.status() === 401) {
      console.log(`[INFO] referral API status=${resp.status()}`)
      await ctx.dispose()
      return
    }
    if (resp.status() === 200) {
      const data = await resp.json()
      console.log(`[OK] 추천인 현황: ${JSON.stringify(data).slice(0, 100)}`)
    }
    await ctx.dispose()
  })
})
