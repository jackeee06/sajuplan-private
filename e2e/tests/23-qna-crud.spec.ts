import { test, expect } from '@playwright/test'

/**
 * [2026-06-03] 상담사 문의 CRUD E2E
 *
 * - 목록 카드: 본문(content) 표시, 제목은 상세 페이지에만 노출
 * - 각 테스트는 describe 블록 내에서 순서대로 실행됨 (앞 테스트 결과에 의존)
 */

const API_DOMAIN = (process.env.TARGET ?? 'test') === 'prod' ? 'api.sajuplan.com' : 'api.sajumoon.kr'
const DOMAIN = (process.env.TARGET ?? 'test') === 'prod' ? 'sajuplan.com' : 'sajumoon.kr'
const COUNSELOR_ID = '123'

const QNA_TITLE    = 'E2E 테스트 문의 제목'
const QNA_CONTENT  = 'E2E 테스트 문의 내용입니다.'
const EDIT_TITLE   = 'E2E 수정된 제목'
const EDIT_CONTENT = 'E2E 수정된 내용입니다.'

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

    const secretCheck = page.locator('input[type="checkbox"]').first()
    if (await secretCheck.isChecked()) await secretCheck.click()

    await page.getByPlaceholder(/제목/).fill(QNA_TITLE)
    await page.getByPlaceholder(/내용|궁금/).fill(QNA_CONTENT)
    await page.getByRole('button', { name: '작성완료' }).click()

    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/counselors\/\d+\/qna$/, { timeout: 10000 })
  })

  test('3. 목록에서 작성 문의 확인 (본문 기준)', async ({ page, context }) => {
    await loginAs(page, context, 'e2e_member')
    await page.goto(`/counselors/${COUNSELOR_ID}/qna`)
    await page.waitForLoadState('domcontentloaded')
    // 목록 카드는 본문을 표시 — .first()로 strict mode 방지
    await expect(page.getByText(QNA_CONTENT).first()).toBeVisible({ timeout: 10000 })
  })

  test('4. 상세 진입 → 수정/삭제 버튼 노출 (본인 글)', async ({ page, context }) => {
    await loginAs(page, context, 'e2e_member')
    await page.goto(`/counselors/${COUNSELOR_ID}/qna`)
    await page.waitForLoadState('domcontentloaded')

    await page.locator('a').filter({ hasText: QNA_CONTENT }).first().click()
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByText(QNA_TITLE)).toBeVisible()
    await expect(page.getByRole('button', { name: '수정' })).toBeVisible()
    await expect(page.getByRole('button', { name: '삭제' })).toBeVisible()
  })

  test('5. 수정 모달 → 저장 → 상세 페이지에 반영', async ({ page, context }) => {
    await loginAs(page, context, 'e2e_member')
    await page.goto(`/counselors/${COUNSELOR_ID}/qna`)
    await page.waitForLoadState('domcontentloaded')
    await page.locator('a').filter({ hasText: QNA_CONTENT }).first().click()
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('button', { name: '수정' }).click()
    await expect(page.getByText('문의 수정')).toBeVisible()

    // 모달 내부 input/textarea 선택 (.fixed.inset-0 기준)
    const modal = page.locator('.fixed.inset-0')
    const titleInput = modal.locator('input').first()
    await titleInput.clear()
    await titleInput.fill(EDIT_TITLE)

    const textarea = modal.locator('textarea')
    await textarea.clear()
    await textarea.fill(EDIT_CONTENT)

    await page.getByRole('button', { name: '저장' }).click()

    // 모달 닫힘 확인 + 상세 페이지에 수정된 제목 반영
    await expect(page.getByText('문의 수정')).toHaveCount(0, { timeout: 5000 })
    await expect(page.getByText(EDIT_TITLE)).toBeVisible({ timeout: 5000 })
  })

  test('6. 공개글 신고하기 버튼 노출', async ({ page, context }) => {
    await loginAs(page, context, 'e2e_member')
    await page.goto(`/counselors/${COUNSELOR_ID}/qna`)
    await page.waitForLoadState('domcontentloaded')
    const card = page.locator('a').filter({ hasText: EDIT_CONTENT })
    if (await card.count() > 0) {
      await expect(page.getByRole('button', { name: '신고하기' }).first()).toBeVisible()
    }
  })

  test('7. 삭제', async ({ page, context }) => {
    await loginAs(page, context, 'e2e_member')

    // API로 e2e_member의 문의 목록 조회 → 첫 번째 E2E 문의 ID 획득
    const listRes = await page.request.get(
      `https://${API_DOMAIN}/api/user/counselors/${COUNSELOR_ID}/qna?limit=20&offset=0`,
    )
    const listData = await listRes.json()
    const e2eItem = listData.items?.find(
      (it: { title: string; content: string }) =>
        it.title?.includes('E2E') || it.content?.includes('E2E'),
    )
    if (!e2eItem) {
      // 삭제할 아이템 없음 — skip
      return
    }

    // 목록 → 상세 순서로 진입 (navigate(-2) history 충분히 쌓기)
    await page.goto(`/counselors/${COUNSELOR_ID}/qna`)
    await page.waitForLoadState('domcontentloaded')
    await page.goto(`/counselors/${COUNSELOR_ID}/qna/${e2eItem.id}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('button', { name: '삭제' })).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: '삭제' }).click()
    await expect(page.getByText('문의를 삭제하시겠습니까?')).toBeVisible()
    await page.getByRole('button', { name: '삭제', exact: true }).last().click()

    // 상세 → 목록으로 navigate 대기
    await page.waitForURL(`**/${COUNSELOR_ID}/qna`, { timeout: 10000 })
    await expect(page.getByText(e2eItem.content ?? '')).toHaveCount(0, { timeout: 5000 })
  })
})
