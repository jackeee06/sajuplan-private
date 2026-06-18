import { test } from '@playwright/test'
import fs from 'fs'
const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_sangdam'
fs.mkdirSync(SHOT, { recursive: true })
test.use({ viewport: { width: 1500, height: 950 } })

const pages = [
  ['report', 'https://sajuplan.com/mng/review-reports'],
  ['qa', 'https://sajuplan.com/mng/posts/qa'],
  ['inquiry', 'https://sajuplan.com/mng/counselor-inquiries'],
  ['chat', 'https://sajuplan.com/mng/chat-history'],
]
for (const [name, url] of pages) {
  test(`sangdam ${name}`, async ({ page }) => {
    await page.goto(url)
    await page.waitForLoadState('load').catch(() => {})
    await page.waitForTimeout(2400)
    await page.screenshot({ path: `${SHOT}/${name}.png`, clip: { x: 150, y: 80, width: 1200, height: 560 } })
  })
}
