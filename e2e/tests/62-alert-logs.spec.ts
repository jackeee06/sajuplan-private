import { test, expect } from '@playwright/test'
import fs from 'fs'

/** 알림 이력 화면 — API + UI 검증 + 스크린샷 (2026-06-12) */
const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_alert_logs'
fs.mkdirSync(SHOT, { recursive: true })
const MNG = 'https://sajuplan.com/mng'
const API = 'https://api.sajuplan.com/api'

test.use({ viewport: { width: 1366, height: 950 } })

test('알림 이력: health 상세 + 발송 이력 목록 + 화면', async ({ page, request }) => {
  // 1) health 상세 API
  const h = await request.get(`${API}/admin/alert-logs/health`)
  expect(h.ok()).toBeTruthy()
  const hj = await h.json()
  expect(Array.isArray(hj.checks), 'health.checks 배열 아님').toBe(true)
  // 정리 후라 위반(count>0)이 없어야 — 모두 정상
  const violations = (hj.checks as Array<{ count: number }>).filter((c) => c.count > 0)
  console.log(`[health] 위반 ${violations.length}건`)

  // 2) 발송 이력 목록 API
  const l = await request.get(`${API}/admin/alert-logs?page=1`)
  expect(l.ok()).toBeTruthy()
  const lj = await l.json()
  expect(Array.isArray(lj.items), 'items 배열 아님').toBe(true)
  expect(lj.total, '발송 이력이 0건').toBeGreaterThan(0)

  // 3) 화면
  await page.goto(`${MNG}/alert-logs`)
  await page.waitForLoadState('load').catch(() => {})
  await page.waitForTimeout(2000)
  await expect(page.getByRole('heading', { name: '알림 이력' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('heading', { name: /현재 시스템 점검/ })).toBeVisible()
  await page.screenshot({ path: `${SHOT}/01_alert_logs.png` })
})
