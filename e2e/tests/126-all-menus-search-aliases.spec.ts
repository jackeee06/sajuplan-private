import { test, expect } from '@playwright/test'

/**
 * 전체메뉴 검색 별칭 대량 보강 검증 (2026-07-10).
 *   4개 Agent 전수분석 → 51개 항목 aliases 보강. 이전엔 검색해도 안 나오던
 *   화면 단어·기능 용어·동의어가 이제 해당 메뉴로 매칭되는지 확인.
 */

test.use({ storageState: 'storageState.json' })

const CASES = [
  { word: '청구서', expect: '고객보호비용' },       // short-call-refunds
  { word: 'dtmfno', expect: '상담사 리스트' },       // members/counselors
  { word: '정산완료알리기', expect: '정산 이력' },   // settlements
  { word: '셋팅', expect: '기본환경설정' },          // settings
  { word: '룸ID', expect: '채팅내역' },             // chat-history
  { word: '엠투넷', expect: '상담사 리스트' },        // counselors
  { word: '이탈위험', expect: '대시보드' },           // dashboard
  { word: 'FCM카탈로그', expect: '푸시 가이드' },     // push-guide
  // ── 아래는 수동 aliases 에 없고 오직 페이지 화면 코드에만 있는 단어 → 화면 텍스트 자동 인덱스로 검색돼야 함
  { word: '현황판', expect: '정산 이력' },            // settlements 화면 텍스트 "정산 현황판"
  { word: '청구서대조', expect: '고객보호비용' },      // short-call-refunds 화면
  // ── 아래는 화면에 전혀 없는 "동의어"(사람이 다르게 부르는 표현) → AI 동의어 사전으로 검색돼야 함
  { word: '점쟁이', expect: '상담사 리스트' },        // counselors 동의어
  { word: '월급', expect: '정산 이력' },              // settlements 동의어
  { word: '어드민', expect: '관리자 계정' },          // admin-users 동의어
  { word: '위키', expect: '운영 바이블' },            // handbook 동의어 (profit-simulator는 superOnly라 검증 제외)
  { word: '수수료율', expect: '등급 관리' },          // grade 동의어
  // ── 엠투넷 콘솔 대조 항목 (2026-07-10) — 사장님 직접접속 불필요, Claude 자율대조
  { word: '통화상세', expect: '엠투넷 콘솔 대조' },   // m2net-console aliases
  { word: '과금대조', expect: '엠투넷 콘솔 대조' },   // m2net-console aliases
]

test('전체메뉴 검색 — 보강된 별칭이 해당 메뉴로 노출', async ({ page }) => {
  await page.goto('/mng/all-menus', { waitUntil: 'domcontentloaded' })
  test.skip(page.url().includes('/login'), 'admin 세션 없음 (global-setup 전)')

  const box = page.getByPlaceholder(/단가|통계|정산률|환불/).first()
  await expect(box).toBeVisible()

  for (const c of CASES) {
    await box.fill('')
    await box.fill(c.word)
    await page.waitForTimeout(300)
    await expect(
      page.getByText(c.expect).first(),
      `'${c.word}' 검색 → '${c.expect}' 노출 기대`,
    ).toBeVisible({ timeout: 5000 })
  }
})
