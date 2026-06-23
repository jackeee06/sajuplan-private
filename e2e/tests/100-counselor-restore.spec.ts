import { test, expect } from '@playwright/test'
import { skipIfAdminLoginFailed } from '../helpers/admin-skip'

/**
 * 탈퇴 상담사 복구 API 검증 (2026-06-23) — counselor/08-withdrawal-restore.
 *
 * 배경: 상담사가 탈퇴 후 같은 전화로 재가입 → 계정 둘로 갈라져 재승인 실패.
 *   해결: 옛 계정을 복구(left_at 비움 + 중복 새계정 정리 + csrid 있으면 m2net 재연동 불필요).
 *
 * 안전한 검증(부수효과 0): 이미 "활성"인 상담사(267, 이아린)에 복구를 호출하면
 *   restoreCounselor 가 left_at==null 분기로 즉시 { restored:false } 반환 — UPDATE 0건.
 *   → 엔드포인트가 살아있고 안전하게 동작함을 확인.
 */

const API_BASE = 'https://api.sajuplan.com'
const ACTIVE_COUNSELOR_ID = 267 // 이아린(복구 완료 = 활성). 활성이라 복구 호출해도 변경 없음.

test.describe('탈퇴 상담사 복구', () => {
  test.beforeEach(skipIfAdminLoginFailed)

  test('이미 활성 상담사 복구 호출 → restored=false (부수효과 0)', async ({ page }) => {
    await page.goto('/mng/dashboard')
    expect(page.url(), '어드민 로그인 안 됨').not.toContain('/mng/login')

    const res = await page.evaluate(async ([base, id]) => {
      const r = await fetch(`${base}/api/admin/members/counselors/${id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      })
      let body: unknown = null
      try { body = await r.json() } catch { /* ignore */ }
      return { status: r.status, body }
    }, [API_BASE, ACTIVE_COUNSELOR_ID] as [string, number])

    expect([200, 201], `예상치 못한 status ${res.status}`).toContain(res.status)
    const b = (res.body ?? {}) as { ok?: boolean; restored?: boolean; message?: string }
    expect(b.ok, '복구 응답 ok 아님').toBe(true)
    // 이미 활성 → 복구 안 함(부수효과 0)
    expect(b.restored, '활성인데 restored=true (부수효과 발생!)').toBe(false)
    expect(JSON.stringify(b)).toContain('이미 활성')
  })
})
