import { test, expect } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * [2026-06-03] 상담사 문의 답변 CRUD E2E
 *
 * 검증 흐름:
 *   Setup: e2e_member → dummy_01(id=102) 페이지에 공개 문의 작성 (API)
 *   1. dummy_01 목록 진입 — 문의 표시 확인
 *   2. 문의 상세 — 질문 내용 + 답변 입력창(input)
 *   3. 답변 등록 — 전송 버튼 클릭 → reload → 답변 표시
 *   4. 답변 수정 — 케밥(⋮) → 수정 → textarea 수정 → 저장
 *   5. 답변 삭제 — 케밥(⋮) → 삭제 → dialog 수락 → reload → 입력창 복원
 *   6. 목록 복귀 — 답변대기 상태 확인
 *   Cleanup: afterAll 에서 문의 삭제
 *
 * 쿠키 전략:
 *   dummy_01 로그인은 beforeAll에서 1회만 수행, 발급된 쿠키를 모든 테스트가 공유.
 *   (5회 반복 로그인으로 인한 429 throttle 방지)
 */

const API_DOMAIN = (process.env.TARGET ?? 'prod') === 'prod' ? 'api.sajuplan.com' : 'api.sajumoon.kr'
const DOMAIN    = (process.env.TARGET ?? 'prod') === 'prod' ? 'sajuplan.com'     : 'sajumoon.kr'

const COUNSELOR_ID = 102
const QNA_TITLE   = 'E2E 상담사 답변 테스트 문의'
const QNA_CONTENT = 'E2E 상담사 답변 테스트 내용입니다.'
const REPLY_TEXT  = 'E2E 테스트 답변입니다.'
const REPLY_EDIT  = 'E2E 수정된 답변입니다.'
const ANSWER_PH   = '답변을 입력해주세요.'

let testQnaId: number | null = null
/** beforeAll에서 1회 발급 후 모든 테스트에서 재사용 */
let counselorCookieValue: string | null = null
let memberCookieValue: string | null = null

/** context에 global-setup이 저장한 dummy_01(상담사) storageState 로드 */
async function applyCounselorCookie(context: any) {
  const stateFile = path.resolve(__dirname, '../user_counselor_storage.json')
  if (fs.existsSync(stateFile)) {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    if (state.cookies?.length) {
      await context.clearCookies()
      await context.addCookies(state.cookies)
      return
    }
  }
  // fallback: 직접 발급된 쿠키 사용 (storageState 없을 때)
  if (!counselorCookieValue) throw new Error('상담사 쿠키가 준비되지 않았습니다.')
  await context.addCookies([{
    name: 'sjm_user', value: counselorCookieValue,
    domain: `.${DOMAIN}`, path: '/',
    httpOnly: true, secure: true, sameSite: 'None',
  }])
}

/** 상담사 API로 답변 삭제 시도 (없으면 무시) */
async function deleteCounselorReply(request: any, qnaId: number) {
  if (!memberCookieValue) return
  try {
    await request.delete(
      `https://${API_DOMAIN}/api/user/counselor/customer-qnas/${qnaId}/reply`,
      { headers: { Cookie: `sjm_user=${counselorCookieValue}` } },
    )
  } catch { /* 답변 없으면 무시 */ }
}

