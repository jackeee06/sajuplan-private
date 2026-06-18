import { test, expect, devices } from '@playwright/test'

const GALAXY = devices['Galaxy S9+']

/**
 * 후기 작성 — consultation_id 없이(상담사 상세 진입) 제출 시 서버 자동해석 동작 검증.
 *
 *  구버그: consultation_id 없으면 즉시 "상담 내역이 있어야…" 거부 → 폼 다 채우고 막힘.
 *  수정후: counselor_id 로 후기가능 상담을 자동 탐색 → 있으면 연결·성공 / 없으면 명확한 새 안내.
 *
 *  이 테스트는 prod 오염(실제 후기/알림톡) 방지를 위해 "후기 가능 상담이 없는" 케이스만 친다.
 *  → 자동해석이 실행되어 새 메시지가 나오면, 신코드가 라이브임이 증명된다(구코드면 옛 메시지).
 */
test('consultation_id 없이 제출 — 자동해석 후 새 안내 메시지(신코드 라이브)', async ({ browser }) => {
  // e2e_dual = 후기가능 상담 0건. counselor_id 만 보내면 자동해석 → 0건 → 새 메시지.
  const ctx = await browser.newContext({ ...GALAXY, storageState: 'user_dual_storage.json' })
  const page = await ctx.newPage()
  await page.goto('https://sajuplan.com/mypage', { waitUntil: 'domcontentloaded' })

  const res = await page.evaluate(async () => {
    const r = await fetch('https://api.sajuplan.com/api/user/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        counselor_id: 123, // 박기수 — e2e_dual 은 이 상담사와 후기가능 상담이 없음
        title: '[E2E] 자동해석 음성테스트',
        content: '[E2E] consultation_id 없이 제출 — 후기가능 상담 없음 경로',
        // consultation_id 의도적으로 누락
      }),
    })
    return { status: r.status, body: await r.json().catch(() => null) }
  })
  console.log('[응답]', JSON.stringify(res))

  // 400 + 새 메시지(자동해석이 돌아 0건 → 새 안내). 구코드라면 "상담 내역이 있어야…" 가 나옴.
  expect(res.status).toBe(400)
  const msg: string = res.body?.message ?? ''
  expect(msg).toContain('후기를 작성할 수 있는 상담 내역이 없습니다')
  // 구버그 메시지가 아니어야 함(자동해석 경로를 탔다는 증거)
  expect(msg).not.toBe('상담 내역이 있어야 후기를 작성할 수 있습니다.')

  await ctx.close()
})
