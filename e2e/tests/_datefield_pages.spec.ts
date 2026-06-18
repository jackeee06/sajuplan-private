import { test } from '@playwright/test'
import fs from 'fs'
const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_datefield'
fs.mkdirSync(SHOT, { recursive: true })
test.use({ viewport: { width: 1500, height: 950 } })

const pages = [
  ['consult', 'https://sajuplan.com/mng/consultations'],
  ['payouts', 'https://sajuplan.com/mng/payouts'],
  ['apply', 'https://sajuplan.com/mng/counselor-apply'],
  ['refunds', 'https://sajuplan.com/mng/refunds'],
]
for (const [name, url] of pages) {
  test(`datefield ${name}`, async ({ page }) => {
    await page.goto(url)
    await page.waitForLoadState('load').catch(() => {})
    await page.waitForTimeout(2200)
    await page.screenshot({ path: `${SHOT}/${name}.png`, clip: { x: 150, y: 90, width: 1180, height: 320 } })
  })
}
