import { test } from '@playwright/test'
import fs from 'fs'
const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_sidebar'
fs.mkdirSync(SHOT, { recursive: true })
test.use({ viewport: { width: 1400, height: 950 } })
test('sidebar group label', async ({ page }) => {
  await page.goto('https://sajuplan.com/mng/posts/qa')
  await page.waitForLoadState('load').catch(() => {})
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${SHOT}/sidebar.png`, clip: { x: 0, y: 130, width: 280, height: 480 } })
})
