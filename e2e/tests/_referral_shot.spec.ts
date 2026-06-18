import { test } from '@playwright/test'
import fs from 'fs'
const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_referral_shot'
fs.mkdirSync(SHOT, { recursive: true })
test.use({ viewport: { width: 1500, height: 900 } })
test('referral layout', async ({ page }) => {
  await page.goto('https://sajuplan.com/mng/referrals')
  await page.waitForLoadState('load').catch(() => {})
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${SHOT}/referrals.png` })
})
