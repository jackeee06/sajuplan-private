import { test, expect } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import * as path from 'node:path'

/**
 * [2026-06-03] 후기 CRUD + 상담사 답변 E2E
 *
 * 검증 흐름:
 *  Setup: 테스트용 consultation INSERT (DB) + e2e_member 후기 작성 (API)
 *  1. 라우트 redirect 검증 (B-007: /counselors/102/reviews/new → /mypage/my-reviews/new)
 *  2. 목록(/mypage/my-reviews)에서 작성된 후기 표시 + ⋮ 메뉴 (5분 이내, 답변 없음)
 *  3. 후기 수정 UI 플로우 (⋮ → 수정 → 저장)
 *  4. 삭제 버튼 표시 (5분 이내, 상담사 답변 없음)
 *  5. dummy_01이 후기에 답변 등록 (API)
 *  6. 상담사 답변 후 해당 후기의 ⋮ 버튼 숨김 확인
 *  7. 상담사 후기 상세 → 답변 내용 표시 확인
 *  8. 상담사 답변 삭제 (UI: "답변 삭제" 버튼 + window.confirm)
 *  Cleanup: afterAll 에서 후기 + consultation DB 직접 삭제
 */

const API = (process.env.TARGET ?? 'prod') === 'prod' ? 'api.sajuplan.com' : 'api.sajumoon.kr'
const DOMAIN = (process.env.TARGET ?? 'prod') === 'prod' ? 'sajuplan.com' : 'sajumoon.kr'
const DB_SCRIPT = path.resolve(__dirname, '../setup/db_consult.py')

const MEMBER_ID = 140
const COUNSELOR_ID = 102

const REVIEW_TITLE = 'E2E 후기 CRUD 테스트'
const REVIEW_CONTENT = 'E2E 자동 검증용 후기입니다.'
const REVIEW_EDITED = 'E2E 수정된 후기 내용입니다.'
const REPLY_TEXT = 'E2E 상담사 답변입니다.'

let memberCookie: string | null = null
let counselorCookie: string | null = null
let testConsultId: number | null = null
let testReviewId: number | null = null

function runDbScript(...args: string[]): string {
  const result = spawnSync('python', [DB_SCRIPT, ...args], {
    encoding: 'utf-8',
    timeout: 30_000,
  })
  if (result.error) throw new Error(`db_consult.py 실행 오류: ${result.error.message}`)
  if (result.status !== 0) throw new Error(`db_consult.py 실패: ${result.stderr}`)
  return (result.stdout ?? '').trim()
}

function insertConsultation(): number {
  const out = runDbScript('insert', String(MEMBER_ID), String(COUNSELOR_ID))
  return Number(out)
}

async function applyCookie(context: any, value: string) {
  await context.addCookies([{
    name: 'sjm_user', value,
    domain: `.${DOMAIN}`, path: '/', httpOnly: true, secure: true, sameSite: 'None',
  }])
}

