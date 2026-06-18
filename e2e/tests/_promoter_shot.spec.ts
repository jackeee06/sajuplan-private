import { test, expect } from '@playwright/test'
import fs from 'fs'

const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_promoter_shot'
fs.mkdirSync(SHOT, { recursive: true })
const MNG = 'https://sajuplan.com/mng'

test.use({ viewport: { width: 1366, height: 900 } })

test('모집인 관리 — 압축 툴바 렌더 + 캡처', async ({ page }) => {
  await page.goto(`${MNG}/promoters`)
  await page.waitForLoadState('load').catch(() => {})
  await page.waitForTimeout(2000)
  await expect(page.getByRole('heading', { name: '모집인 관리(서포터즈)' })).toBeVisible({ timeout: 10_000 })
  // 한 줄 툴바: 등록 버튼 + 검색 + 필터칩이 같이 보여야
  await expect(page.getByRole('button', { name: /모집인 등록/ })).toBeVisible()
  await expect(page.getByPlaceholder('이름 / 전화 / 코드')).toBeVisible()
  await page.screenshot({ path: `${SHOT}/promoters.png` })
})
