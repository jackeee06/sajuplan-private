import { test, expect, type Page } from '@playwright/test'

/**
 * [2026-06-11 정밀점검 · 축1] 3·4순위 무에러 전수 스캔 (모바일 375px).
 *
 * 상담사 마이페이지 전 탭(C-5) + 관리자 돈/회원 페이지(D-2~D-6) 진입하며 수집:
 *   - pageerror(JS 예외) / 5xx / 깨진 이미지 / 375px 가로 오버플로우 → 치명, 0이어야
 *   - console.error / 4xx → 진단 로그
 *
 * spec 53(2순위 회원) 과 동일 엔진. 상담사=user_counselor_storage, 관리자=storageState.
 */

const MOBILE = { width: 375, height: 812 }

const IGNORE_CONSOLE = [
  /favicon/i, /ResizeObserver loop/i, /\[vite\]/i,
  /kakao/i, /developers\.kakao/i, /naver/i, /sentry/i,
  /Download the React DevTools/i, /\.woff2?/i,
]
function expectedHttp(url: string, status: number): boolean {
  if (status === 401) return true
  if (status === 404 && /(favicon|\.map|sourcemap)/i.test(url)) return true
  return false
}

type Scan = {
  console: string[]; http4: string[]; http5: string[]; http401: string[]
  pageError: string[]; brokenImg: string[]; overflow: number
}

async function scan(page: Page, path: string): Promise<Scan> {
  const s: Scan = { console: [], http4: [], http5: [], http401: [], pageError: [], brokenImg: [], overflow: 0 }
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const t = m.text()
      if (!IGNORE_CONSOLE.some((r) => r.test(t))) s.console.push(t)
    }
  })
  page.on('pageerror', (e) => s.pageError.push(e.message))
  page.on('response', (r) => {
    const st = r.status()
    if (st === 401) s.http401.push(r.url())
    if (st >= 500) s.http5.push(`${st} ${r.url()}`)
    else if (st >= 400 && !expectedHttp(r.url(), st)) s.http4.push(`${st} ${r.url()}`)
  })
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  s.brokenImg = await page.evaluate(() =>
    Array.from(document.images)
      .filter((i) => i.complete && i.naturalWidth === 0)
      .map((i) => i.currentSrc || i.src),
  )
  s.overflow = await page.evaluate((w) => {
    const el = document.documentElement
    return el.scrollWidth > w + 1 ? el.scrollWidth : 0
  }, MOBILE.width)
  return s
}

function report(path: string, s: Scan) {
  console.log(
    `[scan ${path}] pageErr=${s.pageError.length} 5xx=${s.http5.length} 4xx=${s.http4.length} ` +
    `consoleErr=${s.console.length} brokenImg=${s.brokenImg.length} overflow=${s.overflow || '-'}`,
  )
  if (s.pageError.length) console.log('  ⛔ pageError:', s.pageError)
  if (s.http5.length) console.log('  ⛔ 5xx:', s.http5)
  if (s.brokenImg.length) console.log('  🖼 brokenImg:', s.brokenImg.slice(0, 8))
  if (s.overflow) console.log(`  ↔ overflow=${s.overflow}px (>${MOBILE.width})`)
  if (s.http4.length) console.log('  ⚠ 4xx:', [...new Set(s.http4)].slice(0, 10))
  if (s.console.length) console.log('  ⚠ consoleErr:', [...new Set(s.console)].slice(0, 10))
}

function assertCritical(s: Scan) {
  expect(s.pageError, 'uncaught JS 예외').toEqual([])
  expect(s.http5, '5xx 서버 에러').toEqual([])
  expect(s.brokenImg, '깨진 이미지').toEqual([])
  expect(s.overflow, '375px 가로 오버플로우').toBe(0)
}

const COUNSELOR_PAGES = [
  '/counselor/mypage',
  '/counselor/mypage/intro',
  '/counselor/mypage/style',
  '/counselor/mypage/bank',
  '/counselor/mypage/calls',
  '/counselor/mypage/chats',
  '/counselor/mypage/consult-stats',
  '/counselor/mypage/customer-qnas',
  '/counselor/mypage/incoming',
  '/counselor/mypage/memo',
  '/counselor/mypage/notices',
  '/counselor/mypage/payout',
  '/counselor/mypage/products',
  '/counselor/mypage/qnas',
  '/counselor/mypage/qnas/new',
  '/counselor/mypage/referral',
  '/counselor/mypage/reviews',
  '/counselor/mypage/settlement/history',
  '/counselor/mypage/tips',
]

const ADMIN_PAGES = [
  '/dashboard',
  '/members/customers',
  '/members/counselors',
  '/members/counselor-apply',
  '/points/history',
  '/payments',
  '/payouts',
  '/refunds',
  '/settlements',
  '/short-call-refunds',
  '/grade',
]

test.describe('축1 무에러스캔 — 상담사 마이페이지 전 탭 (로그인, 375px)', () => {
  test.use({ viewport: MOBILE, storageState: 'user_counselor_storage.json' })
  for (const p of COUNSELOR_PAGES) {
    test(`상담사 ${p}`, async ({ page }) => { const s = await scan(page, p); report(p, s); assertCritical(s) })
  }
})

test.describe('축1 무에러스캔 — 관리자 돈/회원 페이지 (admin, 375px)', () => {
  test.use({ viewport: MOBILE, storageState: 'storageState.json' })
  test.beforeEach(async ({ page }) => {
    // admin 세션 없으면(E2E_ADMIN_PW 미설정) skip
    await page.goto('/mng/dashboard', { waitUntil: 'domcontentloaded' }).catch(() => {})
    if (/\/mng\/login/.test(page.url())) test.skip(true, 'admin 세션 없음 — E2E_ADMIN_PW 확인')
  })
  for (const p of ADMIN_PAGES) {
    test(`관리자 /mng${p}`, async ({ page }) => { const s = await scan(page, `/mng${p}`); report(`/mng${p}`, s); assertCritical(s) })
  }
})
