import { test, expect, request } from '@playwright/test'

/**
 * [Phase E2E] 실시간 등급 승급 — 인앱 토스트 실제 발화 검증 (2026-06-07 최종)
 *
 * ★ 출석 토스트 방식으로 전환:
 *   Login.tsx 가 로그인 직후 counselorGradeApi.pendingUpgrade() 를 호출하고
 *   sessionStorage 에 저장 → GradeUpgradeToast 가 다음 라우트 전환에서 1회 표시.
 *
 * 흐름 (실제 앱과 동일):
 *   1. DB 에 미확인 승급 주입 (cron/test-inapp-alert)
 *   2. 로그인 페이지에서 jackee 로그인 → Login.tsx 가 pendingUpgrade() 호출 → sessionStorage 저장
 *   3. 마이페이지로 리디렉션 → GradeUpgradeToast 가 sessionStorage 읽어 🎉 모달 표시
 *
 * 전제: CRON_TOKEN 환경변수 필요.
 */

const FRONT = 'https://sajuplan.com'
const API = 'https://api.sajuplan.com'
const CRON_TOKEN = process.env.CRON_TOKEN ?? ''
const CREDS = { mb_id: 'jackee', password: 'kunwoo77' }

async function injectUpgrade() {
  const ctx = await request.newContext()
  const r = await ctx.get(
    `${API}/api/cron/test-inapp-alert?mb_id=jackee&token=${CRON_TOKEN}`,
    { timeout: 15_000 },
  )
  await ctx.dispose()
  return r.status()
}

async function cleanup() {
  const ctx = await request.newContext()
  await ctx.get(
    `${API}/api/cron/test-inapp-alert?mb_id=jackee&cleanup=1&token=${CRON_TOKEN}`,
    { timeout: 15_000 },
  ).catch(() => {})
  await ctx.dispose()
}

test.describe('실시간 등급 승급 — 인앱 토스트 실발화', () => {
  test.describe.configure({ mode: 'serial' })

  test.afterAll(async () => {
    if (CRON_TOKEN) await cleanup()
  })

  test('미확인 승급 주입 → 로그인 → 🎉 토스트 표시', async ({ page }) => {
    test.skip(!CRON_TOKEN, 'CRON_TOKEN 미설정 — skip')
    await cleanup()

    // 1) DB에 미확인 승급 주입
    const status = await injectUpgrade()
    expect(status).toBe(200)

    // 2) 로그인 페이지에서 직접 로그인 (Login.tsx 가 pendingUpgrade 호출 + sessionStorage 저장)
    await page.goto(`${FRONT}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 })

    // pending-upgrade API 호출 관찰 (Login.tsx 에서 로그인 직후 호출)
    const upgradeApiLog: string[] = []
    page.on('response', async (res) => {
      if (res.url().includes('/grade/pending-upgrade')) {
        const b = await res.json().catch(() => null)
        upgradeApiLog.push(`status=${res.status()} upgrade=${b?.upgrade ? b.upgrade.grade_label : 'null'}`)
      }
    })

    // 아이디/비밀번호 입력 후 로그인
    await page.getByRole('textbox').first().fill(CREDS.mb_id)
    await page.getByRole('textbox').nth(1).fill(CREDS.password)
    await page.locator('button[type="submit"]').click()

    // 3) 로그인 후 상담사 마이페이지로 이동 (role='counselor' 라 자동 리디렉션)
    await page.waitForURL(/\/counselor\/mypage/, { timeout: 20_000 })

    // 🎉 승급 모달 발화 확인 (sessionStorage → GradeUpgradeToast → 다음 라우트에서 표시)
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible({ timeout: 10_000 })
    console.log('[pending-upgrade API 호출]', JSON.stringify(upgradeApiLog))

    const changeBtn = page.getByRole('button', { name: '단가 변경하기' })
    await expect(changeBtn).toBeVisible({ timeout: 5_000 })
    await expect(dialog).toContainText('승급')
    console.log('[popup] 🎉 승급 인앱 토스트 실제 발화 확인')

    await changeBtn.click()
    await expect(page).toHaveURL(/\/counselor\/mypage/, { timeout: 5_000 })
  })

  test('대조군 — 미확인 승급 없으면 로그인 후 토스트 미표시', async ({ page }) => {
    test.skip(!CRON_TOKEN, 'CRON_TOKEN 미설정 — skip')
    await cleanup()

    await page.goto(`${FRONT}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.getByRole('textbox').first().fill(CREDS.mb_id)
    await page.getByRole('textbox').nth(1).fill(CREDS.password)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL(/\/counselor\/mypage/, { timeout: 20_000 })

    await page.waitForTimeout(5_000)
    const changeBtn = page.getByRole('button', { name: '단가 변경하기' })
    await expect(changeBtn).toHaveCount(0)
  })
})
