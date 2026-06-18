import { test, expect } from '@playwright/test'

/**
 * [2026-06-11 · 관리자 보안 hardening 회귀]
 *  B 🔴 admin/settings GET 이 OAuth/보안 시크릿(kakao_client_secret, naver_secret,
 *       apple_private_key, recaptcha_secret 등)을 평문 반환하던 문제 → 마스킹('********') 검증.
 *
 * admin 세션(super) 으로 /mng/settings 진입 시 발생하는 GET /admin/settings 응답을 가로채
 * 시크릿 패턴 키의 값이 평문으로 새지 않는지(빈 값 또는 '********') 확인.
 *
 * 관리자 비번 미설정으로 세션 없으면 graceful skip.
 */

const SECRET = /(secret|private_key|password|passwd)/i

test.describe('관리자 보안 hardening (admin)', () => {
  test.use({ storageState: 'storageState.json' })

  test('B: GET /admin/settings 시크릿 평문 노출 없음(마스킹)', async ({ page }) => {
    const bodies: Record<string, unknown>[] = []
    page.on('response', async (r) => {
      if (r.request().method() !== 'GET') return
      if (!/\/api\/admin\/settings(\/[^/?]+)?(\?|$)/.test(r.url())) return
      const j = await r.json().catch(() => null)
      if (j) bodies.push(j as Record<string, unknown>)
    })

    await page.goto('/mng/settings', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3500)
    if (/\/mng\/login/.test(page.url())) test.skip(true, 'admin 세션 없음 — E2E_ADMIN_PW 확인')

    expect(bodies.length, '/admin/settings GET 응답 수신').toBeGreaterThan(0)

    const leaks: string[] = []
    const checkFlat = (ns: string, obj: Record<string, unknown>) => {
      for (const k of Object.keys(obj)) {
        if (SECRET.test(k)) {
          const v = String(obj[k] ?? '')
          if (v !== '' && v !== '********') leaks.push(`${ns}.${k}=${v.slice(0, 6)}…`)
        }
      }
    }
    for (const body of bodies) {
      const data = (body.data ?? body) as Record<string, unknown>
      for (const ns of Object.keys(data)) {
        const v = data[ns]
        if (v && typeof v === 'object') checkFlat(ns, v as Record<string, unknown>)
        else if (SECRET.test(ns)) {
          const sv = String(v ?? '')
          if (sv !== '' && sv !== '********') leaks.push(`${ns}=${sv.slice(0, 6)}…`)
        }
      }
    }
    expect(leaks, `시크릿 평문 노출: ${leaks.join(', ')}`).toEqual([])
  })
})
