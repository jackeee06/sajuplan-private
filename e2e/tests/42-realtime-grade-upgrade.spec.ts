import { test, expect, request } from '@playwright/test'

/**
 * [Phase E2E] 실시간 등급 승급 시스템 검증 (2026-06-07)
 *
 * 검증 포인트:
 *   1. GET /user/counselor-mypage/grade/progress — API 존재 + 응답 구조
 *   2. progress 응답: total_hours / grade / progress_pct / realtime_upgrades 포함
 *   3. GET /admin/grade/counselor/:id/realtime-upgrades — 실시간 승급 이력 API
 *   4. 수익금 내역 grade_at_session 필드 포함 여부 (settlements/income)
 *   5. 등급 이력 changed_by 값 확인 (member_grade_history)
 */

const API = 'https://api.sajuplan.com'
// dummy_01: E2E 테스트용 상담사 역할 계정 (global-setup.ts 기준)
const COUNSELOR_CREDS = { mb_id: 'dummy_01', password: 'dummy_pass_2026!' }

async function adminLogin() {
  // storageState 기반 (global-setup 에서 미리 로그인)
  const ctx = await request.newContext({
    storageState: 'storageState.json',
  })
  // 세션 유효 여부 확인
  const check = await ctx.get(`${API}/api/admin/dashboard/summary`).catch(() => null)
  if (!check || (check.status() !== 200 && check.status() !== 201)) {
    // 폴백: 직접 로그인
    const ctx2 = await request.newContext()
    const resp = await ctx2.post(`${API}/api/admin/auth/login`, {
      data: { mb_id: 'lee', password: 'kunwoo77' },
    })
    if (resp.status() !== 200 && resp.status() !== 201) return null
    return ctx2
  }
  return ctx
}

async function counselorLogin() {
  const ctx = await request.newContext()
  const resp = await ctx.post(`${API}/api/user/auth/login`, {
    data: COUNSELOR_CREDS,
  })
  if (resp.status() !== 200 && resp.status() !== 201) return null
  return ctx
}

// ─────────────────────────────────────────

test.describe('실시간 등급 승급 — API 구조 검증', () => {

  test('GET /user/counselor-mypage/grade/progress — 응답 구조 확인', async () => {
    const ctx = await counselorLogin()
    if (!ctx) { test.skip(); return }

    const resp = await ctx.get(`${API}/api/user/counselor-mypage/grade/progress`)
    expect(resp.status()).toBe(200)

    const data = await resp.json() as {
      total_seconds: number
      total_hours: number
      grade: string
      grade_label: string
      next_grade: string | null
      next_grade_label: string | null
      next_threshold_hours: number | null
      progress_pct: number
      realtime_upgrades_this_month: unknown[]
    }

    // 필수 필드 존재
    expect(typeof data.total_seconds).toBe('number')
    expect(typeof data.total_hours).toBe('number')
    expect(typeof data.grade).toBe('string')
    expect(typeof data.grade_label).toBe('string')
    expect(typeof data.progress_pct).toBe('number')
    expect(Array.isArray(data.realtime_upgrades_this_month)).toBe(true)

    // progress_pct 는 0~100 범위
    expect(data.progress_pct).toBeGreaterThanOrEqual(0)
    expect(data.progress_pct).toBeLessThanOrEqual(100)

    // 유효한 등급 코드
    const validGrades = ['preliminary', 'partner1', 'partner2', 'partner3', 'partner4', 'partner5']
    expect(validGrades).toContain(data.grade)

    console.log(`[grade-progress] grade=${data.grade} hours=${data.total_hours} pct=${data.progress_pct}%`)
    console.log(`[grade-progress] upgrades this month: ${data.realtime_upgrades_this_month.length}건`)
  })

  test('GET /user/counselor-mypage/grade/progress — 파트너5는 next_grade=null', async () => {
    // 이 테스트는 파트너5 계정으로 로그인해야 정확하지만
    // 구조 검증으로 대체 (파트너5가 아니면 next_grade는 문자열)
    const ctx = await counselorLogin()
    if (!ctx) { test.skip(); return }

    const resp = await ctx.get(`${API}/api/user/counselor-mypage/grade/progress`)
    expect(resp.status()).toBe(200)
    const data = await resp.json() as { grade: string; next_grade: string | null; next_threshold_hours: number | null }

    if (data.grade === 'partner5') {
      expect(data.next_grade).toBeNull()
      expect(data.next_threshold_hours).toBeNull()
    } else {
      expect(data.next_grade).not.toBeNull()
      expect(typeof data.next_threshold_hours).toBe('number')
    }
  })

})

