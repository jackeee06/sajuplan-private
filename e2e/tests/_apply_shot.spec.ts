import { test } from '@playwright/test'
import fs from 'fs'
const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_apply'
fs.mkdirSync(SHOT, { recursive: true })
const API = (process.env.TARGET ?? 'prod') === 'prod' ? 'api.sajuplan.com' : 'api.sajumoon.kr'
const DOM = (process.env.TARGET ?? 'prod') === 'prod' ? 'sajuplan.com' : 'sajumoon.kr'
test.use({ viewport: { width: 390, height: 1100 } })
test('counselor apply cleaned', async ({ page, context }) => {
  const res = await page.request.post(`https://${API}/api/user/auth/login`, {
    data: { mb_id: 'e2e_member', password: 'e2e_test_2026' },
  })
  const m = res.headers()['set-cookie']?.match(/sjm_user=([^;]+)/)
  if (m) await context.addCookies([{ name: 'sjm_user', value: m[1], domain: `.${DOM}`, path: '/', httpOnly: true, secure: true, sameSite: 'None' }])
  await page.goto('https://sajuplan.com/mypage/counselor-apply')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(2200)
  await page.screenshot({ path: `${SHOT}/apply.png` })
})
