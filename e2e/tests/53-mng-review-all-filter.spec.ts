import { test, expect } from '@playwright/test'
import fs from 'fs'

/**
 * 후기 관리 "전체" 칩 + 평점(미사용) 컬럼 제거 검증 (2026-06-12)
 *  - 과거(30일 전) 시딩 후기는 기본 "최근 7일" 필터엔 안 보이고, "전체" 칩 클릭 시 노출.
 *  - 평점 컬럼 헤더가 사라졌는지.
 */

const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_review_all'
fs.mkdirSync(SHOT, { recursive: true })
const MNG = 'https://sajuplan.com/mng'
const API = 'https://api.sajuplan.com/api'

test.use({ viewport: { width: 1366, height: 900 } })

test('전체 칩: 과거 후기 노출 + 평점 컬럼 제거', async ({ page, request }) => {
  const stamp = String(Date.now()).slice(-6)
  const title = `전체칩테스트_${stamp}`
  const pastISO = new Date(Date.now() - 30 * 86400000).toISOString()
  const res = await request.post(`${API}/admin/posts/reviews/seed`, {
    data: {
      counselor_id: 123,
      reviewer_name: '정*호',
      title,
      content: '한 달 전 작성한 시딩 후기 — 전체 보기로만 노출되어야 함.',
      created_at: pastISO,
      consult_type: '채팅',
      consult_duration_sec: 600,
    },
  })
  expect(res.ok(), `시딩 생성 실패: ${res.status()}`).toBeTruthy()
  const id = Number((await res.json()).id)

  try {
    await page.goto(`${MNG}/posts/review`)
    await page.waitForLoadState('load').catch(() => {})
    await page.waitForTimeout(1500)

    // 평점(미사용) 컬럼 헤더가 사라졌는지
    await expect(page.locator('th', { hasText: '평점' }), '평점 컬럼이 아직 있음').toHaveCount(0)

    // 기본(최근 7일) — 30일 전 후기는 안 보여야
    await expect(page.getByText(title), '기본 필터에 과거 후기가 보임(전체 칩 의미 없음)').toHaveCount(0)
    await page.screenshot({ path: `${SHOT}/01_default_7days.png` })

    // "전체" 칩 클릭 → 과거 후기 노출
    await page.getByRole('button', { name: '전체', exact: true }).click()
    await page.waitForTimeout(1500)
    await expect(page.getByText(title), '전체 칩 눌러도 과거 후기 안 보임').toBeVisible({ timeout: 8_000 })
    await page.screenshot({ path: `${SHOT}/02_all.png` })
  } finally {
    await request.delete(`${API}/admin/posts/review/${id}`)
  }
})
