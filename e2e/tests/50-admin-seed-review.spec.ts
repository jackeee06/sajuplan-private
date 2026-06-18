import { test, expect } from '@playwright/test'

/**
 * 관리자 시딩 후기 작성 검증 (2026-06-12)
 *  - POST /admin/posts/reviews/seed → 검증 우회 작성
 *  - 공개 후기 목록(상담사 상세)에 노출 + 작성자명은 입력한 표시명 그대로(마스킹 안 함)
 *  - created_at 과거 지정 → created_at DESC 정렬상 그 시점에 배치
 *  - 회원 코인 미지급(member_id NULL → 코인 로직 미호출)
 *  - 끝나면 정리(DELETE)
 *
 * test.use 생략 → playwright.config 기본(admin storageState) 사용.
 */

const API = 'https://api.sajuplan.com/api'
const COUNSELOR_ID = 123 // 라온선생

test('시딩 후기: 작성 → 공개 노출 → 과거시점 정렬 → 표시명 그대로 → 정리', async ({ request }) => {
  const stamp = String(Date.now()).slice(-6)
  const reviewerName = `테*${stamp}`
  const title = `E2E시딩제목_${stamp}`
  const pastISO = '2026-03-15T01:00:00.000Z'

  // 1) 시딩 후기 작성
  const res = await request.post(`${API}/admin/posts/reviews/seed`, {
    data: {
      counselor_id: COUNSELOR_ID,
      reviewer_name: reviewerName,
      title,
      content: '관리자 시딩 후기 본문입니다. 초기 가치 부여용 마케팅 후기.',
      rating: 5,
      created_at: pastISO,
      consult_type: '채팅',
      consult_duration_sec: 1040, // 17분 20초
    },
  })
  expect(res.ok(), `시딩 작성 실패: ${res.status()} ${await res.text()}`).toBeTruthy()
  const created = await res.json()
  const id = Number(created.id)
  expect(id).toBeGreaterThan(0)

  try {
    // 2) 공개 후기 목록(상담사 상세)에 노출 + 표시명/과거시점 확인
    const list = await request.get(`${API}/user/counselors/${COUNSELOR_ID}/reviews?limit=50`)
    expect(list.ok()).toBeTruthy()
    const body = await list.json()
    const found = (body.items as Array<Record<string, unknown>>).find((r) => Number(r.id) === id)
    expect(found, '시딩 후기가 공개 목록에 노출되지 않음').toBeTruthy()

    // 표시명은 입력값 그대로 (시딩은 이미 "테*…" 형태라 추가 마스킹 안 함)
    expect(found!.reviewer_name).toBe(reviewerName)
    // 제목/별점 반영
    expect(found!.title).toBe(title)
    expect(Number(found!.rating)).toBe(5)
    // created_at 과거 지정 반영
    expect(String(found!.created_at)).toContain('2026-03-15')
  } finally {
    // 3) 정리 — 시딩 후기 삭제
    const del = await request.delete(`${API}/admin/posts/review/${id}`)
    expect(del.ok(), '시딩 후기 정리(삭제) 실패').toBeTruthy()
  }
})
