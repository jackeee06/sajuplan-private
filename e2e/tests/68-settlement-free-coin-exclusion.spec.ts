import { test, expect } from '@playwright/test'

/**
 * 상담사 정산금액(마이페이지 카드)에 회원용 무료코인이 섞이지 않는지 검증 (2026-06-12 버그 수정).
 *
 * 버그: settlements.service.ts summary() 의 "기타정산비" 합산이 balance_kind 필터를 빼먹어,
 *       상담사가 *회원으로서* 받은 무료코인(출석/가입 = consumer)까지 정산금액으로 끌어옴.
 *       → 일 안 한 상담사도 정산금액이 수천~만원으로 부풀려짐.
 * 수정: other_plus/other_minus 에 `balance_kind='earning'` 추가.
 *
 * 검증: dummy_01(도운선생) = 상담사. 이번달 실제 상담수익 0 + 회원 무료코인 보유.
 *       → 수정 후 estimated_payout 은 0 이어야 한다 (예전 버그땐 무료코인 때문에 >0 이었음).
 */
const API = 'https://api.sajuplan.com'

test.use({ storageState: 'user_counselor_storage.json' }) // dummy_01 = 도운선생(상담사)

test.describe('정산금액 — 회원 무료코인 제외', () => {
  test('실제 상담수익 0인 상담사는 정산금액도 0 (무료코인 안 섞임)', async ({ page }) => {
    await page.goto('/') // origin 활성화 → 쿠키 포함 fetch 가능

    const res = await page.evaluate(async (apiBase) => {
      const r = await fetch(`${apiBase}/api/user/settlements/summary`, { credentials: 'include' })
      return { status: r.status, body: await r.json().catch(() => null) }
    }, API)

    expect(res.status, `summary 응답 비정상: ${JSON.stringify(res).slice(0, 200)}`).toBe(200)
    const b = res.body as { estimated_payout: number; this_month: number; balance: number }

    // 핵심: 정산예상금액에 회원 무료코인이 안 섞여야 함.
    // 도운선생은 이번달 상담 적립(this_month)=0 → 정산예상도 0 이어야 한다.
    expect(b.this_month, `this_month 가 0이 아님(테스트 전제 변경): ${JSON.stringify(b)}`).toBe(0)
    expect(
      b.estimated_payout,
      `정산금액에 무료코인이 섞임 — 버그 재발 의심: ${JSON.stringify(b)}`,
    ).toBe(0)
  })
})
