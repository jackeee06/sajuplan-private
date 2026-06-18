import { test } from '@playwright/test'
import fs from 'fs'
const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_ccguide_shot'
fs.mkdirSync(SHOT, { recursive: true })
test.use({ viewport: { width: 1500, height: 1000 } })
test('coupon coin guide layout', async ({ page }) => {
  await page.goto('https://sajuplan.com/mng/coupon-coin-guide')
  await page.waitForLoadState('load').catch(() => {})
  await page.waitForTimeout(2200)
  await page.screenshot({ path: `${SHOT}/guide.png` })
})
