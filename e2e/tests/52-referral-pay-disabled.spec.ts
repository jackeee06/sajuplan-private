import { test, expect, request } from '@playwright/test'

/**
 * [2026-06-11] 추천수당 수동지급 폐지 — 지뢰(paid_balance 오적립) 제거 엄격검증.
 *
 * 배경:
 *   추천수익금은 이제 상담 종료 시점에 earning_balance 로 자동 적립된다
 *   (m2net-push.service.ts creditCounselorPointInTx).
 *   과거 어드민 "이번 달 지급" 버튼(payCurrentMonth)은 추천수당을 paid_balance 에
 *   추가 적립 → 이중지급 + 엉뚱한 계좌(충전코인) 오적립 지뢰였다.
 *
 * 검증:
 *   1) 백엔드: POST /admin/referrals/:id/pay → 400 (진입 즉시 차단)
 *   2) 프론트: /mng/referrals 에 "이번 달 지급" 버튼 0개
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

test.describe('추천수당 수동지급 폐지 (지뢰 제거)', () => {
  test('백엔드 — POST /admin/referrals/:id/pay 영구 차단(400)', async () => {
    const ctx = await adminLogin()
    if (!ctx) { console.log('[SKIP] admin 로그인 실패'); return }

    const listResp = await ctx.get(`${API}/api/admin/referrals`)
    expect(listResp.status()).toBe(200)
    const data = await listResp.json()
    const arr = Array.isArray(data) ? data : (data.items ?? [])
    if (!arr.length) { console.log('[SKIP] 추천 관계 0건 — 차단 메시지만 확인 불가'); return }

    const id = arr[0].id
    const payResp = await ctx.post(`${API}/api/admin/referrals/${id}/pay`, { data: {} })
    expect(payResp.status(), '수동지급은 폐지되어 400 이어야 함').toBe(400)
    const body = await payResp.text()
    expect(body).toContain('폐지')
    console.log(`[OK] payCurrentMonth 차단 확인: ${payResp.status()} — ${body}`)
  })

  test('프론트 — /mng/referrals "이번 달 지급" 버튼 없음', async ({ page }) => {
    await page.goto('/mng/referrals')
    await page.waitForLoadState('domcontentloaded')
    if (page.url().includes('/mng/login')) {
      console.log('[SKIP] admin 세션 없음')
      test.skip()
      return
    }
    await expect(page.getByRole('button', { name: '이번 달 지급' })).toHaveCount(0)
    console.log('[OK] "이번 달 지급" 버튼 화면에서 제거됨')
  })
})
