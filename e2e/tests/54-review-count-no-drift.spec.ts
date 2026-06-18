import { test, expect } from '@playwright/test'

/**
 * review_count 캐시 drift 방지 검증 (2026-06-12)
 *  - 후기 생성 시 +1, 삭제 시 원복되어야 함(삭제 때 review_count 재계산 추가).
 *  - 이전엔 삭제 시 갱신 누락 → 탭 "후기(N)"(캐시)과 "전체 N건"(실시간)이 어긋났음.
 */

const API = 'https://api.sajuplan.com/api'
const COUNSELOR_ID = 123

async function reviewCount(request: import('@playwright/test').APIRequestContext): Promise<number> {
  const r = await request.get(`${API}/user/counselors/${COUNSELOR_ID}`)
  return Number((await r.json()).review_count ?? 0)
}

test('후기 생성→삭제 후 review_count 원복 (drift 없음)', async ({ request }) => {
  const base = await reviewCount(request)

  // 생성 → +1
  const res = await request.post(`${API}/admin/posts/reviews/seed`, {
    data: {
      counselor_id: COUNSELOR_ID,
      reviewer_name: '카*드',
      title: `drift체크_${String(Date.now()).slice(-6)}`,
      content: 'review_count drift 검증용 시딩 후기.',
      consult_type: '채팅',
      consult_duration_sec: 600,
    },
  })
  expect(res.ok()).toBeTruthy()
  const id = Number((await res.json()).id)

  const afterCreate = await reviewCount(request)
  expect(afterCreate, '생성 후 review_count +1 아님').toBe(base + 1)

  // 삭제 → 원복
  const del = await request.delete(`${API}/admin/posts/review/${id}`)
  expect(del.ok()).toBeTruthy()

  const afterDelete = await reviewCount(request)
  expect(afterDelete, '삭제 후 review_count 원복 안 됨 (drift 발생)').toBe(base)
})