test.describe('후기 CRUD + 상담사 답변 E2E', () => {

  test.beforeAll(async ({ request }) => {
    // ── 잔여 E2E 후기 DB 직접 정리 (5분 제한 우회) ──
    runDbScript('delete-review-by-title', 'E2E 후기 CRUD')
    console.log('[setup] 잔여 E2E 후기 정리 완료')

    // ── 쿠키 발급 (1회) ──
    const mLogin = await request.post(`https://${API}/api/user/auth/login`, {
      data: { mb_id: 'e2e_member', password: 'e2e_test_2026' },
    })
    memberCookie = mLogin.headers()['set-cookie']?.match(/sjm_user=([^;]+)/)?.[1] ?? null
    if (!memberCookie) throw new Error('e2e_member 로그인 실패')

    const cLogin = await request.post(`https://${API}/api/user/auth/login`, {
      data: { mb_id: 'dummy_01', password: 'dummy_pass_2026!' },
    })
    counselorCookie = cLogin.headers()['set-cookie']?.match(/sjm_user=([^;]+)/)?.[1] ?? null
    if (!counselorCookie) throw new Error('dummy_01 로그인 실패')

    // ── 테스트 consultation 생성 (DB 직접) ──
    testConsultId = insertConsultation()
    if (!testConsultId || isNaN(testConsultId)) throw new Error(`consultation INSERT 실패 (결과: ${testConsultId})`)
    console.log(`[setup] consultation id=${testConsultId}`)

    // ── 테스트 후기 작성 (API) ──
    const r = await request.post(`https://${API}/api/user/reviews`, {
      data: {
        counselor_id: COUNSELOR_ID,
        title: REVIEW_TITLE,
        content: REVIEW_CONTENT,
        is_secret: false,
        consultation_id: testConsultId,
      },
      headers: { Cookie: `sjm_user=${memberCookie}` },
    })
    const d = await r.json()
    testReviewId = Number(d.id)
    if (!testReviewId || isNaN(testReviewId)) throw new Error(`후기 작성 실패: ${JSON.stringify(d)}`)
    console.log(`[setup] review id=${testReviewId}`)
  })

  test.afterAll(async () => {
    // DB 직접 삭제 — 5분 API 제한 우회
    if (testReviewId) {
      runDbScript('delete-review', String(testReviewId))
      console.log(`[cleanup] review id=${testReviewId} 삭제`)
    }
    if (testConsultId) {
      runDbScript('delete', String(testConsultId))
      console.log(`[cleanup] consultation id=${testConsultId} 삭제`)
    }
    memberCookie = null; counselorCookie = null
    testConsultId = null; testReviewId = null
  })

  /* ─── 1. 라우트 redirect (B-007 fix) ─── */
  test('1. /counselors/102/reviews/new → /mypage/my-reviews/new 리다이렉트', async ({ page, context }) => {
    await applyCookie(context, memberCookie!)
    await page.goto(`/counselors/${COUNSELOR_ID}/reviews/new`, { waitUntil: 'domcontentloaded' })
    await page.waitForURL((url) => url.pathname === '/mypage/my-reviews/new', { timeout: 8000 })
    const url = new URL(page.url())
    expect(url.searchParams.get('counselor_id')).toBe(String(COUNSELOR_ID))
  })

  /* ─── 2. 목록 + ⋮ 메뉴 (5분 이내, 답변 없음) ─── */
  test('2. 목록에서 후기 표시 + ⋮ 메뉴 (수정·삭제 모두 표시)', async ({ page, context }) => {
    await applyCookie(context, memberCookie!)
    await page.goto('/mypage/my-reviews', { waitUntil: 'domcontentloaded' })

    const reviewTitle = page.getByText(REVIEW_TITLE).first()
    await expect(reviewTitle).toBeVisible({ timeout: 12000 })

    // 해당 후기 article 안에서만 ⋮ 찾기
    const article = page.locator('article').filter({ has: page.getByText(REVIEW_TITLE) })
    const kebab = article.getByRole('button', { name: '더보기' })
    await expect(kebab).toBeVisible({ timeout: 5000 })
    await kebab.click()

    await expect(page.getByRole('menuitem', { name: '수정' })).toBeVisible({ timeout: 3000 })
    await expect(page.getByRole('menuitem', { name: '삭제' })).toBeVisible()
  })

  /* ─── 3. 수정 UI 플로우 ─── */
  test('3. 후기 수정 — ⋮ → 수정 → 저장', async ({ page, context }) => {
    await applyCookie(context, memberCookie!)
    await page.goto('/mypage/my-reviews', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(REVIEW_TITLE).first()).toBeVisible({ timeout: 12000 })

    const article = page.locator('article').filter({ has: page.getByText(REVIEW_TITLE) })
    const kebab = article.getByRole('button', { name: '더보기' })
    await kebab.click()
    await page.getByRole('menuitem', { name: '수정' }).click()

    await page.waitForURL((url) => url.pathname.includes('/edit'), { timeout: 8000 })
    await page.waitForLoadState('domcontentloaded')

    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 8000 })
    await textarea.clear()
    await textarea.fill(REVIEW_EDITED)
    await page.getByRole('button', { name: /저장|수정완료|완료/i }).click()

    await page.waitForURL((url) => url.pathname === '/mypage/my-reviews', { timeout: 8000 })
    // API 반영 대기 후 reload (캐시된 목록 방지)
    await page.waitForTimeout(1000)
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText(REVIEW_EDITED).first()).toBeVisible({ timeout: 12000 })
  })

  /* ─── 4. 삭제 버튼 표시 (5분 이내, 답변 없음) ─── */
  test('4. 삭제 버튼 표시 (5분 이내, 상담사 답변 없음)', async ({ page, context }) => {
    await applyCookie(context, memberCookie!)
    await page.goto('/mypage/my-reviews', { waitUntil: 'domcontentloaded' })

    const reviewText = page.getByText(REVIEW_EDITED).or(page.getByText(REVIEW_TITLE))
    await expect(reviewText.first()).toBeVisible({ timeout: 12000 })

    const article = page.locator('article').filter({
      has: page.getByText(REVIEW_EDITED).or(page.getByText(REVIEW_TITLE)),
    })
    const kebab = article.getByRole('button', { name: '더보기' })
    await expect(kebab).toBeVisible({ timeout: 5000 })
    await kebab.click()
    await expect(page.getByRole('menuitem', { name: '삭제' })).toBeVisible({ timeout: 3000 })
  })

  /* ─── 5. 상담사 답변 등록 (API) ─── */
  test('5. dummy_01이 후기에 답변 등록 (API)', async ({ request }) => {
    const r = await request.post(
      `https://${API}/api/user/counselor-mypage/reviews/${testReviewId}/reply`,
      { data: { content: REPLY_TEXT }, headers: { Cookie: `sjm_user=${counselorCookie}` } },
    )
    expect(r.status()).toBe(201)
  })

  /* ─── 6. 상담사 답변 후 해당 후기의 ⋮ 버튼 숨김 ─── */
  test('6. 상담사 답변 후 해당 후기의 ⋮ 버튼 숨김 (has_reply=true)', async ({ page, context }) => {
    await applyCookie(context, memberCookie!)
    await page.goto('/mypage/my-reviews', { waitUntil: 'domcontentloaded' })

    const reviewText = page.getByText(REVIEW_EDITED).or(page.getByText(REVIEW_TITLE))
    await expect(reviewText.first()).toBeVisible({ timeout: 12000 })

    // 해당 후기 article 안에 ⋮ 버튼이 없어야 함
    const article = page.locator('article').filter({
      has: page.getByText(REVIEW_EDITED).or(page.getByText(REVIEW_TITLE)),
    })
    const kebab = article.getByRole('button', { name: '더보기' })
    await expect(kebab).toHaveCount(0, { timeout: 5000 })
  })

  /* ─── 7. 상담사 후기 상세 → 답변 내용 표시 ─── */
  test('7. 상담사 마이페이지 후기 상세 — 답변 내용 표시', async ({ page, context }) => {
    await applyCookie(context, counselorCookie!)
    await page.goto('/counselor/mypage/reviews', { waitUntil: 'domcontentloaded' })

    // 테스트 후기 행 클릭 → 상세 이동
    const reviewLink = page.locator('a').filter({
      has: page.getByText(REVIEW_EDITED).or(page.getByText(REVIEW_TITLE)),
    })
    await expect(reviewLink.first()).toBeVisible({ timeout: 12000 })
    await reviewLink.first().click()

    await page.waitForLoadState('domcontentloaded')

    // 답변 내용 표시 확인
    await expect(page.getByText(REPLY_TEXT)).toBeVisible({ timeout: 10000 })
    // 입력창이 없어야 함 (답변 있을 때)
    const input = page.locator('input[placeholder*="답변"]')
    await expect(input).toHaveCount(0, { timeout: 3000 })
  })

  /* ─── 8. 상담사 답변 삭제 (UI) ─── */
  test('8. 상담사 답변 삭제 — "답변 삭제" 버튼 클릭 → 입력창 복원', async ({ page, context }) => {
    await applyCookie(context, counselorCookie!)

    // 상세 페이지로 바로 이동
    await page.goto(`/counselor/mypage/reviews/${testReviewId}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(REPLY_TEXT)).toBeVisible({ timeout: 12000 })

    // "답변 삭제" aria-label 버튼 클릭 + window.confirm 수락
    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: '답변 삭제' }).click()

    // API 처리 대기 후 reload로 UI 확정
    await page.waitForTimeout(2000)
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // 답변 사라지고 입력창 복원 확인
    await expect(page.getByText(REPLY_TEXT)).toHaveCount(0, { timeout: 10000 })
    await expect(
      page.locator('input[placeholder="답변을 입력해주세요."]')
    ).toBeVisible({ timeout: 8000 })
  })
})
