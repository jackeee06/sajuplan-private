import { test, expect, request } from '@playwright/test'

/**
 * [Phase E2E] 강등 시 단가 자동 조정 — 실제 DB 설정 후 end-to-end 검증 (2026-06-08)
 *
 * 핵심 정책 (사장님 2026-06-08):
 *   매월 1일 grade-cron 강등 처리 시, 현재 단가가 새 등급 허용 범위를 벗어나면
 *   새 등급의 최상위 단가로 자동 조정 (묻지 않고).
 *   예) 파트너5(2,000원) → 파트너4 강등 → 1,500원으로 자동 조정
 *       파트너5(1,500원) → 파트너4 강등 → 변경 없음 (1,500 은 파트너4 범위 내)
 *
 * 검증 흐름:
 *   1. jackee 를 partner5 + 2,000원으로 설정 (어드민 강제 변경 API)
 *   2. grade-cron 실행 (jackee만, mb_id=jackee) — 현재 달 상담 0시간 → 강등
 *   3. jackee 단가가 1,500원(partner4 최상위)으로 변경됐는지 검증
 *   4. member_grade_history reason에 "단가 자동조정" 기록 확인
 *   5. 원복 (원래 등급·단가 복원)
 *
 * 추가 케이스:
 *   6. 범위 내 단가는 강등돼도 변경 없음
 *   7. dry-run (test=1) 응답에 unit_cost_after 예상값 포함
 */

const API = 'https://api.sajuplan.com'
const CRON_TOKEN = process.env.CRON_TOKEN ?? ''

async function adminCtx() {
  const ctx = await request.newContext({ storageState: 'storageState.json' })
  const check = await ctx.get(`${API}/api/admin/dashboard/summary`).catch(() => null)
  if (!check || (check.status() !== 200 && check.status() !== 201)) {
    const ctx2 = await request.newContext()
    await ctx2.post(`${API}/api/admin/auth/login`, {
      data: { mb_id: 'lee', password: 'kunwoo77' },
    })
    return ctx2
  }
  return ctx
}

/** jackee member_id = 91 */
const JACKEE_ID = 91

