import { test, expect } from '@playwright/test'
import { skipIfAdminLoginFailed } from '../helpers/admin-skip'

/**
 * 정산 대상월 가드 검증 (2026-06-14) — 진행 중/미래 달 정산 차단.
 *
 * 배경: 테스트가 "이번 달(2026-06)"을 정산 대상으로 돌려 당월 적립분까지 조기 정산 →
 *       전월 400원이 정상인데 10,053원이 알림톡으로 나간 사고(#56).
 *   → 정산 대상월을 "완료된 달(전월 이하)"로 제한. 어드민 settleNow 는 명시적 거부.
 *
 * 안전한 검증: 미래월(2099-12)은 항상 거부되며 부수효과(정산 생성·알림톡) 0.
 *   POST /admin/settlements/:id/settle-now?month=2099-12 → 400 + "아직 마감되지 않은".
 */

const API_BASE = 'https://api.sajuplan.com'
const COUNSELOR_ID = 91 // 찬물선생(jackee) — 실제 상담사

test.describe('정산 대상월 가드', () => {
  test.beforeEach(skipIfAdminLoginFailed)

  test('미래월 정산 요청은 400 거부 (부수효과 0)', async ({ page }) => {
    // 어드민 세션 origin 확보 (storageState.json = admin 쿠키)
    await page.goto('/mng/dashboard')
    expect(page.url(), '어드민 로그인 안 됨').not.toContain('/mng/login')

    const res = await page.evaluate(async ([base, id]) => {
      const r = await fetch(`${base}/api/admin/settlements/${id}/settle-now?month=2099-12`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      let body: unknown = null
      try { body = await r.json() } catch { /* ignore */ }
      return { status: r.status, body }
    }, [API_BASE, COUNSELOR_ID] as [string, number])

    // 400 거부 + 명확한 안내 문구
    expect(res.status, `미래월인데 거부 안 됨 (status ${res.status})`).toBe(400)
    const msg = JSON.stringify(res.body ?? {})
    expect(msg, '가드 안내 문구 없음').toContain('아직 마감되지 않은')
    expect(msg).toContain('정산할 수 없습니다')
  })
})
