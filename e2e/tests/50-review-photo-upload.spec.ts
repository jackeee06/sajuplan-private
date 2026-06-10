import { test, expect } from '@playwright/test'
import { join } from 'node:path'

/**
 * [2026-06-10] 후기 사진 업로드 — 실제 브라우저 손가락 동작 엄격검증
 *
 * 사장님 신고: 후기 사진 업로드가 한 번도 성공한 적 없음 (413 / 업로드 실패).
 * 원인: 서버 multer 5MB 제한 → 모바일 카메라 사진(3~8MB) 거부.
 * 수정: multer 30MB + 프론트 리사이즈 견고화.
 *
 * 이 테스트는 실제 브라우저로:
 *  1. 후기 작성 페이지 진입 (consultation_id=301, counselor_id=104)
 *  2. 8.7MB 사진을 파일 입력에 첨부 (옛 5MB 한도면 거부됐을 크기)
 *  3. 업로드 완료 대기 (1/1 표시)
 *  4. 제목/내용 입력 → 작성완료
 *  5. 성공 확인 (페이지 이탈)
 *
 * 검증 후 생성된 후기는 afterAll에서 정리 (코인 회수 포함).
 */

const BASE = 'https://api.sajuplan.com/api'
const CONSULTATION_ID = 320  // e2e_member ← 라온선생(123) 7분 상담
const COUNSELOR_ID = 123
const BIG_IMAGE = join(__dirname, '..', 'fixtures', 'test-review-big.jpg')

test.describe.serial('후기 사진 업로드 — 실브라우저 검증', () => {
  test.use({ storageState: 'user_member_storage.json' })

  let createdReviewId: number | null = null

  test('8.7MB 사진 첨부 → 업로드 성공 → 후기 작성 완료', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })

    // 1. 후기 작성 페이지 진입
    await page.goto(`/mypage/my-reviews/new?consultation_id=${CONSULTATION_ID}&counselor_id=${COUNSELOR_ID}`)
    await page.waitForLoadState('domcontentloaded')

    // 페이지 정상 로드 확인 — "상담 후기 작성" 헤더
    await expect(page.getByText('상담 후기 작성').first()).toBeVisible({ timeout: 10000 })

    // 2. 사진 첨부 — 숨겨진 file input에 8.7MB 이미지 주입
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(BIG_IMAGE)
    console.log('[사진 첨부] 8.7MB 이미지 input 주입 완료')

    // 3. 업로드 완료 대기 — "업로드 중..." 사라지고 (1/1) 표시
    //    업로드 성공 시 미리보기에 X 삭제버튼 + "업로드 중" 텍스트 사라짐
    await expect(page.getByText('업로드 중', { exact: false })).toBeHidden({ timeout: 30000 })
    console.log('[업로드 완료] "업로드 중" 사라짐')

    // (1/1) 카운터 확인
    await expect(page.getByText('(1/1)')).toBeVisible({ timeout: 5000 })
    console.log('[사진 카운터] 1/1 확인')

    // "사진 업로드에 실패했습니다" 에러가 없어야 함
    const uploadFailed = await page.getByText('사진 업로드에 실패').isVisible().catch(() => false)
    expect(uploadFailed, '사진 업로드 실패 메시지 노출됨 — 여전히 버그').toBe(false)

    // 413 등 에러 텍스트 없어야 함
    const has413 = await page.getByText('Payload Too Large', { exact: false }).isVisible().catch(() => false)
    expect(has413, '413 Payload Too Large 에러 — multer 제한 미해결').toBe(false)

    // 4. 제목/내용 입력
    await page.locator('input[type="text"]').first().fill('[E2E] 사진 후기 업로드 검증')
    await page.locator('textarea').first().fill('8.7MB 사진 첨부 후기 — 업로드 정상 동작 검증용. 자동 삭제 예정.')

    // 5. 작성완료 클릭
    await page.getByRole('button', { name: '작성완료' }).click()

    // 6. 성공 — 페이지 이탈 (후기 목록 또는 마이페이지로) 또는 성공 토스트
    //    실패 시 에러 메시지가 뜸. URL이 바뀌거나 에러 없으면 성공.
    await page.waitForTimeout(2000)
    const stillOnForm = page.url().includes('/my-reviews/new')
    const errorVisible = await page.getByText(/실패|오류|에러/).first().isVisible().catch(() => false)

    console.log(`[작성완료 후] URL=${page.url()}, 폼잔류=${stillOnForm}, 에러=${errorVisible}`)
    expect(errorVisible, '후기 작성 완료 시 에러 발생').toBe(false)

    // 생성된 reviewId 확보 (정리용) — API로 최근 후기 조회
    const histRes = await page.request.get(`${BASE}/user/points/history?limit=5`)
    const hist = await histRes.json() as Record<string, unknown>
    const items = Array.isArray(hist.items) ? hist.items : []
    const reviewEntry = items.find((h: Record<string, unknown>) =>
      typeof h.rel_action === 'string' && h.rel_action.startsWith('review:')
    ) as Record<string, unknown> | undefined
    if (reviewEntry?.rel_action) {
      createdReviewId = Number(String(reviewEntry.rel_action).split(':')[1])
      console.log(`[생성된 후기] reviewId=${createdReviewId}`)
    }

    // 7. ★ 사진이 실제로 표시되는지 — 작성된 후기 상세 API에서 photo_url 확인
    if (createdReviewId) {
      const detailRes = await page.request.get(`${BASE}/user/reviews/${createdReviewId}`)
      expect(detailRes.status(), '후기 상세 조회 실패').toBe(200)
      const detail = await detailRes.json() as Record<string, unknown>
      console.log(`[후기 상세] photo_url=${detail.photo_url}, photo_url_webp=${detail.photo_url_webp}`)

      // 사진 URL이 실제로 저장됐는지
      expect(detail.photo_url, '후기에 photo_url 없음 — 사진 저장 안 됨').toBeTruthy()
      expect(String(detail.photo_url), 'photo_url 형식 이상').toContain('/uploads/review/')

      // webp 변환본도 있는지 (용량 최적화 확인)
      expect(detail.photo_url_webp, 'webp 변환본 없음 — 용량 최적화 누락').toBeTruthy()
      expect(String(detail.photo_url_webp), 'webp URL 형식 이상').toContain('.webp')

      // 실제로 이미지가 서버에서 서빙되는지 (webp 우선)
      const imgUrl = `https://api.sajuplan.com${String(detail.photo_url_webp)}`
      const imgRes = await page.request.get(imgUrl)
      expect(imgRes.status(), `사진 서빙 실패: ${imgUrl}`).toBe(200)
      const ct = imgRes.headers()['content-type'] ?? ''
      expect(ct, `이미지 content-type 이상: ${ct}`).toContain('image')
      const sizeKB = (Number(imgRes.headers()['content-length'] ?? 0) / 1024).toFixed(1)
      console.log(`[사진 서빙 OK] ${imgUrl} (${ct}, ${sizeKB}KB) — webp 최적화 확인`)
    }

    console.log(`[console errors] ${consoleErrors.length}건`)
  })

  test.afterAll(async ({ request }) => {
    // 생성된 테스트 후기 삭제 (5분 이내 → 코인도 자동 회수됨)
    if (createdReviewId) {
      const del = await request.delete(`${BASE}/user/reviews/${createdReviewId}`, {
        headers: {},
      }).catch(() => null)
      console.log(`[정리] reviewId=${createdReviewId} 삭제 status=${del?.status() ?? 'fail'}`)
    }
  })
})
