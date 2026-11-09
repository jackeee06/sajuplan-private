import { test, expect, type Page } from '@playwright/test'

/**
 * 상담사 공지사항 줄바꿈 회귀 방지.
 *   상담사가 Enter 로 쓴 일반 글은 줄바꿈이 살아야 하고(whitespace-pre-line),
 *   관리자 편집기로 저장된 HTML 글은 빈 줄이 늘어나면 안 된다.
 *   실데이터를 건드리지 않도록 공지 값은 응답을 가로채서 넣고, 저장(PATCH)은 서버로 보내지 않는다.
 */
const COUNSELOR_ID = 533
const LINE_PX = 21 // 14px * 150%

function unwrap(body: Record<string, unknown>, key: string): Record<string, unknown> {
  const data = body.data as Record<string, unknown> | undefined
  return data && key in data ? data : body
}

async function openWithNotice(page: Page, content: string) {
  await page.route(new RegExp(`/api/user/counselors/${COUNSELOR_ID}(\\?.*)?$`), async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const res = await route.fetch()
    const body = await res.json()
    unwrap(body, 'notice_content').notice_content = content
    await route.fulfill({ response: res, json: body })
  })
  await page.goto(`/counselors/${COUNSELOR_ID}`, { waitUntil: 'domcontentloaded' })
  const box = page
    .locator('section', { has: page.getByRole('heading', { name: '상담사 공지사항' }) })
    .locator('.counselor-intro')
  await expect(box).toContainText('첫째')
  return box
}

test('일반 글 공지 — Enter 줄바꿈이 프로필에 그대로 보인다', async ({ page }) => {
  const box = await openWithNotice(page, '첫째 줄\n둘째 줄\n셋째 줄')
  await expect(box).toHaveCSS('white-space', 'pre-line')
  const height = (await box.boundingBox())!.height
  expect(height).toBeGreaterThanOrEqual(LINE_PX * 3 - 1)
  await box.screenshot({ path: 'test-results/132-plain-notice.png' })
})

test('HTML 공지 — 문단 수만큼만 보이고 빈 줄이 늘지 않는다', async ({ page }) => {
  const box = await openWithNotice(page, '<p>첫째 문단</p><p>둘째 문단</p>')
  const height = (await box.boundingBox())!.height
  expect(height).toBeGreaterThanOrEqual(LINE_PX * 2 - 1)
  expect(height).toBeLessThan(LINE_PX * 3)
})

test.describe('공지 수정 화면', () => {
  test.use({ storageState: 'user_counselor_storage.json' })

  test('HTML 로 저장된 공지 — 입력칸에 태그 없이 보이고, 일반 글로 저장된다', async ({ page }) => {
    let patched: string | null = null
    let wrapped = false
    // 테스트 계정의 그날 첫 접속이면 출석 안내창이 저장 버튼을 가린다.
    await page.addLocatorHandler(page.getByRole('heading', { name: '출석 완료!' }), async () => {
      await page.getByRole('dialog').getByRole('button', { name: '확인' }).click()
    })
    await page.route('**/api/user/counselors/me/notice', async (route) => {
      const req = route.request()
      if (req.method() === 'GET') {
        const res = await route.fetch()
        const body = await res.json()
        const target = unwrap(body, 'notice')
        wrapped = target !== body
        target.notice = '<p>첫째 줄</p><p><br></p><p>둘째 &amp; 줄</p>'
        return route.fulfill({ response: res, json: body })
      }
      patched = (req.postDataJSON() as { notice: string }).notice
      const saved = { notice: patched }
      return route.fulfill({ status: 200, json: wrapped ? { success: true, data: saved } : saved })
    })

    await page.goto('/counselor/mypage/notice-edit', { waitUntil: 'domcontentloaded' })
    const textarea = page.locator('textarea')
    await expect(textarea).toHaveValue('첫째 줄\n\n둘째 & 줄')

    await page.getByRole('button', { name: '저장하기' }).click()
    await expect(page.getByText('공지사항이 저장됐습니다.')).toBeVisible()
    expect(patched).toBe('첫째 줄\n\n둘째 & 줄')
  })
})
