import { test, expect } from '@playwright/test'

/**
 * 상담사 고객센터 문의 — 실제 사용자 손가락 동작 그대로 검증.
 *
 * 화면(시안)만 있고 저장이 안 되던 자리를 정식 연결한 뒤, 사장님이 직접 짚으신
 * 3가지(① 사진저장 이상 ② 작성완료 시 그냥 이탈 ③ 한번도 안 써본 자리)가
 * 실제 손가락으로 정상 동작하는지 끝까지 클릭해서 확인한다.
 *
 * 흐름(상담사 모드):
 *   문의하기 목록 → [문의하기] 탭 → 분류 선택(정산) → 제목/내용 입력
 *   → 사진 등록(실제 파일) → [작성완료] → 목록에 내 글 노출 → 상세 열람
 */

const API = 'https://api.sajuplan.com'
const uniq = `[E2E-FINGER] 정산 문의 ${Date.now()}`
const CONTENT = '실제 손가락 동작 검증용 문의 내용입니다.'

// 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

test.describe('상담사 고객센터 문의 — 손가락 작성→저장→조회', () => {
  test.use({ storageState: 'user_dual_storage.json' })

  test('작성 폼 끝까지 누르면 실제 저장되고 목록·상세에 뜬다', async ({ page }) => {
    // 네이티브 alert/confirm 이 뜨면 안 됨 (앱 WebView 동등성)
    let nativeDialog = false
    page.on('dialog', (d) => {
      nativeDialog = true
      void d.dismiss()
    })

    // 1) 문의하기 목록 진입 (사장님 스크린샷 화면)
    await page.goto('/counselor/mypage/qnas', { waitUntil: 'domcontentloaded' })
    expect(page.url()).not.toContain('/login')
    await expect(page.getByRole('heading', { name: '문의하기' })).toBeVisible()

    // 2) [문의하기] 탭 → 작성 폼
    await page.getByRole('button', { name: '문의하기' }).click()
    await page.waitForURL(/\/counselor\/mypage\/qnas\/new/, { timeout: 10000 })
    await expect(page.getByRole('heading', { name: '문의하기 작성' })).toBeVisible()

    // 3) 분류 선택 (커스텀 드롭다운)
    await page.getByRole('button', { name: '분류 선택' }).click()
    await page.getByRole('option', { name: '정산' }).click()
    await expect(page.getByRole('button', { name: '정산' })).toBeVisible()

    // 4) 제목 / 내용 입력
    await page.getByPlaceholder('제목을 입력해주세요.').fill(uniq)
    await page.getByPlaceholder('문의내용을 작성해주세요').fill(CONTENT)

    // 5) 사진 등록 — 실제 파일 (숨김 input 에 직접 주입 = 파일 선택과 동등)
    await page.locator('input[type="file"]').setInputFiles({
      name: 'finger.png',
      mimeType: 'image/png',
      buffer: PNG,
    })
    // 업로드 완료되면 (1/5) 로 카운트가 올라가고 미리보기가 뜬다
    await expect(page.getByText('(1/5)')).toBeVisible({ timeout: 15000 })
    console.log('[OK] 사진 1장 업로드 반영')

    // 6) 작성완료 → 목록으로 이동
    await page.getByRole('button', { name: '작성완료' }).click()
    await page.waitForURL(/\/counselor\/mypage\/qnas$/, { timeout: 15000 })
    console.log('[OK] 작성완료 → 목록 이동')

    // 7) 내가 쓴 글이 목록에 실제로 보인다 (= 저장됨, 더미 아님)
    //    SPA 네비게이션 직후 클라이언트 GET 캐시(2s)로 잠깐 직전 상태가 보일 수 있어,
    //    한 번 안 보이면 사용자처럼 새로고침 후 재확인한다.
    const titleLoc = page.getByText(uniq)
    try {
      await expect(titleLoc).toBeVisible({ timeout: 8000 })
    } catch {
      await page.reload({ waitUntil: 'networkidle' })
      await expect(titleLoc).toBeVisible({ timeout: 12000 })
    }
    await expect(page.getByText('답변대기').first()).toBeVisible()
    console.log('[OK] 목록에 내 문의 노출 (답변대기)')

    // 8) 상세 열람 — 내용·사진 확인
    await page.getByText(uniq).click()
    await page.waitForURL(/\/counselor\/mypage\/qnas\/\d+/, { timeout: 10000 })
    await expect(page.getByText(CONTENT)).toBeVisible({ timeout: 10000 })
    await expect(page.locator('main img').first()).toBeVisible()
    console.log('[OK] 상세에서 내용·첨부사진 확인')

    // 9) 첨부 사진 클릭 → 앱 내 전체화면 뷰어 (검은 화면/새 탭 없음)
    const pagesBefore = page.context().pages().length
    await page.locator('main img').first().click()
    const viewer = page.getByRole('dialog', { name: '첨부 사진 보기' })
    await expect(viewer).toBeVisible({ timeout: 8000 })
    expect(page.context().pages().length, '새 탭이 열리면 안 됨 (WebView 검은화면 원인)').toBe(pagesBefore)
    console.log('[OK] 첨부 사진 클릭 → 앱 내 뷰어 정상 (검은화면 없음)')

    // 9-1) 확대 — + 버튼(1→2배) + 사진 탭(2→3배)
    await expect(viewer.getByText('1배')).toBeVisible()
    await viewer.getByRole('button', { name: '확대' }).click()
    await expect(viewer.getByText('2배')).toBeVisible()
    await viewer.locator('img').click()
    await expect(viewer.getByText('3배')).toBeVisible()
    console.log('[OK] 사진 확대 1→2→3배')

    await viewer.getByRole('button', { name: '닫기' }).click()
    await expect(viewer).toBeHidden({ timeout: 5000 })

    expect(nativeDialog, '네이티브 다이얼로그가 떠선 안 됨').toBe(false)
  })
})