test.describe.serial('상담사 문의 답변 CRUD', () => {
  // dummy_01(상담사) storageState — global-setup이 user_counselor_storage.json 저장
  test.use({ storageState: 'user_counselor_storage.json' })

  test.beforeAll(async ({ request }) => {
    // storageState 파일에서 직접 쿠키 추출 — login API 호출 없음 (throttle 완전 회피)
    const memberState = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../user_member_storage.json'), 'utf8'))
    memberCookieValue = memberState.cookies?.find((c: any) => c.name === 'sjm_user')?.value ?? null
    if (!memberCookieValue) throw new Error('user_member_storage.json: sjm_user 쿠키 없음')

    const csrState = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../user_counselor_storage.json'), 'utf8'))
    counselorCookieValue = csrState.cookies?.find((c: any) => c.name === 'sjm_user')?.value ?? null
    if (!counselorCookieValue) throw new Error('user_counselor_storage.json: sjm_user 쿠키 없음')
    console.log('[setup] 쿠키 발급 완료 (storageState에서 로드)')

    // ── 이전 잔여 E2E 문의 정리 ──
    const listRes = await request.get(
      `https://${API_DOMAIN}/api/user/counselors/${COUNSELOR_ID}/qna?limit=50`,
      { headers: { Cookie: `sjm_user=${memberCookieValue}` } },
    )
    const items = (await listRes.json()).items ?? []
    for (const item of items) {
      if (!(item.title ?? '').includes('E2E 상담사 답변')) continue
      await deleteCounselorReply(request, item.id)
      const delRes = await request.delete(
        `https://${API_DOMAIN}/api/user/counselors/${COUNSELOR_ID}/qna/${item.id}`,
        { headers: { Cookie: `sjm_user=${memberCookieValue}` } },
      )
      console.log(`[cleanup-pre] id=${item.id} → ${delRes.status()}`)
    }

    // ── 테스트 문의 신규 작성 ──
    const r = await request.post(
      `https://${API_DOMAIN}/api/user/counselors/${COUNSELOR_ID}/qna`,
      { data: { title: QNA_TITLE, content: QNA_CONTENT, is_secret: false },
        headers: { Cookie: `sjm_user=${memberCookieValue}` } },
    )
    const d = await r.json()
    testQnaId = Number(d.id)
    if (!testQnaId || isNaN(testQnaId)) throw new Error(`문의 생성 실패: ${JSON.stringify(d)}`)
    console.log(`[setup] 문의 생성 id=${testQnaId}`)
  })

  test.afterAll(async ({ request }) => {
    if (!testQnaId) return
    await deleteCounselorReply(request, testQnaId)
    if (memberCookieValue) {
      const res = await request.delete(
        `https://${API_DOMAIN}/api/user/counselors/${COUNSELOR_ID}/qna/${testQnaId}`,
        { headers: { Cookie: `sjm_user=${memberCookieValue}` } },
      )
      console.log(`[cleanup] id=${testQnaId} 삭제 → ${res.status()}`)
    }
    counselorCookieValue = null
    memberCookieValue = null
    testQnaId = null
  })

  /* ─── 1. 목록 ─── */
  test('1. 받은 문의 목록 — 작성된 문의 표시', async ({ page }) => {
    await page.goto('/counselor/mypage/customer-qnas')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
    await expect(page.getByText(QNA_TITLE).first()).toBeVisible({ timeout: 15000 })
  })

  /* ─── 2. 상세 ─── */
  test('2. 문의 상세 — 질문 내용 + 답변 입력창', async ({ page }) => {
    await page.goto(`/counselor/mypage/customer-qnas/${testQnaId}`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
    await expect(page.getByText(QNA_CONTENT)).toBeVisible({ timeout: 15000 })
    await expect(page.locator(`input[placeholder="${ANSWER_PH}"]`)).toBeVisible({ timeout: 5000 })
  })

  /* ─── 3. 답변 등록 ─── */
  test('3. 답변 등록 — 전송 버튼 클릭 후 답변 표시', async ({ page }) => {
    await page.goto(`/counselor/mypage/customer-qnas/${testQnaId}`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const input = page.locator(`input[placeholder="${ANSWER_PH}"]`)
    await expect(input).toBeVisible({ timeout: 15000 })
    await input.fill(REPLY_TEXT)

    const sendBtn = page.getByRole('button', { name: '보내기' })
    await expect(sendBtn).toBeVisible({ timeout: 5000 })
    await sendBtn.click()

    // API 처리 대기 후 reload로 UI 확정
    await page.waitForTimeout(1500)
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText(REPLY_TEXT)).toBeVisible({ timeout: 15000 })
    await expect(input).toHaveCount(0, { timeout: 5000 })
  })

  /* ─── 4. 답변 수정 ─── */
  test('4. 답변 수정 — 케밥(⋮) → 수정 → 저장', async ({ page }) => {
    await page.goto(`/counselor/mypage/customer-qnas/${testQnaId}`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
    await expect(page.getByText(REPLY_TEXT)).toBeVisible({ timeout: 15000 })

    const kebab = page.getByRole('button', { name: '더보기' })
      .or(page.locator('button[aria-label="더보기"]'))
      .or(page.locator('button').filter({ hasText: '⋮' }))
    await expect(kebab.first()).toBeVisible({ timeout: 5000 })
    await kebab.first().click()

    await page.getByText('수정').click()

    const textarea = page.locator('textarea')
    await expect(textarea).toBeVisible({ timeout: 5000 })
    await textarea.clear()
    await textarea.fill(REPLY_EDIT)
    await page.getByRole('button', { name: '저장' }).click()

    await expect(page.getByText(REPLY_EDIT)).toBeVisible({ timeout: 12000 })
    await expect(page.getByText(REPLY_TEXT)).toHaveCount(0)
  })

  /* ─── 5. 답변 삭제 ─── */
  test('5. 답변 삭제 — 케밥(⋮) → 삭제 → confirm → 입력창 복원', async ({ page }) => {
    await page.goto(`/counselor/mypage/customer-qnas/${testQnaId}`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    // 수정된 답변 또는 원본 답변 확인 (이전 테스트 상태 무관하게)
    const anyReply = page.getByText(REPLY_EDIT).or(page.getByText(REPLY_TEXT))
    await expect(anyReply.first()).toBeVisible({ timeout: 15000 })

    const kebab = page.getByRole('button', { name: '더보기' })
      .or(page.locator('button[aria-label="더보기"]'))
      .or(page.locator('button').filter({ hasText: '⋮' }))
    await kebab.first().click()

    page.once('dialog', (d) => d.accept())
    await page.getByText('삭제').click()

    await page.waitForTimeout(1500)
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator(`input[placeholder="${ANSWER_PH}"]`)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(REPLY_EDIT)).toHaveCount(0)
    await expect(page.getByText(REPLY_TEXT)).toHaveCount(0)
  })

  /* ─── 6. 목록 상태 ─── */
  test('6. 목록에서 답변대기 상태 확인', async ({ page }) => {
    await page.goto('/counselor/mypage/customer-qnas')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText(QNA_TITLE).first()).toBeVisible({ timeout: 12000 })
    await expect(page.getByText('답변대기').first()).toBeVisible()
  })
})
