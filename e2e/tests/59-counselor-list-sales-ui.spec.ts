import { test, expect } from '@playwright/test'
import fs from 'fs'

/** 상담사 리스트 매출 컬럼(이번달 전화 / 이번달 채팅) UI 확인 + 스크린샷 */
const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_sales_ui'
fs.mkdirSync(SHOT, { recursive: true })
const MNG = 'https://sajuplan.com/mng'

test.use({ viewport: { width: 1680, height: 950 } })

test('상담사 리스트에 이번달 전화/채팅 매출 컬럼이 분리되어 보인다', async ({ page }) => {
  await page.goto(`${MNG}/members/counselors`)
  await page.waitForLoadState('load').catch(() => {})
  await page.waitForTimeout(2000)

  // 새 컬럼 헤더 존재
  await expect(page.getByText('이번달 전화', { exact: true }), '이번달 전화 헤더 없음').toHaveCount(1)
  await expect(page.getByText('이번달 채팅', { exact: true }), '이번달 채팅 헤더 없음').toHaveCount(1)
  // 060 흔적 없어야
  await expect(page.getByText('이번달(070)', { exact: true })).toHaveCount(0)

  // 매출 컬럼이 보이도록 우측 끝까지 가로 스크롤 후 캡처
  await page.evaluate(() => {
    const sc = document.querySelector('[class*="overflow-x"], table')?.parentElement
    if (sc) sc.scrollLeft = sc.scrollWidth
  })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${SHOT}/01_sales_columns.png` })
})
