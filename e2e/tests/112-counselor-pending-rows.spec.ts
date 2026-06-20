import { test, expect } from '@playwright/test'

/**
 * [2026-06-20] 상담사 마이페이지 "답변 대기" 카드 개선 — 상담사 피드백 반영.
 *
 * 문제(이전): 합산 카드 하나가 후기까지 "문의 화면"으로 보내, 후기만 있는 상담사가
 *   카드를 눌러도 빈 문의 화면이 떠 "아무 동작 없음"으로 느낌(직관성↓).
 * 개선: 문의/후기 각각 한 줄(줄 전체 클릭) + 최근 항목 미리보기 + 각자 정확한 화면으로 이동.
 *
 * 검증:
 *  1) pending-counts API 가 미리보기 필드(recent_qna_title/recent_review_title) 반환
 *  2) [핵심] 회원이 문의 작성 → 상담사 마이페이지에 "문의 줄" 노출 + "최근:" 미리보기
 *     + 줄 전체 클릭 시 문의 화면(/counselor/mypage/customer-qnas)으로 정확히 이동
 *  3) 후기 줄이 있으면 클릭 시 후기 화면(/counselor/mypage/reviews)으로 이동(없으면 skip)
 */

const BASE = (process.env.TARGET ?? 'prod') === 'prod' ? 'https://sajuplan.com' : 'https://sajumoon.kr'
const API = (process.env.TARGET ?? 'prod') === 'prod' ? 'https://api.sajuplan.com' : 'https://api.sajumoon.kr'
const COUNSELOR_ID = '102' // dummy_01 — 실제 상담사 사용 금지

test.describe('답변 대기 카드 — 문의/후기 2줄 분리 + 미리보기 + 정확한 이동', () => {
  test('1. pending-counts API — 미리보기 필드 포함', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'user_counselor_storage.json', baseURL: BASE })
    const p = await ctx.newPage()
    const res = await p.request.get(`${API}/api/user/counselor/customer-qnas/pending-counts`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('pending_qna')
    expect(body).toHaveProperty('pending_review')
    expect(body).toHaveProperty('recent_qna_title')
    expect(body).toHaveProperty('recent_review_title')
    await ctx.close()
  })

  test('2. 회원이 문의 작성 → 상담사 마이페이지 "문의 줄" + 미리보기 + 클릭 시 문의 화면', async ({ browser }) => {
    const title = `E2E 답변대기 문의 ${Date.now()}`
    // (A) e2e_member 가 102 에게 문의 작성 → pending_qna 증가
    const mctx = await browser.newContext({ storageState: 'user_member_storage.json', baseURL: BASE })
    const m = await mctx.newPage()
    await m.goto(`/counselors/${COUNSELOR_ID}/qna/new`)
    await m.waitForLoadState('domcontentloaded')
    await m.getByPlaceholder(/제목/).fill(title)
    await m.getByPlaceholder(/내용|궁금/).fill('답변 대기 카드 검증용 문의입니다.')
    await m.getByRole('button', { name: '작성완료' }).click()
    await m.waitForURL(/counselors\/\d+(\?tab=qna|\/qna)/, { timeout: 10_000 })
    await mctx.close()

    // (B) dummy_01(102) 상담사 마이페이지 → 답변 대기 "문의 줄"
    const cctx = await browser.newContext({ storageState: 'user_counselor_storage.json', baseURL: BASE })
    const c = await cctx.newPage()
    await c.goto('/counselor/mypage')
    await c.waitForLoadState('domcontentloaded')
    const qnaRow = c.getByTestId('pending-qna-row')
    await expect(qnaRow).toBeVisible({ timeout: 10_000 })
    await expect(qnaRow).toContainText('최근:') // 미리보기 노출
    await qnaRow.click() // 줄 전체 클릭
    await expect(c).toHaveURL(/\/counselor\/mypage\/customer-qnas$/, { timeout: 10_000 })
    await cctx.close()
  })

  test('3. 후기 줄이 있으면 클릭 시 후기 화면으로 이동(없으면 skip)', async ({ browser }) => {
    const cctx = await browser.newContext({ storageState: 'user_counselor_storage.json', baseURL: BASE })
    const c = await cctx.newPage()
    await c.goto('/counselor/mypage')
    await c.waitForLoadState('domcontentloaded')
    await c.waitForTimeout(1500)
    const reviewRow = c.getByTestId('pending-review-row')
    if ((await reviewRow.count()) === 0) {
      await cctx.close()
      test.skip(true, '미답변 후기 없음 — 후기 줄 없음(정상)')
      return
    }
    await expect(reviewRow.first()).toBeVisible()
    await reviewRow.first().click()
    await expect(c).toHaveURL(/\/counselor\/mypage\/reviews$/, { timeout: 10_000 })
    await cctx.close()
  })
})
