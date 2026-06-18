import { test } from '@playwright/test'
import fs from 'fs'
const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_payout_shot'
fs.mkdirSync(SHOT, { recursive: true })
test.use({ viewport: { width: 1500, height: 900 } })
test('payout layout', async ({ page }) => {
  await page.goto('https://sajuplan.com/mng/payouts')
  await page.waitForLoadState('load').catch(() => {})
  await page.waitForTimeout(2200)
  await page.screenshot({ path: `${SHOT}/payouts.png` })
})