test.describe('강등 시 단가 자동 조정 (grade-cron)', () => {
  test.skip(!CRON_TOKEN, 'CRON_TOKEN 미설정')
  test.describe.configure({ mode: 'serial' })

  let ctx: Awaited<ReturnType<typeof adminCtx>>
  let originalGrade = 'preliminary'
  let originalUnitCost = 1000

  test.beforeAll(async () => {
    ctx = await adminCtx()
    // jackee 현재 상태 저장
    const r = await ctx.get(`${API}/api/admin/grade/counselor/${JACKEE_ID}`)
    if (r.status() === 200) {
      const body = await r.json().catch(() => null)
      originalGrade = body?.grade ?? 'preliminary'
      originalUnitCost = body?.call_070_unit_cost ?? 1000
      console.log(`[setup] jackee 원본 — grade:${originalGrade} unit_cost:${originalUnitCost}`)
    }
  })

  test.afterAll(async () => {
    // 원복 — 어떤 테스트가 실패해도 복원
    await ctx.patch(`${API}/api/admin/grade/counselor/${JACKEE_ID}/grade`, {
      data: { grade: originalGrade, reason: '[E2E cleanup] 강등 테스트 원복' },
    })
    await ctx.patch(`${API}/api/admin/grade/counselor/${JACKEE_ID}/unit-cost`, {
      data: { unit_cost: originalUnitCost, reason: '[E2E cleanup] 강등 테스트 원복' },
    })
    console.log(`[cleanup] jackee 원복: grade=${originalGrade} unit_cost=${originalUnitCost}`)
    await ctx.dispose()
  })

  // ─────────────────────────────────────────────────────────
  // 케이스 1: 범위 초과 단가 → 자동 조정 (핵심)
  // ─────────────────────────────────────────────────────────
  test('[핵심] 파트너5(2000원) → 파트너4 강등 시 단가 1500원으로 자동 조정', async () => {
    // 1) partner5 + 2000원 강제 설정 (partner5만 선택 가능한 단가)
    const setGrade = await ctx.patch(`${API}/api/admin/grade/counselor/${JACKEE_ID}/grade`, {
      data: { grade: 'partner5', reason: '[E2E] 강등 단가 자동조정 테스트 설정' },
    })
    expect(setGrade.status(), `grade 설정 실패: ${setGrade.status()}`).toBeLessThan(300)

    const setCost = await ctx.patch(`${API}/api/admin/grade/counselor/${JACKEE_ID}/unit-cost`, {
      data: { unit_cost: 2000, reason: '[E2E] 강등 단가 자동조정 테스트 설정' },
    })
    expect(setCost.status(), `unit_cost 설정 실패: ${setCost.status()}`).toBeLessThan(300)
    console.log('[setup] jackee → partner5, 2000원 설정 완료')

    // 2) grade-cron 실행 (jackee만, 당월 상담 0h → partner5 유지기준 120h 미달 → partner4 강등)
    const cronR = await ctx.get(
      `${API}/api/cron/grade/recalculate?mb_id=jackee&reset_recalc=1`,
      { headers: { 'X-Cron-Token': CRON_TOKEN } },
    )
    expect(cronR.status()).toBe(200)
    const cronBody = await cronR.json()
    const result = cronBody.items?.find((r: { mb_id: string }) => r.mb_id === 'jackee')
    console.log('[cron] 결과:', JSON.stringify(result))

    // 3) 강등됐는지 확인
    expect(result?.change_type, '강등 미발생').toBe('demote')
    expect(result?.grade_after, '파트너4 강등 아님').toBe('partner4')

    // 4) 단가 자동 조정 응답값 확인
    expect(result?.unit_cost_before, 'unit_cost_before 누락').toBe(2000)
    expect(result?.unit_cost_after, '단가 자동조정 미실행').toBe(1500)
    console.log('[PASS] 단가 자동 조정:', result.unit_cost_before, '→', result.unit_cost_after)

    // 5) 실제 DB에서 단가가 1500원으로 변경됐는지 확인
    const afterR = await ctx.get(`${API}/api/admin/grade/counselor/${JACKEE_ID}`)
    expect(afterR.status()).toBe(200)
    const after = await afterR.json()
    expect(after.call_070_unit_cost, 'DB call_070_unit_cost 미변경').toBe(1500)
    expect(after.chat_unit_cost, 'DB chat_unit_cost 미변경').toBe(1500)
    console.log('[PASS] DB 단가 확인:', after.call_070_unit_cost, '원')

    // 6) grade_history에 "단가 자동조정" reason 기록 확인
    const histR = await ctx.get(`${API}/api/admin/grade/counselor/${JACKEE_ID}/grade-history?limit=5`)
    if (histR.status() === 200) {
      const hist = await histR.json()
      // grade-history는 배열을 직접 반환
      const entries = Array.isArray(hist) ? hist : (hist.history ?? hist.items ?? [])
      const lastEntry = entries[0]
      console.log('[이력] 최신:', JSON.stringify(lastEntry))
      // reason에 "단가 자동조정" 또는 unit_cost 관련 내용 포함 확인
      const reason = lastEntry?.reason ?? ''
      expect(reason, '이력 reason에 단가 자동조정 미기록').toContain('단가 자동조정')
      console.log('[PASS] 이력 reason:', reason)
    }
  })

  // ─────────────────────────────────────────────────────────
  // 케이스 2: 범위 내 단가 → 변경 없음
  // ─────────────────────────────────────────────────────────
  test('[회귀방지] 파트너5(1500원) → 파트너4 강등 시 단가 변경 없음', async () => {
    // partner5 + 1500원 설정 (1500은 partner4에서도 허용)
    await ctx.patch(`${API}/api/admin/grade/counselor/${JACKEE_ID}/grade`, {
      data: { grade: 'partner5', reason: '[E2E] 범위내 단가 테스트 설정' },
    })
    await ctx.patch(`${API}/api/admin/grade/counselor/${JACKEE_ID}/unit-cost`, {
      data: { unit_cost: 1500, reason: '[E2E] 범위내 단가 테스트 설정' },
    })
    console.log('[setup] jackee → partner5, 1500원 설정')

    const cronR = await ctx.get(
      `${API}/api/cron/grade/recalculate?mb_id=jackee&reset_recalc=1`,
      { headers: { 'X-Cron-Token': CRON_TOKEN } },
    )
    expect(cronR.status()).toBe(200)
    const result = (await cronR.json()).items?.find((r: { mb_id: string }) => r.mb_id === 'jackee')
    console.log('[cron] 결과:', JSON.stringify(result))

    expect(result?.change_type).toBe('demote')
    expect(result?.unit_cost_after, '범위 내 단가인데 조정 발생').toBeNull()
    console.log('[PASS] 1500원은 partner4 범위 내 → 단가 변경 없음')

    // DB도 1500원 그대로인지 확인
    const afterR = await ctx.get(`${API}/api/admin/grade/counselor/${JACKEE_ID}`)
    const after = await afterR.json()
    expect(after.call_070_unit_cost).toBe(1500)
  })

  // ─────────────────────────────────────────────────────────
  // 케이스 3: dry-run 응답에 unit_cost_after 필드 포함 여부
  // ─────────────────────────────────────────────────────────
  test('dry-run — unit_cost_after 예상값 응답 포함', async () => {
    // partner5 + 2000원으로 설정
    await ctx.patch(`${API}/api/admin/grade/counselor/${JACKEE_ID}/grade`, {
      data: { grade: 'partner5', reason: '[E2E] dry-run 테스트' },
    })
    await ctx.patch(`${API}/api/admin/grade/counselor/${JACKEE_ID}/unit-cost`, {
      data: { unit_cost: 2000, reason: '[E2E] dry-run 테스트' },
    })

    const dryRun = await ctx.get(
      `${API}/api/cron/grade/recalculate?mb_id=jackee&test=1`,
      { headers: { 'X-Cron-Token': CRON_TOKEN } },
    )
    expect(dryRun.status()).toBe(200)
    const result = (await dryRun.json()).items?.find((r: { mb_id: string }) => r.mb_id === 'jackee')
    console.log('[dry-run] 결과:', JSON.stringify(result))

    // dry-run 이므로 DB 변경 없지만 예상값은 반환해야 함
    expect(result?.change_type).toBe('demote')
    expect(result?.unit_cost_before).toBe(2000)
    expect(result?.unit_cost_after).toBe(1500)
    console.log('[PASS] dry-run 에서도 조정 예상값 확인:', result?.unit_cost_before, '→', result?.unit_cost_after)

    // dry-run이므로 DB는 변경 없어야 함
    const afterR = await ctx.get(`${API}/api/admin/grade/counselor/${JACKEE_ID}`)
    const after = await afterR.json()
    expect(after.call_070_unit_cost, 'dry-run 인데 DB 변경됨').toBe(2000)
    console.log('[PASS] dry-run — DB 단가 그대로 2000원 유지')
  })
})
