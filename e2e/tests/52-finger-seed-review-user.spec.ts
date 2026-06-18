import { test, expect, devices, request as pwRequest } from '@playwright/test'
import fs from 'fs'

/**
 * 실제 사용자 손가락 동작 — 관리자가 만든 시딩 후기가 일반 사용자 화면에서
 * 진짜 후기처럼(시딩 표식 없이) 자연스럽게 노출되는지 모바일 터치로 검증 + 스크린샷.
 *  - admin 컨텍스트로 시딩 1건 생성 → 비로그인 모바일 사용자로 후기 탭 손가락 탐색 → 정리.
 */

const SHOT = 'c:/claudeworkspace/sajumoon/e2e/_seed_user'
fs.mkdirSync(SHOT, { recursive: true })
const API = 'https://api.sajuplan.com/api'
const COUNSELOR_ID = 123 // 라온선생

// page = 비로그인 + 실제 안드로이드 폰(터치)
test.use({ ...devices['Pixel 5'], storageState: { cookies: [], origins: [] } })

test('사용자 손가락: 시딩 후기가 일반 후기처럼 노출 + 무심결 터치해도 안 튐', async ({ page }) => {
  // ── admin 컨텍스트로 시딩 후기 생성 ──
  const admin = await pwRequest.newContext({
    storageState: 'c:/claudeworkspace/sajumoon/e2e/storageState.json',
  })
  const stamp = String(Date.now()).slice(-6)
  const reviewerName = `김*수`
  const title = `좋은상담이었어요_${stamp}`
  const res = await admin.post(`${API}/admin/posts/reviews/seed`, {
    data: {
      counselor_id: COUNSELOR_ID,
      reviewer_name: reviewerName,
      title,
      content: '코인 시간이 다 되어 끊겼지만 솔직한 점사 정말 좋았습니다. 조언 잘 새겨듣겠습니다. 감사합니다!',
      rating: 5,
      consult_type: '채팅',
      consult_duration_sec: 1040,
    },
  })
  expect(res.ok(), `시딩 생성 실패: ${res.status()}`).toBeTruthy()
  const id = Number((await res.json()).id)

  try {
    // ── 사용자 모바일 손가락 흐름 ──
    await page.goto(`/counselors/${COUNSELOR_ID}`)
    await page.waitForLoadState('load').catch(() => {})
    await page.waitForTimeout(1200)

    // "후기" 탭을 손가락으로 탭
    const reviewTab = page.getByRole('button', { name: /^후기/ })
    await expect(reviewTab).toBeVisible({ timeout: 10_000 })
    await reviewTab.tap()
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${SHOT}/01_review_tab.png` })

    // 시딩 후기가 진짜처럼 노출 — 제목/이름 보이고, "시딩" 표식은 사용자에게 안 보여야
    await expect(page.getByText(title), '시딩 후기 제목 미노출').toBeVisible({ timeout: 8_000 })
    await expect(page.getByText(reviewerName).first(), '시딩 작성자명 미노출').toBeVisible()
    await expect(page.getByText('시딩', { exact: true }), '사용자 화면에 시딩 표식이 노출됨(버그)').toHaveCount(0)

    // 시딩 후기 본문을 손가락으로 무심결 탭 → 페이지 안 튀어야(상세 더미 폐기 연계)
    const urlBefore = page.url()
    await page.getByText(title).tap()
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${SHOT}/02_after_tap.png` })
    expect(page.url(), `후기 탭 후 이탈: ${page.url()}`).toBe(urlBefore)
    await expect(page.getByRole('heading', { name: '상담 후기' })).toHaveCount(0)
  } finally {
    await admin.delete(`${API}/admin/posts/review/${id}`)
    await admin.dispose()
  }
})
