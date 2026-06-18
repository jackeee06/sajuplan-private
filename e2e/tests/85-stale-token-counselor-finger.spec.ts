import { test, expect } from '@playwright/test'
import crypto from 'crypto'

/**
 * 홍루연 시나리오 재현 — "승격된 상담사 + 낡은(role=user) 토큰" 으로 계좌 저장 손가락 테스트.
 *
 * 토큰 위조에 서버 시크릿이 필요하므로 STALE_JWT_SECRET 환경변수가 있을 때만 실행.
 * (시크릿은 커밋하지 않는다. 평소 CI/일반 실행에서는 자동 skip.)
 *
 * 실행:
 *   STALE_JWT_SECRET=<서버 USER_JWT_SECRET> STALE_SUB=141 npx playwright test tests/85-stale-token-counselor-finger.spec.ts
 */
const SECRET = process.env.STALE_JWT_SECRET
const SUB = Number(process.env.STALE_SUB ?? '141') // e2e_dual = 141 (DB role=counselor)

const BANK = '우리'
const HOLDER = '테스트계좌'
const ACCOUNT = '1002000000000'

function b64u(b: Buffer | string): string {
  return Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
function signStaleUserToken(secret: string, sub: number): string {
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  // 핵심: role='user' (승격 전 발급된 낡은 토큰 모사) — 실제 DB 는 counselor
  const payload = b64u(JSON.stringify({ sub, mb_id: 'e2e_dual', role: 'user', level: 1, iat: now, exp: now + 3600 }))
  const data = `${header}.${payload}`
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${data}.${sig}`
}

test.describe('stale 토큰 상담사 — 계좌 저장(손가락) 재현', () => {
  test.skip(!SECRET, 'STALE_JWT_SECRET 미설정 — 위조 토큰 테스트 skip')

  test('낡은 role=user 토큰으로도 계좌 저장이 끝까지 성공', async ({ browser }) => {
    const token = signStaleUserToken(SECRET!, SUB)
    const context = await browser.newContext()
    // 낡은(role=user) 토큰을 sjm_user 쿠키로 주입 — 재로그인/재설치 없이 기존 토큰 상황 모사
    // 도메인 앞 점(.) = 전 서브도메인 → sajuplan.com(프론트) + api.sajuplan.com(API) 모두 전달
    await context.addCookies([
      { name: 'sjm_user', value: token, domain: '.sajuplan.com', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    ])
    const page = await context.newPage()
    let nativeDialogFired = false
    page.on('dialog', (d) => { nativeDialogFired = true; void d.dismiss() })

    // 마이페이지(상담사)가 열려야 함 = me() 가 DB live role(counselor)로 페이지 허용
    await page.goto('/counselor/mypage/bank', { waitUntil: 'domcontentloaded' })
    expect(page.url()).not.toContain('/login')

    // 손가락: 등록 → 입력 → 저장 → 인앱 확인창 저장
    await page.getByRole('button', { name: /^(등록|변경)$/ }).first().click()
    await page.locator('select').selectOption(BANK)
    const holder = page.getByPlaceholder('홍길동')
    await holder.clear(); await holder.fill(HOLDER)
    const acct = page.getByPlaceholder(/숫자만 입력/)
    await acct.clear(); await acct.fill(ACCOUNT)
    await expect(page.getByText('13자리 입력됨 ✓')).toBeVisible()

    await page.getByRole('button', { name: '저장' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: '저장' }).click()

    // 핵심: 낡은 토큰인데도 "상담사만 접근할 수 있습니다" 가 뜨면 안 됨
    await expect(page.getByText('상담사만 접근할 수 있습니다.')).toHaveCount(0)
    // 저장 성공 → 카드에 정보 노출
    await expect(page.getByText(HOLDER, { exact: false })).toBeVisible({ timeout: 12000 })
    await expect(page.getByText(ACCOUNT, { exact: false })).toBeVisible({ timeout: 12000 })
    expect(nativeDialogFired).toBe(false)
    console.log('[OK] 낡은 role=user 토큰으로도 계좌 저장 성공 (가드 live role 갱신 검증)')

    await context.close()
  })
})
