import { test, expect } from '@playwright/test'

/**
 * [2026-05-27] 비밀번호 변경 endpoint 정책 회귀 방지.
 *
 * 정책 (2026-05-25 강화):
 *   - 새 비번: 8~20자 + 영문/숫자 각 1개 이상 (auth.service.ts changePassword)
 *
 * 검증 시나리오 (안전 — 실제 변경 X):
 *   1. 약한 비번 (3자, 영문만, 숫자만) → 400 + 정책 메시지
 *   2. 적합한 비번 + 잘못된 현재 비번 → 400 "현재 비밀번호 일치하지 않습니다"
 *      (정책 위반 메시지는 안 나와야)
 *
 * 테스트 계정: e2e_member.
 */

test.use({ storageState: 'user_member_storage.json' })

test.describe('비밀번호 변경 정책', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.TARGET === 'prod') test.skip()
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const apiBase = 'https://api.sajumoon.kr'
    const result = await page.evaluate(async (base) => {
      try {
        const me = await fetch(`${base}/api/user/auth/me`, { credentials: 'include' })
        if (me.ok) {
          const j = await me.json().catch(() => null)
          if (j?.ok === true || j?.member) return { ok: true }
        }
        const login = await fetch(`${base}/api/user/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mb_id: 'e2e_member', password: 'e2e_test_2026' }),
          credentials: 'include',
        })
        return { ok: login.ok, status: login.status }
      } catch (e) {
        return { ok: false, error: (e as Error).message }
      }
    }, apiBase)
    if (!result.ok) test.skip(true, `e2e_member 인증 실패 (${JSON.stringify(result).slice(0, 80)})`)
  })

  async function tryChange(page: import('@playwright/test').Page, newPw: string) {
    return await page.evaluate(async ({ pw }) => {
      const r = await fetch('https://api.sajumoon.kr/api/user/auth/me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: 'WRONG_PASSWORD_E2E_TEST_DO_NOT_MATCH',
          new_password: pw,
        }),
        credentials: 'include',
      })
      const j = await r.json().catch(() => null)
      return { status: r.status, msg: JSON.stringify(j) }
    }, { pw: newPw })
  }

  test('3자리 → 400 + 길이 정책 메시지', async ({ page }) => {
    const r = await tryChange(page, 'abc')
    expect(r.status).toBe(400)
    expect(r.msg, `메시지에 길이 정책 단서 없음: ${r.msg}`).toMatch(/8|길이|자/)
  })

  test('영문만 8자리 → 400 + 혼합 메시지', async ({ page }) => {
    const r = await tryChange(page, 'abcdefgh')
    expect(r.status).toBe(400)
    expect(r.msg, `혼합 정책 메시지 없음: ${r.msg}`).toMatch(/영문|숫자|혼합|포함/)
  })

  test('숫자만 8자리 → 400 + 혼합 메시지', async ({ page }) => {
    const r = await tryChange(page, '12345678')
    expect(r.status).toBe(400)
    expect(r.msg, `혼합 정책 메시지 없음: ${r.msg}`).toMatch(/영문|숫자|혼합|포함/)
  })

  test('적합 비번 (영문+숫자 8자리) + 잘못된 현재 비번 → 정책 메시지 X', async ({ page }) => {
    const r = await tryChange(page, 'abc12345')
    expect(r.status).toBe(400)
    // 정책 위반 메시지는 안 나와야. "현재 비밀번호" 같은 다른 사유 메시지여야 함.
    expect(
      r.msg,
      `적합한 비번인데도 정책 메시지 노출됨: ${r.msg.slice(0, 200)}`,
    ).not.toMatch(/비밀번호는 8|영문과 숫자를/)
    // 현재 비번 불일치 메시지 기대
    expect(r.msg, '"현재 비밀번호" 관련 에러 메시지 없음').toMatch(/현재 비밀번호|일치/)
  })
})
