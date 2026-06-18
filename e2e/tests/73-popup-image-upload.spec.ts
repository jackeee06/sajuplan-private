import { test, expect } from '@playwright/test'

/**
 * [2026-06-12] 팝업 이미지 업로드 404 버그 수정 검증.
 *
 * 버그: 관리자 팝업폼이 이미지 업로드를 FILE_BASE(/api 없는 origin)로 POST → "Cannot POST /admin/popup-layers/:id/image"(404).
 * 수정: 표준 API_BASE(/api 포함) 사용.
 *
 * 검증: 올바른 경로(/api/admin/...)는 200+image_url 저장 / 옛 경로(/admin/..., /api 없음)는 404(회귀 재현).
 * 테스트 팝업은 is_active=false 로 만들어 사용자 노출 0, 끝나면 삭제.
 */

const API = 'https://api.sajuplan.com'
// 1x1 투명 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

test('팝업 이미지 업로드 — /api 경로 200, 옛 경로(/api 없음) 404', async ({ playwright }) => {
  const api = await playwright.request.newContext()
  const login = await api.post(`${API}/api/admin/auth/login`, {
    data: { mb_id: 'admin_e2e', password: '1234!' },
  })
  test.skip(!login.ok(), 'admin 세션 없음')

  // 1. 비활성 테스트 팝업 생성 (사용자 노출 0)
  const now = Date.now()
  const c = await api.post(`${API}/api/admin/popup-layers`, {
    data: {
      device: 'both',
      starts_at: new Date(now).toISOString(),
      ends_at: new Date(now + 86_400_000).toISOString(),
      title: 'E2E 이미지업로드 테스트 (자동삭제)',
      is_active: false,
    },
  })
  expect(c.ok(), '팝업 생성 200').toBeTruthy()
  const id = Number((await c.json()).id) // postgres 가 문자열로 줄 수 있어 숫자 변환
  expect(Number.isFinite(id) && id > 0, '팝업 id 확보').toBeTruthy()

  try {
    // 2. 옛 버그 경로(/api 없음) → 404 재현
    const wrong = await api.post(`${API}/admin/popup-layers/${id}/image`, {
      multipart: { file: { name: 't.png', mimeType: 'image/png', buffer: PNG } },
    })
    expect(wrong.status(), '옛 경로(/api 없음)는 404 여야(버그 재현)').toBe(404)

    // 3. 고친 경로(/api 포함) → 200 + image_url 저장
    const ok = await api.post(`${API}/api/admin/popup-layers/${id}/image`, {
      multipart: { file: { name: 't.png', mimeType: 'image/png', buffer: PNG } },
    })
    expect(ok.ok(), `정상 경로 업로드 200 (실제 ${ok.status()})`).toBeTruthy()
    const updated = await ok.json()
    expect(updated.image_url, '이미지 URL 저장됨').toBeTruthy()
  } finally {
    await api.delete(`${API}/api/admin/popup-layers/${id}`).catch(() => undefined)
    await api.dispose()
  }
})
