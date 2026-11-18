import { test, expect, request } from '@playwright/test'

/**
 * 🔮 라이브 타로보드 — 고객(member) 상태배너 + API/도메인 스모크
 *
 * 검증 포인트:
 *   T-1. 고객 상단 상태배너가 단계마다 바뀐다: 대기(lobby) → 셔플 → 내 차례(픽, 핑크 강조)
 *        손님이 "지금 기다릴지 / 카드를 고를지" 한눈에 알게 한 UX 개선 회귀 방지.
 *   T-2. 라이브 동기화: 상담사가 보낸 이벤트가 고객 화면에 그대로 반영(서버 권위 중계).
 *   T-3. API/도메인: tarot-api health, tarotroom noindex, 마케팅 사이트 200.
 *
 * 고객은 페이지(브라우저)로 입장하고, 상담사는 같은 방에 WebSocket으로 접속해 단계를 진행한다.
 */

const ROOM = 'https://tarotroom.sajuplan.com'
const MKT = 'https://tarot.sajuplan.com'

async function createRoom(session: string): Promise<string> {
  const ctx = await request.newContext()
  const r = await ctx.post(`${ROOM}/api/tarot/rooms`, { data: { session } })
  expect(r.status()).toBe(200)
  const { code } = (await r.json()) as { code: string }
  await ctx.dispose()
  return code
}

test.describe('타로 라이브 보드 — 고객 상태배너 (T-1·T-2)', () => {
  test('단계별 상단 배너: 대기 → 셔플 → 내 차례(3장)', async ({ page }) => {
    const session = `e2e-banner-${Date.now()}`
    const code = await createRoom(session)

    // 고객으로 입장 (같은 session → 같은 방 자동 페어링)
    await page.goto(`${ROOM}/?role=member&session=${session}&cName=${encodeURIComponent('라온선생')}`, {
      waitUntil: 'domcontentloaded',
    })

    // lobby: 대기 히어로 — "잠시만 기다려 주세요"(헤드라인) + 사유(sub)
    await expect(page.getByText('잠시만 기다려 주세요')).toBeVisible({ timeout: 20000 })
    await expect(page.getByText('상담사가 배열을 고르고 있어요')).toBeVisible()

    // 상담사 역할로 같은 방에 WS 접속 → 배열 선택 + 셔플
    await page.evaluate(async (roomCode) => {
      const base = location.origin.replace(/^http/, 'ws')
      const ws = new WebSocket(`${base}/ws?code=${roomCode}&role=counselor`)
      await new Promise<void>((res, rej) => {
        ws.addEventListener('open', () => res())
        ws.addEventListener('error', () => rej(new Error('ws error')))
      })
      ;(window as unknown as { __cws: WebSocket }).__cws = ws
      ws.send(JSON.stringify({ t: 'spread.set', key: 'three' }))
      ws.send(JSON.stringify({ t: 'shuffle', seed: 'e2e-seed-banner' }))
    }, code)

    // shuffle: 여전히 대기지만 사유(sub)가 바뀐다
    await expect(page.getByText('질문을 떠올리며')).toBeVisible({ timeout: 12000 })

    // 상담사가 카드를 펼침 → 고객 차례(active, 핑크 풀배경 히어로)
    await page.evaluate(() => {
      ;(window as unknown as { __cws: WebSocket }).__cws.send(JSON.stringify({ t: 'spread.lay' }))
    })

    // 내 차례 히어로 — "카드를 골라 주세요" + 장수 표기
    const active = page.getByText('카드를 골라 주세요')
    await expect(active).toBeVisible({ timeout: 12000 })
    await expect(page.getByText('원하는 카드 3장 · 0/3 선택')).toBeVisible()
    // 저압식 통일: 내 차례 = 연핑크(accent-50) 한 줄 배너 — 컨테이너 클래스 확인
    const banner = active.locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]')
    await expect(banner).toHaveClass(/bg-accent-50/)

    console.log('[OK] 고객 배너 전이: 대기(lobby) → 셔플(사유변경) → 내 차례(3장·연핑크) 확인')
  })

  test('상담사 "다음 리딩" = 실수 방지 확인 모달 (취소는 보존, 확인만 리셋)', async ({ page }) => {
    const session = `e2e-reset-${Date.now()}`
    const code = await createRoom(session)

    // 상담사로 입장 → 같은 방에 member WS로 done 단계까지 구동
    await page.goto(`${ROOM}/?role=counselor&session=${session}&mName=t`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('배열을 선택하고 카드를 섞어 주세요')).toBeVisible({ timeout: 20000 })
    await page.evaluate(async (roomCode) => {
      const base = location.origin.replace(/^http/, 'ws')
      const ws = new WebSocket(`${base}/ws?code=${roomCode}&role=member`)
      await new Promise<void>((res, rej) => {
        ws.addEventListener('open', () => res())
        ws.addEventListener('error', () => rej(new Error('ws error')))
      })
      const s = (o: unknown) => ws.send(JSON.stringify(o))
      s({ t: 'spread.set', key: 'three' }); s({ t: 'shuffle', seed: 'reset-e2e' }); s({ t: 'spread.lay' })
      s({ t: 'card.pick', deckPos: 0 }); s({ t: 'card.pick', deckPos: 1 }); s({ t: 'card.pick', deckPos: 2 })
      await new Promise((r) => setTimeout(r, 300)); s({ t: 'card.revealAll' })
    }, code)

    // done — "다음 리딩" 버튼 노출
    const nextBtn = page.getByRole('button', { name: /다음 리딩/ })
    await expect(nextBtn).toBeVisible({ timeout: 10000 })

    // 클릭 → 즉시 리셋되지 않고 확인 모달이 뜬다
    await nextBtn.click()
    await expect(page.getByText('정말 새로 뽑을까요?')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('모두 사라지고')).toBeVisible()

    // 취소 → 모달 닫히고 리딩 보존(여전히 done, "다음 리딩" 그대로)
    await page.getByRole('button', { name: '취소' }).click()
    await expect(page.getByText('정말 새로 뽑을까요?')).toBeHidden()
    await expect(nextBtn).toBeVisible()
    await expect(page.getByText('전화로 해설해 주세요')).toBeVisible()

    // 다시 클릭 → "네, 새로 뽑기" → 초기(배열 선택) 화면으로 리셋
    await nextBtn.click()
    await expect(page.getByText('정말 새로 뽑을까요?')).toBeVisible()
    await page.getByRole('button', { name: '네, 새로 뽑기' }).click()
    await expect(page.getByText('배열을 선택하고 카드를 섞어 주세요')).toBeVisible({ timeout: 8000 })

    console.log('[OK] 다음 리딩 확인 모달: 취소=보존, 확인=리셋 동작 확인')
  })
})

