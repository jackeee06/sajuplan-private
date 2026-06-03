import { test, expect } from '@playwright/test'

/**
 * [2026-06-03] 상담사 문의 CRUD E2E
 *
 * 시나리오:
 *   1. 상담사 문의 탭 진입 — "문의 작성하기" 버튼 노출
 *   2. 공개 문의 작성
 *   3. 목록에서 작성된 문의 확인
 *   4. 상세 진입 → 수정 버튼 노출 (본인 글 + 답변 없음)
 *   5. 수정 모달 → 제목/내용 변경 → 저장
 *   6. 수정 내용 반영 확인
 *   7. 삭제
 */

const API_DOMAIN = (process.env.TARGET ?? 'test') === 'prod' ? 'api.sajuplan.com' : 'api.sajumoon.kr'
const DOMAIN = (process.env.TARGET ?? 'test') === 'prod' ? 'sajuplan.com' : 'sajumoon.kr'
const COUNSELOR_ID = '123' // 이상화 상담사 (테스트용)

async function loginAs(page: any, context: any, mbId: string) {
  const res = await page.request.post(`https://${API_DOMAIN}/api/user/auth/login`, {
    data: { mb_id: mbId, password: 'e2e_test_2026' },
  })
  const match = res.headers()['set-cookie']?.match(/sjm_user=([^;]+)/)
  if (match) {
    await context.addCookies([{
      name: 'sjm_user', value: match[1],
      domain: DOMAIN, path: '/',
      httpOnly: true, secure: true, sameSite: 'None',
    }])
  }
}

test.describe('상담사 문의 CRUD', () => {
  let createdQnaId: string | null = null

  test('1. 문의 탭 진입 — 작성하기 버튼 노출', async ({ page, context }) => {
    await loginAs(page, context, 'e2e_member')
    await page.goto(`/counselors/${COUNSELOR_ID}/qna`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('link', { name: '문의 작성하기' })).toBeVisible()
  })

  test('2. 공개 문의 작성', async ({ page, context }) => {
    await loginAs(page, context, 'e2e_member')
    await page.goto(`/counselors/${COUNSELOR_ID}/qna/new`)
    await page.waitForLoadState('domcontentloaded')

    // 비밀글 체크 해제 (공개글로)
    const secretCheck = page.locator('input[type="checkbox"]').first()
    if (await secretCheck.isChecked()) await secretCheck.click()

    await page.getByPlaceholder(/제목/).fill('E2E 테스트 문의 제목')
    await page.getByPlaceholder(/내용|궁금/).fill('E2E 테스트 문의 내용입니다.')
    await page.getByRole('button', { name: '작성완료' }).click()

    // 목록으로 돌아가는지 확인
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/counselors\/\d+\/qna$/, { timeout: 10000 })
  })

  test('3. 목록에서 작성 문의 확인', async ({ page, context }) => {
    await loginAs(page, context, 'e2e_member')
    await page.goto(`/counselors/${COUNSELOR_ID}/qna`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText('E2E 테스트 문의 제목')).toBeVisible()
  })

  test('4. 상세 진입 → 수정/삭제 버튼 노출', async ({ page, context }) => {
    await loginAs(page, context, 'e2e_member')
    await page.goto(`/counselors/${COUNSELOR_ID}/qna`)
    await page.waitForLoadState('domcontentloaded')

    const item = page.getByText('E2E 테스트 문의 제목')
    await item.click()
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByRole('button', { name: '수정' })).toBeVisible()
    await expect(page.getByRole('button', { name: '삭제' })).toBeVisible()

    // URL에서 qnaId 저장
    createdQnaId = page.url().split('/').pop() ?? null
  })

  test('5. 수정 모달 → 저장', async ({ page, context }) => {
    await loginAs(page, context, 'e2e_member')
    await page.goto(`/counselors/${COUNSELOR_ID}/qna`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByText('E2E 테스트 문의 제목').click()
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('button', { name: '수정' }).click()
    await expect(page.getByText('문의 수정')).toBeVisible()

    const titleInput = page.getByLabel('제목')
    await titleInput.clear()
    await titleInput.fill('E2E 수정된 제목')

    await page.getByRole('button', { name: '저장' }).click()
    await expect(page.getByText('문의 수정')).toHaveCount(0)
    await expect(page.getByText('E2E 수정된 제목')).toBeVisible()
  })

  test('6. 공개글 신고하기 버튼 노출', async ({ page, context }) => {
    await loginAs(page, context, 'e2e_member')
    await page.goto(`/counselors/${COUNSELOR_ID}/qna`)
    await page.waitForLoadState('domcontentloaded')
    // 공개글(E2E 수정된 제목)의 신고하기 버튼 확인
    const row = page.locator('a').filter({ hasText: 'E2E 수정된 제목' })
    if (await row.count() > 0) {
      await expect(page.getByRole('button', { name: '신고하기' }).first()).toBeVisible()
    }
  })

  test('7. 삭제', async ({ page, context }) => {
    await loginAs(page, context, 'e2e_member')
    await page.goto(`/counselors/${COUNSELOR_ID}/qna`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByText('E2E 수정된 제목').click()
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('button', { name: '삭제' }).click()
    await expect(page.getByText('문의를 삭제하시겠습니까?')).toBeVisible()
    await page.getByRole('button', { name: '삭제', exact: true }).last().click()

    // 목록으로 돌아가는지 확인
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText('E2E 수정된 제목')).toHaveCount(0, { timeout: 10000 })
  })
})
