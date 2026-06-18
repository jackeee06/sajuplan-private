import { test, expect } from '@playwright/test'
import fs from 'fs'

/** mng 후기 상세→수정 UI 워크스루 + 스크린샷 (작성자 표시명 '익명' 버그 수정 + 수정 기능) */
const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_review_edit'
fs.mkdirSync(SHOT, { recursive: true })
const MNG = 'https://sajuplan.com/mng'
const API = 'https://api.sajuplan.com/api'

test.use({ viewport: { width: 1366, height: 900 } })

test('상세 모달 작성자 표시명 + 수정 모달 → 반영', async ({ page, request }) => {
  const stamp = String(Date.now()).slice(-6)
  const name = '송*지'
  const title = `수정UI_${stamp}`
  const res = await request.post(`${API}/admin/posts/reviews/seed`, {
    data: { counselor_id: 123, reviewer_name: name, title, content: '수정 UI 테스트 원본 내용', consult_type: '채팅', consult_duration_sec: 600 },
  })
  const id = Number((await res.json()).id)

  try {
    await page.goto(`${MNG}/posts/review`)
    await page.waitForLoadState('load').catch(() => {})
    await page.waitForTimeout(1500)

    // 행 클릭 → 상세 모달
    await page.getByText(title).first().click()
    await page.waitForTimeout(800)
    // 작성자가 '익명'이 아니라 시딩 표시명으로 떠야 함
    await expect(page.getByText(`작성자: ${name}`), '상세 모달 작성자가 표시명으로 안 뜸').toBeVisible({ timeout: 5_000 })
    await page.screenshot({ path: `${SHOT}/01_detail.png` })

    // 수정 버튼 → 수정 모달
    await page.getByRole('button', { name: '수정', exact: true }).click()
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${SHOT}/02_edit_modal.png` })

    // 제목 수정 후 저장
    const newTitle = `수정완료_${stamp}`
    // 제목 input은 현재 title 값을 가진 input
    await page.locator(`input[value="${title}"]`).fill(newTitle)
    await page.getByRole('button', { name: '저장', exact: true }).click()
    await page.waitForTimeout(1800)
    await page.screenshot({ path: `${SHOT}/03_after_save.png` })

    // 목록에 수정된 제목 반영
    await expect(page.getByText(newTitle).first(), '수정 제목 미반영').toBeVisible({ timeout: 8_000 })
  } finally {
    await request.delete(`${API}/admin/posts/review/${id}`)
  }
})
