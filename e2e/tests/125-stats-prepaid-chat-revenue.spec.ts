import { test, expect } from '@playwright/test'

/**
 * 💰 운영 KPI — 선결제 채팅 매출 집계 (admin API)
 *
 * 버그: 운영 KPI/매출순위가 consultation.amt 기반이라 선결제 채팅(amt=0)이 매출 0으로 누락.
 *   라온선생(123)의 2026-07-06 30분 선결제 채팅(고객 90,000 차감)이 순위에서 0원으로 찍힘.
 * 수정: point_history(rel_table='chat_room') 실차감을 상담사(chat_room.counselor_id)에 귀속.
 *
 * 검증(과거 데이터 = 불변): 2026-07-06 라온선생 매출 = 90,000, opsKpi 총매출 = 100,500.
 */

const API = 'https://api.sajuplan.com/api'
const FR = '2026-07-06'
const TO = '2026-07-06'

test('S-1 상담사 매출순위 — 선결제 채팅(라온선생) 90,000원 집계', async ({ page }) => {
  const res = await page.request.get(`${API}/admin/stats/counselor-ranking?fr_date=${FR}&to_date=${TO}&limit=10`)
  if (res.status() === 401) test.skip(true, 'admin 인증 없음 — skip')
  expect(res.ok()).toBeTruthy()
  const rows = await res.json() as Array<{ counselor_id: number; nickname: string; revenue: string }>
  const raon = rows.find((r) => r.counselor_id === 123 || r.nickname === '라온선생')
  expect(raon, '라온선생 행이 순위에 있어야 함').toBeTruthy()
  // 선결제 90,000 이 매출로 잡혀야 함 (기존엔 0이었음)
  expect(Number(raon!.revenue)).toBe(90000)
})

test('S-2 opsKpi 총매출 — 선결제 gross 포함(10,500 + 90,000 = 100,500)', async ({ page }) => {
  const res = await page.request.get(`${API}/admin/stats/ops-kpi?fr_date=${FR}&to_date=${TO}`)
  if (res.status() === 401) test.skip(true, 'admin 인증 없음 — skip')
  expect(res.ok()).toBeTruthy()
  const kpi = await res.json() as { total_revenue: number; chat_count: number }
  expect(kpi.total_revenue).toBe(100500)
})

// 대시보드도 동일 버그(선결제 채팅 매출 누락) 보강 — 배포된 쿼리가 라이브에서 오류 없이 도는지 스모크
test('S-3 대시보드 매출 집계 엔드포인트 — 선결제 보강 쿼리 무오류 200', async ({ page }) => {
  for (const ep of ['sales-trend?days=14', 'top-counselors', 'top-customers', 'insights']) {
    const res = await page.request.get(`${API}/admin/dashboard/${ep}`)
    if (res.status() === 401) test.skip(true, 'admin 인증 없음 — skip')
    expect(res.ok(), `${ep} 200 이어야 함`).toBeTruthy()
    await res.json() // JSON 파싱 성공 = SQL 런타임 오류 없음
  }
})
