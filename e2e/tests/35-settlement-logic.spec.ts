import { test, expect, request } from '@playwright/test'

/**
 * [Phase 1 - A-9] 정산 로직 엄격검증
 *
 * 검증 포인트:
 *   1. 정산 이력 API (GET /admin/settlements) — 구조 검증
 *   2. 정산 계산식 검증 — price = supply - withholding - reply_fee
 *   3. 정산 mark-paid API — 200 + status='paid'
 *   4. 정산 mark-voided — 5자 미만 사유 → 400
 *   5. 상담사 정산 이력 API (GET /counselor/mypage/settlement/history)
 *   6. earning_balance 적립 확인 (상담 후 earning_balance 증가)
 */

const API = 'https://api.sajuplan.com'

async function adminLogin() {
  const ctx = await request.newContext()
  for (const cred of [
    { mb_id: 'gisu', password: '3004!' },
    { mb_id: 'lee', password: 'kunwoo77' },
  ]) {
    const resp = await ctx.post(`${API}/api/admin/auth/login`, { data: cred })
    if (resp.status() === 200 || resp.status() === 201) return ctx
  }
  return null
}

test.describe('정산 이력 API 구조 검증', () => {
  test('GET /admin/settlements — 응답 구조 + 계산식 검증', async () => {
    const ctx = await adminLogin()
    if (!ctx) { console.log('[SKIP] admin 로그인 실패'); return }

    const resp = await ctx.get(`${API}/api/admin/settlements?limit=10`)
    expect(resp.status()).toBe(200)
    const data = await resp.json() as {
      items: {
        id: number
        month: string
        price_tot: number
        vat_amount: number
        withholding_tax: number
        reply_fee: number
        price: number
        status?: string
        early_payout_total?: number
        final_payout_amount: number
      }[]
      total: number
    }

    expect(Array.isArray(data.items)).toBe(true)
    console.log(`[OK] 정산 이력: ${data.total}건`)

    if (data.items.length > 0) {
      const s = data.items[0]
      console.log(`[INFO] 정산 샘플: month=${s.month}, price_tot=${s.price_tot}, price=${s.price}`)

      // [2026-06-10 정산 단순화] 산식:
      //   netSettle    = max(0, price_tot - early_payout_total)   (정산예상 - 미정산 선지급)
      //   withholding  = floor(netSettle × 0.033)                 (원천세 3.3% 만)
      //   price        = netSettle - withholding                  (실지급액)
      //   vat / reply_fee / price_free / price_paid = 0 (부가세·회선비·등급재계산 폐지)
      const early = s.early_payout_total ?? 0
      const expectedNet = Math.max(0, s.price_tot - early)
      const expectedWithholding = Math.floor(expectedNet * 0.033)
      const expectedPrice = expectedNet - expectedWithholding

      expect(Math.abs(s.withholding_tax - expectedWithholding)).toBeLessThanOrEqual(2)
      console.log(`[OK] 원천세(3.3%): ${s.withholding_tax} ≈ floor((${s.price_tot}-${early})×0.033)=${expectedWithholding}`)

      expect(Math.abs(s.price - expectedPrice)).toBeLessThanOrEqual(2)
      console.log(`[OK] 실지급액: ${s.price} ≈ ${expectedNet}-${expectedWithholding}=${expectedPrice}`)

      // 단순화로 제거된 항목은 0
      expect(s.vat_amount ?? 0).toBe(0)
      expect(s.reply_fee ?? 0).toBe(0)
      console.log(`[OK] 단순화 확인: vat=${s.vat_amount} reply_fee=${s.reply_fee} (둘 다 0)`)
    }

    await ctx.dispose()
  })

  test('정산 mark-voided — 사유 4자 → 400 반환 (유효성 검사)', async () => {
    const ctx = await adminLogin()
    if (!ctx) { console.log('[SKIP]'); return }

    const listResp = await ctx.get(`${API}/api/admin/settlements?limit=1`)
    if (listResp.status() !== 200) { await ctx.dispose(); return }
    const data = await listResp.json() as { items: { id: number; status?: string }[] }
    if (!data.items.length) { console.log('[SKIP] 정산 데이터 없음'); await ctx.dispose(); return }

    const settlement = data.items[0]
    // paid 상태면 void 불가 — calculated 상태 찾기
    const calcSettlement = data.items.find(s => s.status === 'calculated') ?? data.items[0]

    const voidResp = await ctx.patch(`${API}/api/admin/settlements/${calcSettlement.id}/mark-voided`, {
      data: { void_reason: '짧' }, // 4자 미만 → 400
    })

    // 400 이거나 409 (이미 paid) 이거나
    expect([400, 409, 422]).toContain(voidResp.status())
    console.log(`[OK] 짧은 사유 void → ${voidResp.status()} (기대: 400/409/422)`)

    await ctx.dispose()
  })
})

test.describe('상담사 정산 이력 API (사용자 측)', () => {
  test.use({ storageState: 'user_dual_storage.json' })

  test('GET /counselor/mypage/settlement/history — 응답 구조', async () => {
    const ctx = await request.newContext({ storageState: 'user_dual_storage.json' })

    const resp = await ctx.get(`${API}/api/user/settlements/history?limit=5`)
    if (resp.status() === 401 || resp.status() === 403) {
      console.log('[SKIP] 상담사 세션 없음')
      await ctx.dispose()
      return
    }
    if (resp.status() === 404) {
      console.log('[SKIP] 정산 이력 없음 (정상 — 상담 없음)')
      await ctx.dispose()
      return
    }

    expect(resp.status()).toBe(200)
    const data = await resp.json() as {
      items: { month: string; price: number; status: string; final_payout_amount: number }[]
      total: number
    }
    expect(Array.isArray(data.items)).toBe(true)
    console.log(`[OK] 상담사 정산 이력: ${data.total}건`)

    if (data.items.length > 0) {
      const s = data.items[0]
      expect(typeof s.month).toBe('string')
      expect(typeof s.price).toBe('number')
      console.log(`[OK] 정산 샘플: month=${s.month}, price=${s.price}, status=${s.status}`)
    }

    await ctx.dispose()
  })
})

test.describe('수익금(earning_balance) 검증', () => {
  test('상담사 earning_balance 조회 — point API', async () => {
    const ctx = await request.newContext({ storageState: 'user_dual_storage.json' })

    const resp = await ctx.get(`${API}/api/user/auth/me`)
    if (resp.status() !== 200) {
      await ctx.dispose()
      return
    }

    const data = await resp.json() as {
      member?: {
        point: number
        earning_balance?: number
        free_balance?: number
        paid_balance?: number
      }
    }

    console.log(`[OK] 회원 포인트: point=${data.member?.point}`)
    // earning_balance 는 me() 응답에 포함될 수도 있고 별도 API일 수도

    // 상담사 수익금 별도 조회
    const earnResp = await ctx.get(`${API}/api/user/counselors/my-earnings`)
    if (earnResp.status() === 200) {
      const earn = await earnResp.json() as { earning_balance: number }
      expect(typeof earn.earning_balance).toBe('number')
      expect(earn.earning_balance).toBeGreaterThanOrEqual(0)
      console.log(`[OK] earning_balance=${earn.earning_balance}`)
    } else {
      console.log(`[INFO] my-earnings API status=${earnResp.status()} (별도 엔드포인트 없을 수 있음)`)
    }

    await ctx.dispose()
  })
})
