import { test, expect } from '@playwright/test'

/**
 * 상담 스타일 선택지 확대 (2026-06-12) — 5개 → 14개 (심플 단어, 원본).
 * 옵션은 setting `counselor.style_options` 에서 동적 로드 → 화면에 14개 버튼이 떠야 한다.
 * 선택 제한도 3 → 5 로 완화.
 */
const WORDS = ['친절한', '다정한', '든든한', '공감형', '깊이있는', '직설적인', '솔직한',
  '논리적인', '꼼꼼한', '차분한', '예언적인', '직관형', '시원시원한', '긍정적인']

test.use({ storageState: 'user_counselor_storage.json' }) // dummy_01 = 도운선생(상담사)

test.describe('상담 스타일 선택지', () => {
  test('14개 단어가 모두 버튼으로 노출 (신규 9개 포함)', async ({ page }) => {
    await page.goto('/counselor/mypage/style')
    await expect(page.getByRole('heading', { name: '상담 스타일' })).toBeVisible()

    // 14개 단어가 전부 선택 버튼으로 보여야 함 (옛 5개 fallback 이면 신규 9개가 안 보임)
    for (const w of WORDS) {
      await expect(
        page.getByRole('button', { name: w, exact: true }),
        `스타일 단어 "${w}" 버튼이 안 보임`,
      ).toBeVisible()
    }
  })
})
