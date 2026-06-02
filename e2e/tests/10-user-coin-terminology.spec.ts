import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

/**
 * [2026-05-25] 코인/수익금 용어 통일 정책 자동 검증.
 *
 * 정책 (CLAUDE.md 참고):
 *   - 사용자(소비자) 영역에는 "포인트", "P 단위" 단어 노출 금지 → "코인" 으로 통일
 *   - 상담사 영역에는 "수익금" 단어 사용 (이 spec 은 비로그인 공개 페이지만 검증)
 *
 * 검증 방식:
 *   - 비로그인 공개 페이지를 차례로 방문하여 body 텍스트 스캔
 *   - "포인트", "P단위", "소비포인트" 단어가 노출되어 있으면 FAIL
 *   - 단, 외부 라이브러리/API 응답에 우연히 섞일 가능성 차단을 위해 사용자 가시 텍스트만 검사
 *
 * 회귀 방지:
 *   - 디자인/번역 작업 중 옛 단어가 다시 등장하면 즉시 fail.
 *   - 한 번 사장님 신고가 들어왔던 영역.
 */

const PUBLIC_PAGES = [
  { path: '/', name: '홈' },
  { path: '/counselors', name: '상담사 리스트' },
  { path: '/login', name: '로그인' },
  { path: '/signup', name: '회원가입' },
  { path: '/find', name: '아이디·비번 찾기' },
]

// 사용자 영역 금지 단어 — 정책 위반
const FORBIDDEN_WORDS_USER = [
  '소비포인트',
  '충전 포인트',
  '충전포인트',
  '보유 포인트',
  '보유포인트',
  '포인트 충전',
  '포인트충전',
  '잔여 포인트',
  '잔여포인트',
  // "포인트" 단일어는 사용처가 너무 광범위해 (예: "기준점" 등) FP 위험 — 더 구체적 phrase 로 제한
]

test.describe('코인/수익금 용어 통일 정책 (비로그인 공개 페이지)', () => {
  for (const { path, name } of PUBLIC_PAGES) {
    test(`${name} (${path}) — 옛 "포인트" 단어 노출 0`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('domcontentloaded')
      // 비동기 마운트/렌더 대기
      await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})

      const body = (await page.locator('body').textContent()) ?? ''

      const hits: string[] = []
      for (const word of FORBIDDEN_WORDS_USER) {
        if (body.includes(word)) hits.push(word)
      }

      expect(
        hits,
        `${name}: 금지 단어 발견 → ${hits.join(', ')} (사용자 영역은 "코인" 으로 통일)`,
      ).toEqual([])
    })
  }

  test('상담사 리스트 — 카드/필터에 "P" 단위 표기 없음', async ({ page }) => {
    await page.goto('/counselors')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    // 카드 내부의 금액 표기에서 "P" 단위 검색 — "1,000P" 같은 패턴
    const body = (await page.locator('body').textContent()) ?? ''
    const pUnitPattern = /\d{1,3}(,\d{3})*\s*P\b/
    const match = body.match(pUnitPattern)

    expect(
      match,
      `금액에 "P" 단위 사용됨 (예: "${match?.[0]}"). "코인" 으로 변경 필요`,
    ).toBeNull()
  })
})
