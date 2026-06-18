import { test, expect } from '@playwright/test'
import fs from 'fs'

/** 사용(상담) 내역 — 긴 ID 말줄임 + 전체 ID 툴팁 확인 + 스크린샷 */
const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_id_trunc'
fs.mkdirSync(SHOT, { recursive: true })
const MNG = 'https://sajuplan.com/mng'

test.use({ viewport: { width: 1680, height: 950 } })

test('긴 ID는 말줄임 + 전체 ID 툴팁(title) 보유', async ({ page }) => {
  await page.goto(`${MNG}/consultations`)
  await page.waitForLoadState('load').catch(() => {})
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `${SHOT}/01_list.png` })

  // ID 링크에 title(전체 ID)이 달려 있고, truncate(max-w)가 적용됐는지
  const idLinks = page.locator('a[href*="/members/"][title]')
  const cnt = await idLinks.count()
  expect(cnt, 'ID 링크가 없음(전제 미충족)').toBeGreaterThan(0)

  // 긴 소셜 ID(_N/_K 접미사 + 20자+) 하나 검사
  let foundLong = false
  for (let i = 0; i < Math.min(cnt, 40); i++) {
    const el = idLinks.nth(i)
    const title = (await el.getAttribute('title')) ?? ''
    if (title.length >= 20) {
      foundLong = true
      // 표시 박스 폭이 제한(말줄임)됐는지 — 실제 렌더 폭이 title 전체폭보다 작아야
      const cls = (await el.getAttribute('class')) ?? ''
      expect(cls, '말줄임(truncate/max-w) 클래스 없음').toMatch(/truncate|max-w/)
      const box = await el.boundingBox()
      expect(box!.width, `긴 ID가 안 줄어듦(width=${box!.width})`).toBeLessThanOrEqual(160)
      break
    }
  }
  expect(foundLong, '긴 소셜 ID가 목록에 없음(전제)').toBe(true)
})
