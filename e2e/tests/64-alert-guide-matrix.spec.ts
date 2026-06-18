import { test, expect } from '@playwright/test'
import fs from 'fs'

/**
 * 알림 가이드 — 매트릭스 단일출처(SSOT) 검증 (2026-06-18).
 * _HANDBOOK/alert/_matrix.json → API → /alert-guide 페이지 fetch 렌더.
 * 드리프트 정정(후기·문의 push=active, 정산 alimtalk=active) 반영 확인.
 */
const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_alert_guide'
fs.mkdirSync(SHOT, { recursive: true })
const MNG = 'https://sajuplan.com/mng'
const API = 'https://api.sajuplan.com/api'

test.use({ viewport: { width: 1600, height: 1000 } })

test('알림 가이드: 매트릭스 SSOT API + 페이지 렌더 + 드리프트 정정', async ({ page, request }) => {
  // 1) SSOT API — _HANDBOOK/alert/_matrix.json 서빙
  const r = await request.get(`${API}/admin/handbook/alert-matrix`)
  expect(r.ok(), 'alert-matrix API 실패').toBeTruthy()
  const j = await r.json()
  expect(Array.isArray(j.items), 'items 배열 아님').toBe(true)
  expect(j.items.length, '매트릭스 비어있음').toBeGreaterThan(30)
  const byId = (id: string) => j.items.find((x: { id: string }) => x.id === id)
  // 드리프트 정정 확인
  expect(byId('new_review')?.push?.status, '후기 push 미반영').toBe('active')
  expect(byId('new_qna')?.push?.status, '문의 push 미반영').toBe('active')
  expect(byId('settlement_complete')?.alimtalk?.status, '정산 알림톡 미반영').toBe('active')
  console.log(`[matrix] items=${j.items.length} _updated=${j._updated}`)

  // 2) 페이지 렌더 — fetch 한 데이터로 표가 그려지는지
  await page.goto(`${MNG}/alert-guide`)
  await page.waitForLoadState('load').catch(() => {})
  await page.waitForTimeout(2500)
  await expect(page.getByRole('heading', { name: '알림 가이드' })).toBeVisible({ timeout: 10_000 })
  // 표 행(이벤트명) 렌더 확인 — fetch 성공해야 보임
  await expect(page.getByText('상담 요청 도착').first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('새 후기 등록').first()).toBeVisible()
  // SSOT 출처 표기
  await expect(page.getByText('_HANDBOOK/alert/_matrix.json').first()).toBeVisible()
  await page.screenshot({ path: `${SHOT}/01_alert_guide.png`, fullPage: true })
})
