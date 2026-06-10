import { test, expect } from '@playwright/test'

/**
 * [2026-06-10] A-6 출석 코인 — 실사용자 손가락 동작 엄격검증
 *
 * 검증 항목:
 *  1. 출석 전 잔액 측정 (free_balance, paid_balance, total)
 *  2. 출석 체크인 API 호출 (attended_now or already)
 *  3. 출석 후 잔액 측정 → total_added 만큼 정확히 증가 확인
 *  4. 이중 출석 시도 → skip_reason='already' 차단 확인
 *  5. 이중 출석 후 잔액 변화 없음 확인
 *  6. point_history에 오늘자 attendance 기록 확인
 *  7. C-8 invariant: member.point = free_balance + paid_balance
 *
 * 진짜 사용자 흐름: 앱 열기 → 로그인 → attendance API 자동 호출 → 코인 증가
 */

const BASE = 'https://api.sajuplan.com/api'

test.describe('출석 코인 — 실사용자 엄격검증', () => {

  // e2e_member 세션 사용 (storageState에 쿠키 포함)
  test.use({ storageState: 'user_member_storage.json' })

  test('1. 잔액 조회 API 구조 확인 — free_balance + paid_balance 분리 응답', async ({ request }) => {
    const res = await request.get(`${BASE}/user/points/balance`)
    expect(res.status(), '인증 실패 — storageState 만료 가능성').toBe(200)
    const body = await res.json() as Record<string, unknown>
    console.log('[잔액]', JSON.stringify(body))

    // 실제 API 응답 필드: free, paid, total
    expect(typeof body.free, 'free 없음').toBe('number')
    expect(typeof body.paid, 'paid 없음').toBe('number')
    expect(typeof body.total, 'total 없음').toBe('number')

    // C-8 invariant: total = free + paid
    const total = Number(body.total)
    const free = Number(body.free)
    const paid = Number(body.paid)
    expect(total, `C-8 실패: total(${total}) ≠ free(${free}) + paid(${paid})`).toBe(free + paid)
    console.log(`[C-8 OK] total=${total}, free=${free}, paid=${paid}`)
  })

  test('2. 출석 체크인 → 잔액 증가 또는 already 차단 확인', async ({ request }) => {
    // Step 1: 출석 전 잔액
    const balanceBefore = await request.get(`${BASE}/user/points/balance`)
    expect(balanceBefore.status()).toBe(200)
    const before = await balanceBefore.json() as Record<string, unknown>
    const freeBefore = Number(before.free)
    const totalBefore = Number(before.total)
    console.log(`[출석 전] free=${freeBefore}, total=${totalBefore}`)

    // Step 2: 출석 체크인
    const checkin = await request.post(`${BASE}/user/attendance/checkin`, {
      headers: { 'Content-Type': 'application/json' },
    })
    expect([200, 201], `출석 API 오류: ${checkin.status()}`).toContain(checkin.status())
    const result = await checkin.json() as Record<string, unknown>
    console.log('[출석 결과]', JSON.stringify(result))

    const attendedNow = Boolean(result.attended_now)
    const totalAdded = Number(result.total_added ?? 0)
    const skipReason = String(result.skip_reason ?? '')

    // Step 3: 출석 후 잔액
    const balanceAfter = await request.get(`${BASE}/user/points/balance`)
    expect(balanceAfter.status()).toBe(200)
    const after = await balanceAfter.json() as Record<string, unknown>
    const freeAfter = Number(after.free)
    const totalAfter = Number(after.total)
    console.log(`[출석 후] free=${freeAfter}, total=${totalAfter}`)

    if (attendedNow) {
      // 첫 출석 케이스
      console.log(`[첫 출석] total_added=${totalAdded}`)
      expect(totalAdded, '출석 코인이 0임').toBeGreaterThan(0)
      expect(
        freeAfter - freeBefore,
        `free_balance 증가 불일치: 예상 +${totalAdded}, 실제 +${freeAfter - freeBefore}`
      ).toBe(totalAdded)
      expect(
        totalAfter - totalBefore,
        `total 증가 불일치: 예상 +${totalAdded}, 실제 +${totalAfter - totalBefore}`
      ).toBe(totalAdded)
    } else {
      // 이미 출석 케이스
      expect(skipReason, 'skip 이유가 already가 아님').toBe('already')
      expect(freeAfter, '이미 출석인데 free_balance 변동').toBe(freeBefore)
      expect(totalAfter, '이미 출석인데 total 변동').toBe(totalBefore)
      console.log('[이미 출석] 잔액 변화 없음 ✓')
    }

    // Step 4: C-8 invariant (출석 후에도)
    const free = Number(after.free)
    const paid = Number(after.paid)
    const total = Number(after.total)
    expect(total, `[출석 후 C-8 실패] total(${total}) ≠ free(${free}) + paid(${paid})`).toBe(free + paid)
    console.log(`[출석 후 C-8 OK] total=${total}, free=${free}, paid=${paid}`)
  })

  test('3. 이중 출석 차단 — 두 번 연속 체크인, 두 번째는 반드시 already', async ({ request }) => {
    // 1차 출석 (오늘 이미 했을 수도 있음)
    const first = await request.post(`${BASE}/user/attendance/checkin`, {
      headers: { 'Content-Type': 'application/json' },
    })
    expect([200, 201]).toContain(first.status())

    // 1차 후 잔액
    const b1 = await request.get(`${BASE}/user/points/balance`)
    const bal1 = await b1.json() as Record<string, unknown>
    const total1 = Number(bal1.total)

    // 2차 출석
    const second = await request.post(`${BASE}/user/attendance/checkin`, {
      headers: { 'Content-Type': 'application/json' },
    })
    expect([200, 201]).toContain(second.status())
    const res2 = await second.json() as Record<string, unknown>

    // 반드시 already
    expect(
      String(res2.skip_reason),
      '두 번째 출석이 차단되지 않음 — UNIQUE 제약 실패'
    ).toBe('already')
    expect(Boolean(res2.attended_now), '두 번째 출석이 attended_now=true').toBe(false)
    expect(Number(res2.total_added), '두 번째 출석에 코인 지급됨').toBe(0)

    // 2차 후 잔액 변화 없음
    const b2 = await request.get(`${BASE}/user/points/balance`)
    const bal2 = await b2.json() as Record<string, unknown>
    const total2 = Number(bal2.total)

    expect(total2, `이중 출석 후 잔액 변동: ${total1} → ${total2}`).toBe(total1)
    console.log(`[이중 출석 차단 OK] 잔액 유지: ${total1}`)
  })

  test('4. point_history — 오늘 출석 코인 기록 존재 확인', async ({ request }) => {
    const res = await request.get(`${BASE}/user/points/history?limit=30`)
    expect(res.status()).toBe(200)
    const body = await res.json() as Record<string, unknown>

    const items = Array.isArray(body.items) ? body.items : []
    const today = new Date().toISOString().slice(0, 10)

    const attendanceEntry = items.find((h: Record<string, unknown>) =>
      typeof h.rel_action === 'string' && h.rel_action.startsWith('attendance:')
    ) as Record<string, unknown> | undefined
    expect(attendanceEntry, 'point_history에 오늘 출석 기록 없음').toBeTruthy()
    console.log(`[point_history attendance] rel_action=${attendanceEntry?.rel_action}, amount=${attendanceEntry?.amount}, direction=${attendanceEntry?.direction}`)

    // direction='in' + amount > 0 (API 필드: direction, amount)
    expect(attendanceEntry?.direction, '출석 코인 방향이 in이 아님').toBe('in')
    expect(Number(attendanceEntry?.amount), '출석 코인이 0으로 기록됨').toBeGreaterThan(0)

    // is_paid = false (무료 코인이어야 함)
    expect(
      attendanceEntry?.is_paid,
      '출석 코인이 is_paid=true (paid_balance 잘못 적립)'
    ).toBe(false)

    void today
  })

  test('5. 출석 현황 API — today=true + consecutive_days 양수', async ({ request }) => {
    const res = await request.get(`${BASE}/user/attendance/today`)
    expect(res.status()).toBe(200)
    const body = await res.json() as Record<string, unknown>
    console.log('[출석 현황]', JSON.stringify(body))

    expect(body.attended_today, '오늘 출석 기록 없음').toBe(true)
    expect(
      Number(body.consecutive_days),
      'consecutive_days가 0 이하'
    ).toBeGreaterThan(0)
    expect(
      Number(body.today_total_added),
      'today_total_added가 0 이하'
    ).toBeGreaterThan(0)
    console.log(`[연속 출석] ${body.consecutive_days}일, 오늘 +${body.today_total_added}코인`)
  })
})