test.describe('타로 API/도메인 스모크 (T-3)', () => {
  test('tarot-api health · tarotroom noindex · 마케팅 200', async () => {
    const ctx = await request.newContext()

    const h = await ctx.get(`${ROOM}/api/tarot/health`)
    expect(h.status()).toBe(200)
    expect((await h.json() as { ok: boolean }).ok).toBe(true)

    // 라이브 상담 도메인은 검색 비노출(noindex)
    const room = await ctx.get(`${ROOM}/`)
    expect(room.status()).toBe(200)
    expect(String(room.headers()['x-robots-tag'] ?? '')).toContain('noindex')

    // 마케팅(솔로) 도메인은 공개
    const mkt = await ctx.get(`${MKT}/`)
    expect(mkt.status()).toBe(200)

    await ctx.dispose()
    console.log('[OK] health=ok · tarotroom noindex · 마케팅 200')
  })

  test('세션 자동 페어링: 같은 session → 같은 방코드', async () => {
    const ctx = await request.newContext()
    const session = `e2e-pair-${Date.now()}`
    const a = await ctx.post(`${ROOM}/api/tarot/rooms`, { data: { session } })
    const b = await ctx.post(`${ROOM}/api/tarot/rooms`, { data: { session } })
    const ca = (await a.json() as { code: string }).code
    const cb = (await b.json() as { code: string }).code
    expect(ca).toBe(cb)
    expect(ca).toMatch(/^\d{4}$/)
    await ctx.dispose()
    console.log(`[OK] 세션 자동 페어링: ${ca} === ${cb}`)
  })
})
