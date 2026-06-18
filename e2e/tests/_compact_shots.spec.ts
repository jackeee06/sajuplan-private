import { test } from '@playwright/test'
import fs from 'fs'

const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_compact_shots'
fs.mkdirSync(SHOT, { recursive: true })
const MNG = 'https://sajuplan.com/mng'

test.use({ viewport: { width: 1366, height: 900 } })

const PAGES: [string, string][] = [
  ['members/counselor-apply', 'CounselorApply'],
  ['events', 'Events'],
  ['coupon-zones', 'CouponZones'],
  ['notices', 'Notices'],
]

for (const [path, name] of PAGES) {
  test(`compact shot: ${name}`, async ({ page }) => {
    await page.goto(`${MNG}/${path}`)
    await page.waitForLoadState('load').catch(() => {})
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${SHOT}/${name}.png` })
  })
}
