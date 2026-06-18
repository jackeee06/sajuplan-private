import { test } from '@playwright/test'
import fs from 'fs'
const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_idtrunc_shot'
fs.mkdirSync(SHOT, { recursive: true })
test.use({ viewport: { width: 1500, height: 900 } })
test('points history id truncation', async ({ page }) => {
  await page.goto('https://sajuplan.com/mng/points/history')
  await page.waitForLoadState('load').catch(() => {})
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${SHOT}/points.png` })
})
