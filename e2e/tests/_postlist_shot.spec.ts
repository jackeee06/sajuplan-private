import { test } from '@playwright/test'
import fs from 'fs'
const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_postlist_shot'
fs.mkdirSync(SHOT, { recursive: true })
test.use({ viewport: { width: 1500, height: 950 } })
test('post review list id truncation', async ({ page }) => {
  await page.goto('https://sajuplan.com/mng/posts/review')
  await page.waitForLoadState('load').catch(() => {})
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${SHOT}/postlist.png` })
})
