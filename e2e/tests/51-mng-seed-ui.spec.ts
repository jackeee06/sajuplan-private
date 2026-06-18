import { test, expect } from '@playwright/test'
import fs from 'fs'

/** 관리자 mng 시딩 후기 작성 UI 워크스루 + 스크린샷 (config 기본 admin storageState) */
const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_seed'
fs.mkdirSync(SHOT, { recursive: true })
const MNG = 'https://sajuplan.com/mng'
const API = 'https://api.sajuplan.com/api'

test.use({ viewport: { width: 1366, height: 900 } })

test('mng 시딩 작성 UI: 모달→상담사선택→입력→등록→목록 시딩뱃지', async ({ page, request }) => {
  await page.goto(`${MNG}/posts/review`)
  await page.waitForLoadState('load').catch(() => {})
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${SHOT}/01_list.png` })

  // 시딩 작성 버튼
  const seedBtn = page.getByRole('button', { name: '+ 시딩 후기 작성' })
  await expect(seedBtn, '시딩 작성 버튼 없음').toBeVisible({ timeout: 10_000 })
  await seedBtn.click()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${SHOT}/02_modal.png` })

  // 상담사 검색 후 선택
  await page.getByPlaceholder('이름·닉네임·아이디 검색').fill('라온')
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: /라온/ }).first().click()

  const stamp = String(Date.now()).slice(-6)
  const title = `UI시딩_${stamp}`
  await page.getByPlaceholder(/정말 많은 도움/).fill(title)
  await page.getByPlaceholder('후기 본문').fill('관리자 UI 시딩 테스트 본문입니다.')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOT}/03_filled.png` })

  // 등록
  await page.getByRole('button', { name: '시딩 후기 등록' }).click()
  await page.waitForTimeout(2200)
  await page.screenshot({ path: `${SHOT}/04_after.png` })

  // 목록에 시딩 뱃지 노출
  await expect(page.getByText('시딩').first(), '시딩 뱃지 미노출').toBeVisible({ timeout: 8_000 })

  // 정리 — 방금 만든 시딩 후기 삭제(제목으로 식별)
  const list = await request.get(`${API}/admin/posts/review?limit=20&q=${encodeURIComponent(title)}`)
  const body = await list.json().catch(() => ({ items: [] }))
  for (const it of (body.items ?? [])) {
    if (it.title === title) await request.delete(`${API}/admin/posts/review/${it.id}`)
  }
})
