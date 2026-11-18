import { test, expect, type Page } from '@playwright/test'

/**
 * [2026-06-25] 라우트 코드분할(데이터 라우터 + React.lazy) 영구 회귀 가드.
 *
 * 배경: 전 페이지를 동적 import 로 코드분할(초기 JS 1.5MB→331KB)했다. 과거 이 작업이
 *   prod 크래시(`useAuth must be used inside <AuthProvider>` + `removeChild`)를 냈는데,
 *   진짜 원인은 react-router 가 아니라 `vite.config.ts cacheBustPlugin` 이 index.html 의
 *   .js(엔트리/modulepreload) 에 `?v=v3` 를 붙인 것이었다. lazy 청크는 서로를
 *   `./index-xxx.js`(쿼리 없음) 로 import → 브라우저가 `...js?v=v3` 와 `...js` 를 다른
 *   모듈로 취급 → 공유 청크(auth-context) 2번 로드 → React Context 인스턴스 둘 → null.
 *   수정 = .js URL 엔 ?v 를 붙이지 않음(콘텐츠 해시 파일명이 캐시버스팅 담당).
 *
 * 이 spec 은 두 층위로 회귀를 막는다:
 *   1) 근본 원인 가드 — prod index.html 의 assets/*.js 에 ?v 쿼리가 다시 붙으면 즉시 fail.
 *   2) 증상 가드 — 대표 라우트(공개/목록/파라미터상세/마이/상담사마이/리다이렉트/캐치올)
 *      진입 시 Context 중복 크래시 시그니처가 없고 #root 가 실제로 렌더되는지.
 *   (크래시는 모든 lazy 라우트에 균일하게 나므로 대표 표본으로 충분. 전수 90라우트
 *    + 로그인세션 스모크는 e2e/_codesplit_smoke.mjs 하니스 참고.)
 */

const MOBILE = { width: 375, height: 812 }

// Context 인스턴스 중복(코드분할 회귀) 의 결정적 시그니처. 하나라도 뜨면 회귀.
const STRUCT_CRASH = [
  'must be used inside',          // useAuth/useLike/useConsult 등 context=null
  'removeChild',                  // 두 reconciler 가 같은 DOM 다툼
  'is not a child',
]

// 코드분할 표면을 고루 덮는 대표 라우트(로그아웃 기준 — 구조 크래시는 인증상태 무관).
const ROUTES = [
  '/',                                  // index (lazy)
  '/counselors',                        // 목록
  '/counselors/91',                     // 파라미터 상세
  '/search',                            // 단독 페이지
  '/favorites',                         // 인증 가드 페이지
  '/mypage',                            // 회원 마이 진입
  '/counselor/mypage',                  // 상담사 마이 진입
  '/counselors/91/reviews',             // 리다이렉트(?tab=) → 상세
  '/mypage/settlement/history',         // 리다이렉트 → /counselor/mypage/...
  '/mypage/notices',                    // 공개 콘텐츠
  '/this-route-does-not-exist',         // 캐치올 '*' → / 로 Navigate
]

// 로그인 불필요(공개 사이트). 기본 admin storageState 대신 로그아웃으로 — 구조 크래시는
// 인증 상태와 무관하며 로그아웃이 가장 단순·재현성 높음.
test.use({ viewport: MOBILE, storageState: { cookies: [], origins: [] } })

test('근본원인 가드: index.html 의 .js 에 ?v 쿼리가 없다 (있으면 청크 중복→Context 크래시)', async ({ page }) => {
  const res = await page.goto('/', { waitUntil: 'domcontentloaded' })
  expect(res?.ok(), 'index.html 로드 실패').toBeTruthy()
  const html = await page.content()
  // <script src="/assets/xxx.js?v=..."> / modulepreload href 에 ?v 가 붙으면 회귀.
  const offenders = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)(\?[^"]*)?"/g)]
    .filter((m) => m[2]) // 쿼리스트링이 있으면 위반
    .map((m) => m[1] + m[2])
  expect(offenders, `\n.js 에 쿼리(?v 등)가 붙음 = 코드분할 청크 중복 위험. cacheBustPlugin 확인:\n${offenders.join('\n')}`).toEqual([])
})

for (const route of ROUTES) {
  test(`라우트 마운트 무크래시: ${route}`, async ({ page }) => {
    const crashes: string[] = []
    const collect = (t: string) => {
      if (STRUCT_CRASH.some((s) => t.includes(s))) crashes.push(t.split('\n')[0])
    }
    page.on('pageerror', (e) => collect(String(e.message || e)))
    page.on('console', (m) => { if (m.type() === 'error') collect(m.text()) })

    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500) // lazy 청크 로드 + 마운트 + 첫 데이터 시도 여유

    // 1) Context 중복 크래시 시그니처 0
    expect(crashes, `구조적 크래시(코드분할 회귀):\n${crashes.join('\n')}`).toEqual([])

    // 2) #root 가 부트 스켈레톤만 남기지 않고 실제 콘텐츠로 교체됐는지
    const bootOnly = await page.evaluate(() => {
      const root = document.getElementById('root')
      const html = (root?.innerHTML || '').replace(/\s/g, '')
      return html.includes('class="sjm-boot"') && html.length < 800
    })
    expect(bootOnly, '#root 가 부트 스켈레톤만 렌더(React 마운트 실패)').toBeFalsy()
  })
}
