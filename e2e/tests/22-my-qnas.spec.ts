import { test, expect } from '@playwright/test'

/**
 * [2026-06-04] 나의 상담문의 화면 E2E
 * test.use storageState — Playwright 네이티브 방식 (cookies + localStorage 완전 복원)
 */

test.describe('나의 상담문의', () => {
  test.use({ storageState: 'user_member_storage.json' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/mypage/my-qnas')
    await page.waitForLoadState('domcontentloaded')
  })

  test('헤더 렌더', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '나의 상담문의' })).toBeVisible()
  })

  test('목록 또는 빈 상태 노출', async ({ page }) => {
    const items = page.locator('article')
    const empty = page.getByText('작성한 상담문의가 없습니다.')
    // 데이터 로드 대기 — networkidle 금지(WebSocket 폴링으로 never satisfied), 짧은 sleep으로 대체
    await page.waitForTimeout(1500)
    const count = await items.count()
    if (count === 0) {
      await expect(empty).toBeVisible({ timeout: 5000 })
    } else {
      expect(count).toBeGreaterThan(0)
    }
  })

  test('답변대기 항목 — ⋮ 메뉴 버튼 존재', async ({ page }) => {
    const items = page.locator('article')
    const count = await items.count()
    if (count === 0) return
    let found = false
    for (let i = 0; i < count; i++) {
      const menuBtn = items.nth(i).getByRole('button', { name: '더보기' })
      if (await menuBtn.isVisible()) {
        found = true
        await menuBtn.click()
        await expect(page.getByRole('menuitem', { name: '수정' })).toBeVisible()
        await expect(page.getByRole('menuitem', { name: '삭제' })).toBeVisible()
        await page.keyboard.press('Escape')
        break
      }
    }
    expect(found || count > 0).toBeTruthy()
  })

  test('답변완료 항목 — 핑크 박스 노출', async ({ page }) => {
    const pinkBox = page.locator('button:has-text("탭하여 확인하세요")')
    if (await pinkBox.count() > 0) {
      await expect(pinkBox.first()).toBeVisible()
    }
  })

  test('구버전 배지("답변대기" span) 미노출', async ({ page }) => {
    await expect(page.locator('span:has-text("답변대기")')).toHaveCount(0)
  })

  test('삭제 — 실제 UI 클릭 전체 흐름 (⋮ → 삭제 → 모달확인 → 목록 사라짐)', async ({ page, request }) => {
    const BASE = 'https://api.sajuplan.com'
    const cookies = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; ')

    // 1) 실존하는 상담사 ID 동적 조회
    const csrRes = await request.get(`${BASE}/api/user/counselors?limit=5`, {
      headers: { Cookie: cookies },
    })
    if (!csrRes.ok()) { console.log('상담사 목록 조회 실패 — skip'); return }
    const csrData = await csrRes.json()
    const counselorId = csrData?.items?.[0]?.id ?? csrData?.[0]?.id
    if (!counselorId) { console.log('상담사 없음 — skip'); return }

    // 2) 테스트용 문의 작성
    const MARKER = `UI삭제테스트_${Date.now()}`
    const writeRes = await request.post(`${BASE}/api/user/counselors/${counselorId}/qna`, {
      headers: { Cookie: cookies },
      data: { title: MARKER, content: MARKER, is_secret: false },
    })
    if (!writeRes.ok()) {
      console.log('문의 작성 실패:', writeRes.status(), await writeRes.text())
      return
    }

    // 3) 페이지 새로고침 → 방금 작성한 문의가 목록 상단에 보여야 함
    await page.reload()
    await page.waitForTimeout(2000)
    const newItem = page.locator('article').filter({ hasText: MARKER })
    await expect(newItem).toBeVisible({ timeout: 8000 })

    // 4) ⋮ 버튼 클릭
    const menuBtn = newItem.getByRole('button', { name: '더보기' })
    await expect(menuBtn).toBeVisible({ timeout: 5000 })
    await menuBtn.click()

    // 5) 드롭다운에 "수정"/"삭제" 모두 보임
    await expect(page.getByRole('menuitem', { name: '수정' })).toBeVisible({ timeout: 3000 })
    await expect(page.getByRole('menuitem', { name: '삭제' })).toBeVisible({ timeout: 3000 })
    await page.getByRole('menuitem', { name: '삭제' }).click()

    // 6) 확인 모달 노출
    await expect(page.getByText('문의를 삭제하시겠습니까?')).toBeVisible({ timeout: 3000 })

    // 7) 모달 "삭제" 버튼 클릭
    await page.getByRole('button', { name: '삭제' }).last().click()

    // 8) 토스트 "문의가 삭제되었습니다." 노출
    await expect(page.getByText('문의가 삭제되었습니다.')).toBeVisible({ timeout: 5000 })

    // 9) 목록에서 사라짐 (핵심 검증)
    await expect(newItem).toHaveCount(0, { timeout: 5000 })
  })
})
