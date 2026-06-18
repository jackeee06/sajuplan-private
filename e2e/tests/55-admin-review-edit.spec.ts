import { test, expect } from '@playwright/test'

/**
 * 관리자 후기 수정 검증 (2026-06-12)
 *  - 시딩 후기: 제목·내용·작성자명·작성일 수정 → 공개 목록에 반영.
 */

const API = 'https://api.sajuplan.com/api'
const COUNSELOR_ID = 123

test('시딩 후기 수정 → 제목·작성자명·작성일 반영', async ({ request }) => {
  const stamp = String(Date.now()).slice(-6)
  // 생성
  const res = await request.post(`${API}/admin/posts/reviews/seed`, {
    data: {
      counselor_id: COUNSELOR_ID,
      reviewer_name: `김*수`,
      title: `수정전_${stamp}`,
      content: '수정 전 내용',
      consult_type: '채팅',
      consult_duration_sec: 600,
    },
  })
  expect(res.ok()).toBeTruthy()
  const id = Number((await res.json()).id)

  try {
    // 수정
    const newTitle = `수정후_${stamp}`
    const newName = `박*지`
    const pastISO = new Date(Date.now() - 5 * 86400000).toISOString()
    const edit = await request.patch(`${API}/admin/posts/reviews/${id}/edit`, {
      data: { title: newTitle, content: '수정 후 내용입니다.', reviewer_name: newName, created_at: pastISO },
    })
    expect(edit.ok(), `수정 실패: ${edit.status()} ${await edit.text()}`).toBeTruthy()
    const editJson = await edit.json()
    expect(editJson.is_seed, '시딩으로 인식 안 됨').toBe(true)

    // 공개 목록에 반영 확인
    const list = await request.get(`${API}/user/counselors/${COUNSELOR_ID}/reviews?limit=50`)
    const body = await list.json()
    const found = (body.items as Array<Record<string, unknown>>).find((r) => Number(r.id) === id)
    expect(found, '수정한 후기 미노출').toBeTruthy()
    expect(found!.title, '제목 미반영').toBe(newTitle)
    expect(found!.reviewer_name, '작성자명 미반영').toBe(newName)
    expect(String(found!.created_at), '작성일 미반영').toContain(pastISO.slice(0, 10))
  } finally {
    await request.delete(`${API}/admin/posts/review/${id}`)
  }
})
