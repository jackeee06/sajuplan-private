import { test, expect } from '@playwright/test'
import fs from 'fs'
const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_postlist_shot'
fs.mkdirSync(SHOT, { recursive: true })
test.use({ viewport: { width: 1500, height: 950 } })
test('datefield toolbar crop', async ({ page }) => {
  await page.goto('https://sajuplan.com/mng/posts/review')
  await page.waitForLoadState('load').catch(() => {})
  await page.waitForTimeout(2500)
  // crop the toolbar region (date fields live here)
  await page.screenshot({ path: `${SHOT}/toolbar.png`, clip: { x: 150, y: 120, width: 1100, height: 90 } })
  // click first date field to confirm calendar opens (no crash)
  const dateFld = page.locator('text=/시작일|\\d{4}-\\d{2}-\\d{2}/').first()
  await dateFld.click().catch(() => {})
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${SHOT}/toolbar_open.png`, clip: { x: 150, y: 120, width: 1100, height: 400 } })
})
