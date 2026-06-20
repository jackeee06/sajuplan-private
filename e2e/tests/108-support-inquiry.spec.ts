import { test, expect } from '@playwright/test'

/**
 * [2026-06-19] 고객센터 1:1 문의 (회원 → 운영자) E2E
 *
 * 흐름: 회원이 앱 "이용안내 > 1:1 문의" 로 작성 → post_qa 저장 →
 *       관리자가 답변 → 회원이 상세에서 답변 확인 (+ FCM 푸시).
 *
 * - 회원 인증: e2e_member / e2e_test_2026 (23-qna-crud 와 동일 패턴)
 * - 관리자 인증: admin / test1234!  (01-mng-login 과 동일)
 */

const API_DOMAIN = (process.env.TARGET ?? 'prod') === 'prod' ? 'api.sajuplan.com' : 'api.sajumoon.kr'
const DOMAIN = (process.env.TARGET ?? 'prod') === 'prod' ? 'sajuplan.com' : 'sajumoon.kr'

const STAMP = `${Math.floor(Date.now() / 1000)}`
const TITLE = `E2E 고객센터 문의 ${STAMP}`
const CONTENT = `E2E 고객센터 문의 내용 ${STAMP} 입니다.`
const EDIT_TITLE = `E2E 수정 제목 ${STAMP}`
const EDIT_CONTENT = `E2E 수정 내용 ${STAMP} 입니다.`

async function memberLogin(page: any, context: any) {
  const res = await page.request.post(`https://${API_DOMAIN}/api/user/auth/login`, {
    data: { mb_id: 'e2e_member', password: 'e2e_test_2026' },
  })
  const match = res.headers()['set-cookie']?.match(/sjm_user=([^;]+)/)
  if (match) {
    await context.addCookies([{
      name: 'sjm_user', value: match[1],
      domain: `.${DOMAIN}`, path: '/',
      httpOnly: true, secure: true, sameSite: 'None',
    }])
  }
}

test.describe('고객센터 1:1 문의', () => {
  test('1. 진입점 — 마이페이지 "고객센터 문의" 타일 + FAQ "1:1 문의하기" 버튼', async ({ page, context }) => {
    await memberLogin(page, context)
    // 마이페이지 메뉴 타일 (메인 진입점)
    await page.goto('/mypage/member')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('link', { name: '고객센터 문의' })).toBeVisible({ timeout: 10000 })
    // 자주 묻는 질문(구 이용안내) 화면의 보조 진입 버튼
    await page.goto('/mypage/help')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('button', { name: '1:1 문의하기' })).toBeVisible()
  })

  test('2. 작성 → 목록 → 상세 (회원)', async ({ page, context }) => {
    await memberLogin(page, context)
    await page.goto('/mypage/support-inquiries/new')
    await page.waitForLoadState('domcontentloaded')

    await page.getByPlaceholder('제목을 입력해주세요.').fill(TITLE)
    await page.getByPlaceholder(/궁금하신 점/).fill(CONTENT)
    await page.getByRole('button', { name: '문의 등록' }).click()

    // 목록으로 이동 + 작성 항목 노출
    await page.waitForURL(/\/mypage\/support-inquiries$/, { timeout: 10000 })
    await expect(page.getByText(TITLE).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('답변대기').first()).toBeVisible()

    // 상세 진입 → 본문 + 수정/삭제 노출 (답변 전)
    await page.getByText(TITLE).first().click()
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText(CONTENT)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: '수정' })).toBeVisible()
    await expect(page.getByRole('button', { name: '삭제' })).toBeVisible()
  })

  test('3. 수정 → 삭제 (회원, 답변 전)', async ({ page, context }) => {
    await memberLogin(page, context)

    // 방금 만든 문의 id 조회
    const listRes = await page.request.get(`https://${API_DOMAIN}/api/user/support-inquiries?limit=20`)
    const list = await listRes.json()
    const item = list.items?.find((it: { title: string }) => it.title === TITLE)
    expect(item, '작성한 문의를 목록에서 못 찾음').toBeTruthy()

    await page.goto(`/mypage/support-inquiries/${item.id}`)
    await page.waitForLoadState('domcontentloaded')

    // 수정
    await page.getByRole('button', { name: '수정' }).click()
    await expect(page.getByText('문의 수정')).toBeVisible()
    const modal = page.locator('.fixed.inset-0')
    await modal.locator('input').first().fill(EDIT_TITLE)
    await modal.locator('textarea').fill(EDIT_CONTENT)
    await page.getByRole('button', { name: '저장' }).click()
    await expect(page.getByText('문의 수정')).toHaveCount(0, { timeout: 5000 })
    // GET 2초 단기캐시 우회 — 새로고침 후 수정 내용 확인
    await page.waitForTimeout(2200)
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText(EDIT_CONTENT)).toBeVisible({ timeout: 8000 })

    // 삭제 (cleanup)
    await page.getByRole('button', { name: '삭제' }).click()
    await expect(page.getByText('문의를 삭제하시겠습니까?')).toBeVisible()
    await page.getByRole('button', { name: '삭제', exact: true }).last().click()
    await page.waitForURL(/\/mypage\/support-inquiries$/, { timeout: 10000 })
  })

  test('4. 관리자 답변 → 회원 상세에서 답변 확인 (전체 루프)', async ({ page, context, request }) => {
    await memberLogin(page, context)

    // (a) 회원이 문의 작성 — API 로 빠르게 생성
    const loopContent = `E2E 답변루프 내용 ${STAMP}`
    const createRes = await page.request.post(`https://${API_DOMAIN}/api/user/support-inquiries`, {
      data: { category: '이용안내', title: `E2E 답변루프 ${STAMP}`, content: loopContent, is_secret: true },
    })
    expect(createRes.ok(), '문의 생성 실패').toBeTruthy()
    const { id } = await createRes.json()
    expect(id).toBeTruthy()

    // (b) 관리자 로그인(별도 request 컨텍스트) → 답변 등록
    const adminLogin = await request.post(`https://${API_DOMAIN}/api/admin/auth/login`, {
      data: { mb_id: 'lee', password: 'kunwoo77' },
    })
    expect(adminLogin.ok(), '관리자 로그인 실패').toBeTruthy()
    const replyText = `E2E 운영팀 답변 ${STAMP}`
    const replyRes = await request.post(`https://${API_DOMAIN}/api/admin/posts/qa/${id}/reply`, {
      data: { content: replyText },
    })
    expect(replyRes.ok(), '관리자 답변 실패').toBeTruthy()

    // (c) 회원 상세 → 운영팀 답변 노출
    await page.goto(`/mypage/support-inquiries/${id}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText('운영팀 답변', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(replyText)).toBeVisible()
    await expect(page.getByText('답변완료').first()).toBeVisible()

    // (d) cleanup — 관리자 삭제
    const delRes = await request.delete(`https://${API_DOMAIN}/api/admin/posts/qa/${id}`)
    expect(delRes.ok(), '관리자 삭제 실패').toBeTruthy()
  })
})