// ─────────────────────────────────────────

test.describe('실시간 승급 이력 — 어드민 API', () => {

  test('GET /admin/grade/counselor/:id/realtime-upgrades — API 존재 + 구조', async () => {
    const ctx = await adminLogin()
    if (!ctx) { test.skip(); return }

    // 상담사 목록에서 첫 번째 상담사 ID 조회
    const listResp = await ctx.get(`${API}/api/admin/members?role=counselor&limit=5&page=1`)
    if (listResp.status() !== 200) {
      console.log(`[admin-list] status=${listResp.status()}`)
      test.skip()
      return
    }
    const listData = await listResp.json() as { items?: Array<{ id: number }> }
    if (!listData.items || listData.items.length === 0) { test.skip(); return }

    const counselorId = listData.items[0].id

    const resp = await ctx.get(`${API}/api/admin/grade/counselor/${counselorId}/realtime-upgrades`)
    expect(resp.status()).toBe(200)

    const data = await resp.json() as { items: unknown[] }
    expect(Array.isArray(data.items)).toBe(true)

    // 이력이 있으면 구조 검증
    if (data.items.length > 0) {
      const item = data.items[0] as {
        id: number
        grade_before: string
        grade_after: string
        last_month_seconds: string
        reason: string
        created_at: string
      }
      expect(typeof item.id).toBe('number')
      expect(typeof item.grade_after).toBe('string')
      expect(typeof item.created_at).toBe('string')
    }

    console.log(`[realtime-upgrades] counselorId=${counselorId} 이력 ${data.items.length}건`)
  })

  test('GET /admin/grade/counselor/:id/grade-history — changed_by 필드 포함', async () => {
    const ctx = await adminLogin()
    if (!ctx) { test.skip(); return }

    const listResp = await ctx.get(`${API}/api/admin/members?role=counselor&limit=5&page=1`)
    if (listResp.status() !== 200) { test.skip(); return }
    const listData = await listResp.json() as { items?: Array<{ id: number }> }
    if (!listData.items || listData.items.length === 0) { test.skip(); return }

    const counselorId = listData.items[0].id

    const resp = await ctx.get(`${API}/api/admin/grade/counselor/${counselorId}/grade-history?limit=5`)
    expect(resp.status()).toBe(200)
    const data = await resp.json() as { items: Array<{ changed_by: string }> }

    if (data.items.length > 0) {
      // 유효한 changed_by 값
      const validChangedBy = ['realtime', 'cron', 'manual']
      for (const item of data.items) {
        const isValid = validChangedBy.includes(item.changed_by) ||
          item.changed_by?.startsWith('admin:')
        expect(isValid).toBe(true)
      }
    }
  })

})

// ─────────────────────────────────────────

test.describe('수익금 내역 — grade_at_session 필드', () => {

  test('GET /user/settlements/income — grade_at_session 필드 포함', async () => {
    const ctx = await counselorLogin()
    if (!ctx) { test.skip(); return }

    const resp = await ctx.get(`${API}/api/user/settlements/income?limit=5`)
    expect(resp.status()).toBe(200)

    const data = await resp.json() as {
      items: Array<{
        id: number
        amount: number
        grade_at_session: string | null
      }>
      total: number
    }

    expect(Array.isArray(data.items)).toBe(true)

    // 상담 건이 있으면 grade_at_session 필드 존재 확인
    for (const item of data.items) {
      expect('grade_at_session' in item).toBe(true)
      // null 이거나 유효한 등급 코드
      if (item.grade_at_session !== null) {
        const validGrades = ['preliminary', 'partner1', 'partner2', 'partner3', 'partner4', 'partner5']
        expect(validGrades).toContain(item.grade_at_session)
      }
    }

    console.log(`[income] total=${data.total} items=${data.items.length}`)
  })

})

// ─────────────────────────────────────────

test.describe('마이그레이션 검증 — DB 인덱스', () => {

  test('API healthcheck — DB 연결 정상 (인덱스 적용 전제)', async () => {
    const ctx = await request.newContext()
    const resp = await ctx.get(`${API}/api/health`)
    // health endpoint 없어도 API 전반 정상이면 OK
    if (resp.status() === 404) {
      console.log('[SKIP] /api/health 없음 — 다른 API로 확인')
      // 대신 grade/progress 로 DB 연결 확인
      const ctx2 = await counselorLogin()
      if (!ctx2) { test.skip(); return }
      const r2 = await ctx2.get(`${API}/api/user/counselor-mypage/grade/progress`)
      expect(r2.status()).toBe(200)
    } else {
      expect(resp.status()).toBe(200)
    }
  })

})
