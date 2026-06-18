import { test, expect, request } from '@playwright/test'

/**
 * 상담사 → 운영자 1:1 고객센터 문의 (상담사 마이페이지 "문의하기") 정식 연결 검증.
 *
 * 그동안 화면(시안)만 있고 저장/조회가 없어 작성이 안 되던 자리.
 * 백엔드(counselor_inquiry) + 작성/목록/상세 + 사진업로드 + 관리자 답변을 정식 연결.
 *
 * 전체 루프:
 *   상담사 작성(201) → 목록 노출(pending) → 상세 일치 → 사진 업로드(url)
 *   → 회원 계정 차단(403) → 관리자 답변 → 상담사 상세 답변완료(answered)
 *
 * 세션:
 *   user_dual_storage.json   = e2e_dual (회원+상담사 듀얼, role=counselor)
 *   user_member_storage.json = e2e_member (일반 회원)
 *   관리자 답변은 E2E_ADMIN_PW(+E2E_ADMIN_ID) 환경변수 있을 때만 검증 (없으면 skip).
 */

const API = 'https://api.sajuplan.com'
const BASE = `${API}/api/user/counselor-mypage/inquiry`
const ADMIN_BASE = `${API}/api/admin/counselor-inquiries`

let inquiryId = 0
const uniqTitle = `[E2E] 정산 문의 ${Date.now()}`

test.describe.serial('상담사 고객센터 문의 — 작성→목록→답변 전체 루프', () => {
  test('상담사 계정: 문의 작성 → 저장 성공 + id 반환', async () => {
    const ctx = await request.newContext({ storageState: 'user_dual_storage.json' })
    const r = await ctx.post(BASE, {
      data: { category: '정산', title: uniqTitle, content: 'E2E 자동 검증용 문의입니다.', photos: [] },
    })
    expect([200, 201]).toContain(r.status())
    const body = (await r.json()) as { id: number }
    expect(body.id).toBeGreaterThan(0)
    inquiryId = body.id
    console.log('[OK] 작성 성공 id=', inquiryId)
    await ctx.dispose()
  })

  test('상담사 계정: 작성한 문의가 목록에 노출 (답변대기)', async () => {
    const ctx = await request.newContext({ storageState: 'user_dual_storage.json' })
    const r = await ctx.get(`${BASE}?limit=20&offset=0`)
    expect(r.ok()).toBeTruthy()
    const body = (await r.json()) as { items: { id: number; title: string; status: string }[]; total: number }
    const found = body.items.find((it) => it.id === inquiryId)
    expect(found, '작성한 문의가 목록에 있어야 함').toBeTruthy()
    expect(found?.title).toBe(uniqTitle)
    expect(found?.status).toBe('pending')
    console.log('[OK] 목록 노출 + 답변대기')
    await ctx.dispose()
  })

  test('상담사 계정: 상세 조회 — 내용 일치', async () => {
    const ctx = await request.newContext({ storageState: 'user_dual_storage.json' })
    const r = await ctx.get(`${BASE}/${inquiryId}`)
    expect(r.ok()).toBeTruthy()
    const d = (await r.json()) as { title: string; category: string; status: string; content: string }
    expect(d.title).toBe(uniqTitle)
    expect(d.category).toBe('정산')
    expect(d.status).toBe('pending')
    console.log('[OK] 상세 일치')
    await ctx.dispose()
  })

  test('상담사 계정: 사진 업로드 → url 반환', async () => {
    const ctx = await request.newContext({ storageState: 'user_dual_storage.json' })
    // 1x1 투명 PNG
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    )
    const r = await ctx.post(`${BASE}/upload`, {
      multipart: { file: { name: 'e2e.png', mimeType: 'image/png', buffer: png } },
    })
    expect(r.ok()).toBeTruthy()
    const body = (await r.json()) as { url: string }
    expect(body.url).toContain('/uploads/counselor-inquiry/')
    console.log('[OK] 사진 업로드 url=', body.url)
    await ctx.dispose()
  })

  test('일반 회원 계정: 상담사 전용 문의 작성은 403', async () => {
    const ctx = await request.newContext({ storageState: 'user_member_storage.json' })
    const r = await ctx.post(BASE, {
      data: { category: '정산', title: '[E2E] 회원차단', content: 'should be blocked', photos: [] },
    })
    expect(r.status()).toBe(403)
    console.log('[OK] 회원 계정 차단 403')
    await ctx.dispose()
  })

  test('관리자 답변 → 상담사 화면 답변완료 (E2E_ADMIN_PW 있을 때만)', async () => {
    const adminId = process.env.E2E_ADMIN_ID
    const adminPw = process.env.E2E_ADMIN_PW
    test.skip(!adminId || !adminPw, 'E2E_ADMIN_ID/PW 미설정 — 관리자 답변 검증 skip')

    const actx = await request.newContext()
    const lr = await actx.post(`${API}/api/admin/auth/login`, { data: { mb_id: adminId, password: adminPw } })
    expect(lr.ok(), '관리자 로그인 성공').toBeTruthy()

    const rep = await actx.post(`${ADMIN_BASE}/${inquiryId}/reply`, {
      data: { content: 'E2E 운영팀 답변입니다. 정상 처리되었습니다.' },
    })
    expect(rep.ok(), '답변 등록 성공').toBeTruthy()
    await actx.dispose()

    // 상담사 상세에서 답변완료 확인
    const ctx = await request.newContext({ storageState: 'user_dual_storage.json' })
    const r = await ctx.get(`${BASE}/${inquiryId}`)
    const d = (await r.json()) as { status: string; reply_content: string | null }
    expect(d.status).toBe('answered')
    expect(d.reply_content).toContain('E2E 운영팀 답변')
    console.log('[OK] 관리자 답변 → 상담사 답변완료')
    await ctx.dispose()
  })
})
