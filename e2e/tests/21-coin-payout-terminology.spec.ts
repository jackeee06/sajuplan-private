import { test, expect } from '@playwright/test'

/**
 * [2026-05-28] 회원/상담사 용어 분리 정책 회귀 방지.
 *
 * 정책 (CLAUDE.md):
 *   - 사용자(소비자) 영역: '코인' 으로 통일
 *   - 상담사 영역: '수익금' 으로 통일
 *   - 두 영역은 완전 분리. 단어 섞이면 회계 사고 + 사용자 혼란.
 *
 * 검증:
 *  1) 빌드 산출물에 '수익금' 단어 존재 (상담사 페이지 라벨 유지)
 *  2) 빌드 산출물에 '획득코인'/'정산코인' 같은 위반 라벨 0건 (이전 사고 패턴)
 *  3) 충전 페이지의 '사용내역' 탭 존재 (방금 추가)
 *
 * 실패 의미:
 *  - 1: 상담사 영역 라벨이 변경됨 → 정책 위반 가능성
 *  - 2: 옛 옛 라벨 잔존 → 상담사에게 "코인" 노출 사고 재발
 *  - 3: 사용내역 탭 사라짐 → 사용자 UX 손실
 */

const WEB_BASE: Record<string, string> = {
  test: 'https://sajumoon.kr',
  prod: 'https://sajuplan.com',
}
const TARGET = process.env.TARGET ?? 'test'
const WEB = WEB_BASE[TARGET] ?? WEB_BASE.test

test.describe(`회원/상담사 용어 분리 정책 회귀 방지 (${TARGET})`, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${WEB}/`, { waitUntil: 'networkidle' })
  })

  async function getAllScripts(page: import('@playwright/test').Page): Promise<string> {
    return await page.evaluate(async () => {
      const scripts = Array.from(document.querySelectorAll('script[src]'))
        .map((s) => (s as HTMLScriptElement).src)
        .filter((src) => src.includes('/assets/'))
      const bodies = await Promise.all(
        scripts.map((src) =>
          fetch(src).then((r) => (r.ok ? r.text() : '')).catch(() => ''),
        ),
      )
      return bodies.join('\n')
    })
  }

  test('1) 상담사 영역 라벨 — "수익금 내역" / "실시간 정산" 존재', async ({ page }) => {
    const src = await getAllScripts(page)
    expect(src, '상담사 수익금 페이지 라벨 사라짐').toContain('수익금 내역')
    expect(src, '실시간 정산 탭 라벨 사라짐').toContain('실시간 정산')
  })

  test('2) 위반 라벨 0건 — "획득코인", "정산코인", "코인 정산" 잔존 X', async ({ page }) => {
    const src = await getAllScripts(page)
    expect(src, '상담사 영역에 "획득코인" 잔존 — 정책 위반 재발').not.toContain('획득코인')
    expect(src, '상담사 영역에 "정산코인" 잔존 — 정책 위반 재발').not.toContain('정산코인')
    // "코인 정산" 패턴도 잔존 시 위반 (월 코인 정산 같은 헤더)
    expect(src, '상담사 영역에 "코인 정산" 잔존 — 정책 위반 재발').not.toMatch(/월 코인 정산|코인 정산/)
  })

  test('3) 충전 페이지 "사용내역" 탭 존재 (방금 추가)', async ({ page }) => {
    const src = await getAllScripts(page)
    expect(src, '사용내역 탭 라벨 사라짐 — Charge.tsx 회귀').toContain('사용내역')
  })

  test('4) 원천징수 안내 텍스트 존재 (상담사 보호)', async ({ page }) => {
    const src = await getAllScripts(page)
    expect(src, '원천징수 안내 사라짐 — 상담사 신뢰 보호 회귀').toMatch(/원천징수.*3\.3%/)
  })

  test('5) 실수령 예상 라벨 존재 (수익금 페이지 핵심 정보)', async ({ page }) => {
    const src = await getAllScripts(page)
    expect(src, '실수령 예상 표시 사라짐 — 상담사 신뢰 보호 회귀').toContain('실수령 예상')
  })

  test('6) "결제금액" 단어 존재 (상담사 영역 "사용 코인" 라벨 변경 검증)', async ({ page }) => {
    const src = await getAllScripts(page)
    expect(src, '상담사 영역 결제금액 라벨 회귀').toContain('결제금액')
  })
})
