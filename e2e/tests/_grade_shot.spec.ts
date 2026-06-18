import { test } from '@playwright/test'
import fs from 'fs'
const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_grade_shot'
fs.mkdirSync(SHOT, { recursive: true })
test.use({ viewport: { width: 1366, height: 900 } })
test('grade compact header shot', async ({ page }) => {
  await page.goto('https://sajuplan.com/mng/grade')
  await page.waitForLoadState('load').catch(() => {})
  await page.waitForTimeout(2200)
  await page.screenshot({ path: `${SHOT}/grade.png` })
})
