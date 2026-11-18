import { test, expect } from '@playwright/test'
import { skipIfAdminLoginFailed } from '../helpers/admin-skip'

/**
 * 알림톡 발송(수동) 화면 UX 개편 검증 (2026-06-25).
 *
 * 검증 포인트 (실제 발송은 하지 않음 — 비용/스팸 방지, UI 렌더링까지만):
 *  1. 템플릿이 암호 코드 드롭다운이 아니라 "한글 이름 카드"로 보임 + 그룹 헤더(회원에게/상담사에게)
 *  2. 카드 선택 시 #{빈칸}이 라벨 달린 입력 폼으로 자동 생성 + 실시간 미리보기
 *  3. "변수(JSON)" 텍스트가 화면에 더 이상 없음
 *  4. 받는 사람 "골라서 보내기"(회원 검색)가 기본 노출
 *  5. 자동전용 템플릿 경고 배지
 *  6. JS 콘솔 에러 0
 */

async function login(page: import('@playwright/test').Page) {
  await page.goto('/mng/alimtalk-bulk')
  if (page.url().includes('/mng/login')) {
    await page.getByPlaceholder('admin').fill('admin')
    await page.getByPlaceholder('비밀번호를 입력하세요').fill('test1234!')
    await page.getByRole('button', { name: '로그인' }).click()
    await expect(page).not.toHaveURL(/\/mng\/login/, { timeout: 10_000 })
    await page.goto('/mng/alimtalk-bulk')
  }
}

test.use({ viewport: { width: 1366, height: 900 } })

test.describe('알림톡 발송(수동) UX 개편', () => {
  test.beforeEach(skipIfAdminLoginFailed)

  test('템플릿 한글 카드 + 변수 자동폼 + 미리보기 + 회원검색 (발송 X)', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !/status of (401|404)/.test(msg.text())) {
        consoleErrors.push(`console.error: ${msg.text()}`)
      }
    })

    await login(page)
    await page.waitForLoadState('networkidle').catch(() => {})

    // 0. 최상단 붉은 경고 + 잠금 게이트 — 발송 폼은 기본 숨김
    await expect(page.getByText('이 화면은 평소 쓸 일이 없습니다 — 함부로 발송하지 마세요')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('회원에게', { exact: true })).toHaveCount(0) // 잠금 상태엔 폼 안 보임
    await page.getByRole('button', { name: /위험을 이해했습니다/ }).click()

    // 1. 그룹 헤더 + 한글 템플릿 이름 카드
    await expect(page.getByText('회원에게', { exact: true })).toBeVisible({ timeout: 15_000 })
    const couponCard = page.getByRole('button', { name: /쿠폰 발급 안내/ })
    await expect(couponCard, '한글 템플릿 카드(쿠폰 발급 안내) 없음').toBeVisible()

    // 3. "변수 (JSON)" 라벨이 사라졌는지
    await expect(page.getByText('변수 (JSON)')).toHaveCount(0)

    // 5. 자동전용 배지가 템플릿 카드에 존재 (예: 인증번호/결제완료 등) — 템플릿 선택 전부터 노출
    await expect(page.getByText('🔒 자동 전용').first()).toBeVisible()

    // 2. 템플릿 선택 → 빈칸 폼 + 미리보기 등장 (② 섹션은 선택 후 노출)
    await couponCard.click()
    await page.waitForTimeout(500)
    await expect(page.getByText('빈칸 채우기 & 미리보기')).toBeVisible()
    await expect(page.getByText('실제 발송 미리보기')).toBeVisible()

    // 4. 받는 사람 "골라서 보내기"(회원검색) 칩 — ③ 섹션은 템플릿 선택 후 노출
    await expect(page.getByRole('button', { name: '골라서 보내기' })).toBeVisible()

    // 발송 버튼은 존재하되 클릭하지 않음 (실제 발송 방지)
    await expect(page.getByRole('button', { name: /일괄 발송/ })).toBeVisible()

    expect(consoleErrors, `JS 에러: ${consoleErrors.join(' / ')}`).toHaveLength(0)
  })
})
