import { test, expect, type Page } from '@playwright/test'

/**
 * [2026-06-11 운영 직전 정밀점검 · 축1] 2순위 핵심 사용자 흐름 — 무에러 전수 스캔 (모바일 375px).
 *
 * 각 페이지 진입 시 수집·검사:
 *   - pageerror (uncaught JS 예외)   → 치명, 0이어야
 *   - 5xx 서버 응답                   → 치명, 0이어야
 *   - 깨진 이미지 (naturalWidth=0)    → 0이어야
 *   - 375px 가로 오버플로우            → 0이어야 (모바일 잘림/가로스크롤)
 *   - console.error / 4xx             → 진단 로그로 전량 수집 (외부 노이즈 포함)
 *
 * 1차 목적 = 먼지 목록 일괄 수집. 치명 항목만 fail, 나머지는 로그로 본다.
 */

const MOBILE = { width: 375, height: 812 }

const IGNORE_CONSOLE = [
  /favicon/i, /ResizeObserver loop/i, /\[vite\]/i,
  /kakao/i, /developers\.kakao/i, /naver/i, /sentry/i,
  /Download the React DevTools/i, /\.woff2?/i,
]
function expectedHttp(url: string, status: number): boolean {
  if (status === 401) return true // 인증 가드 (정상)
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
  if (s.http401.length) console.log('  🔒 401:', [...new Set(s.http401)])
  if (s.http4.length) console.log('  ⚠ 4xx:', [...new Set(s.http4)].slice(0, 10))
  if (s.console.length) console.log('  ⚠ consoleErr:', [...new Set(s.console)].slice(0, 10))
}

function assertCritical(s: Scan) {
  expect(s.pageError, 'uncaught JS 예외').toEqual([])
  expect(s.http5, '5xx 서버 에러').toEqual([])
  expect(s.brokenImg, '깨진 이미지').toEqual([])
  expect(s.overflow, '375px 가로 오버플로우').toBe(0)
}

const PUBLIC_PAGES = [
  '/', '/login', '/signup', '/find', '/search',
  '/counselors', '/reviews', '/mypage/notices', '/mypage/events', '/mypage/help',
]
const MEMBER_PAGES = [
  '/mypage', '/mypage/member', '/mypage/member/edit',
  '/mypage/calls', '/mypage/chats', '/mypage/my-reviews', '/mypage/my-qnas',
  '/mypage/coupons', '/mypage/payments', '/mypage/points', '/mypage/charge',
  '/favorites', '/notifications', '/mypage/counselor-apply',
]

test.describe('축1 무에러스캔 — 공개 페이지 (비로그인, 375px)', () => {
  test.use({ viewport: MOBILE, storageState: { cookies: [], origins: [] } })
  for (const p of PUBLIC_PAGES) {
    test(`공개 ${p}`, async ({ page }) => { const s = await scan(page, p); report(p, s); assertCritical(s) })
  }
  test('공개 상담사 상세 (목록 첫 항목)', async ({ page }) => {
    await page.goto('/counselors', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    const href = await page.locator('a[href^="/counselors/"]').first().getAttribute('href').catch(() => null)
    if (!href) { console.log('[scan 상담사상세] 상담사 링크 없음 — skip'); test.skip(); return }
    const s = await scan(page, href); report(href, s); assertCritical(s)
  })
})

test.describe('축1 무에러스캔 — 회원 페이지 (로그인, 375px)', () => {
  test.use({ viewport: MOBILE, storageState: 'user_member_storage.json' })
  for (const p of MEMBER_PAGES) {
    test(`회원 ${p}`, async ({ page }) => { const s = await scan(page, p); report(p, s); assertCritical(s) })
  }
})
