import { test, expect } from '@playwright/test'
import fs from 'fs'

/** 알림 이력 — 전체메뉴 등록 + 운영바이블(alert/08) 노출 검증 (2026-06-12) */
const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_alert_hb'
fs.mkdirSync(SHOT, { recursive: true })
const MNG = 'https://sajuplan.com/mng'

test.use({ viewport: { width: 1366, height: 950 } })

test('전체메뉴에 알림 이력 등록 + 운영바이블 alert/08 노출', async ({ page }) => {
  // 1) 전체 메뉴(인덱스)에 "알림 이력"
  await page.goto(`${MNG}/all-menus`)
  await page.waitForLoadState('load').catch(() => {})
  await page.waitForTimeout(1500)
  await expect(page.getByText('📋 알림 이력').first(), '전체메뉴에 알림 이력 없음').toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: `${SHOT}/01_all_menus.png` })

  // 2) 운영바이블에 alert/08 문서 노출
  await page.goto(`${MNG}/handbook`)
  await page.waitForLoadState('load').catch(() => {})
  await page.waitForTimeout(2000)
  await expect(page.getByText(/알림 이력.*시스템 점검/).first(), '운영바이블에 알림 이력 문서 없음').toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: `${SHOT}/02_handbook.png` })
})
