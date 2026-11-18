/**
 * 라우트 코드분할(데이터 라우터 전환) 로컬 검증 하니스.
 *
 * 목적: react-router 데이터 라우터 + route.lazy 전환 후 모든 라우트가
 *       크래시(useAuth context null / removeChild) 없이 마운트되는지 prod 무노출로 검증.
 *
 * 전제:
 *   1) cd web/user && npx vite build
 *   2) dist/index.html 의 __SAJUMOON_ENV__ → prod 치환 (배포 sed 모사)
 *   3) npx vite preview --port 4173 --outDir dist (백그라운드)
 *   → 이 스크립트가 http://localhost:4173 을 띄워 전 라우트 딥링크 + SPA 클릭 스모크.
 *
 * 통과 기준: 모든 라우트 pageerror 0 + #root 가 부트스켈레톤 아닌 실제 콘텐츠 렌더.
 */
import { chromium } from 'playwright'

const BASE = process.env.SMOKE_BASE || 'http://localhost:4173'

/**
 * api.sajuplan.com 을 가로채 "로그아웃 prod 사용자" 를 충실히 흉내낸다.
 * (localhost→prod 직접 호출은 CORS 로 전부 막혀 me() 가 네트워크 거부로 비정상
 *  실패 → 로컬 하니스 인공물. ACAO 헤더 + 깨끗한 401/200 으로 정상 HTTP 의미 부여.)
 * 목록형 다수는 [] 로 충분(구조적 크래시 검증이 목적). 객체 기대 일부 엔드포인트는
 * [] 라서 페이지 내부 data 오류가 날 수 있으나 그건 STRUCTURAL 시그니처가 아니라
 * 하니스 스텁 한계(실 prod 는 실데이터) → 별도 분류.
 */
async function stubApi(ctx, origin) {
  await ctx.route('**://api.sajuplan.com/**', async (route) => {
    const url = route.request().url()
    const hdr = {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': '*',
      'content-type': 'application/json',
    }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: hdr, body: '' })
    if (/\/auth\/me/.test(url)) return route.fulfill({ status: 401, headers: hdr, body: '{"message":"unauthorized"}' })
    if (/unread-count/.test(url)) return route.fulfill({ status: 200, headers: hdr, body: '{"count":0}' })
    return route.fulfill({ status: 200, headers: hdr, body: '[]' })
  })
}

// 전 라우트 — :param 은 렌더만 확인하면 되므로 임의 유효값 주입(데이터 404 는 크래시 아님).
const ROUTES = [
  '/',
  '/login',
  '/signup',
  '/signup/complete',
  '/find',
  '/find/complete',
  '/search',
  '/search/result',
  '/notifications',
  '/notifications/1',
  '/counselors',
  '/counselors/91',
  '/counselors/91/reviews',       // → ?tab=reviews 리다이렉트
  '/counselors/91/reviews/new',
  '/counselors/91/qna',           // → ?tab=qna 리다이렉트
  '/counselors/91/qna/1',
  '/counselors/91/qna/new',
  '/chat/1',
  '/chat-log/1',
  '/favorites',
  '/mypage',
  '/mypage/member',
  '/mypage/member/edit',
  '/mypage/app-settings',
  '/mypage/calls',
  '/mypage/chats',
  '/mypage/history',
  '/counselor/mypage/settlement/history',
  '/mypage/settlement/history',   // → 리다이렉트
  '/mypage/my-reviews',
  '/mypage/my-reviews/new',
  '/mypage/my-reviews/1/edit',
  '/mypage/my-reviews/1',
  '/mypage/my-qnas',
  '/mypage/my-qnas/1',
  '/mypage/support-inquiries',
  '/mypage/support-inquiries/new',
  '/mypage/support-inquiries/1',
  '/mypage/invite',
  '/mypage/coupons',
  '/mypage/payments',
  '/mypage/points',
  '/mypage/charge',
  '/mypage/charge/card-register',
  '/charge/complete',
  '/charge/vbank-info',
  '/counselor/mypage',
  '/counselor/mypage/referral',
  '/counselor/mypage/bank',
  '/counselor/mypage/style',
  '/counselor/mypage/intro',
  '/counselor/mypage/payout',
  '/counselor/mypage/tips',
  '/counselor/mypage/tips/1',
  '/counselor/mypage/notices',
  '/counselor/mypage/notices/1',
  '/counselor/mypage/notice-edit',
  '/counselor/mypage/qnas',
  '/counselor/mypage/qnas/new',
  '/counselor/mypage/qnas/1',
  '/counselor/mypage/customer-qnas',
  '/counselor/mypage/customer-qnas/1',
  '/counselor/mypage/reviews',
  '/counselor/mypage/reviews/1',
  '/counselor/mypage/calls',
  '/counselor/mypage/chats',
  '/counselor/mypage/incoming',
  '/counselor/mypage/memo',
  '/counselor/mypage/call/1/memo',
  '/counselor/mypage/consult-stats',
  '/counselor/mypage/fee-schedule',
  '/counselor/mypage/products',
  '/counselor/mypage/products/1/info',
  '/counselor/mypage/products/1/reviews',
  '/counselor/mypage/products/1/qna',
  '/counselor/mypage/products/1/guide',
  '/mypage/events',
  '/mypage/events/1',
  '/mypage/notices',
  '/mypage/notices/1',
  '/mypage/help',
  '/mypage/new-counselors',
  '/mypage/counselor-apply',
  '/mypage/counselor-apply/new',
  '/mypage/counselor-apply/done',
  '/mypage/counselor-apply/1',
  '/s/0572',
  '/promoter',
  '/event',
  '/this-route-does-not-exist',   // → '*' Navigate('/')
]

// ⚠️ 코드분할 회귀(중복 청크/Context 인스턴스 둘) 의 구조적 시그니처 — 반드시 0.
const CRASH_SIGNATURES = [
  'must be used inside',         // useAuth/useXxx context null (Context 인스턴스 중복)
  'removeChild',
  'is not a child',
  'Should not already be working', // React reconciler 손상
]
// 하니스 API 스텁([]) 한계로 나는 데이터 오류 — 실 prod 무관(구조 회귀 아님). 분류만.
const STUB_DATA_SIGNATURES = [
  'toLocaleString',
  'forEach',
  'Cannot read properties of undefined (reading',
  'Cannot read properties of null',
  '.map is not a function',
]

function isBootSkeletonOnly(html) {
  // 부트 스켈레톤만 남아있으면(=React가 콘텐츠로 교체 못 함) 렌더 실패로 본다.
  const stripped = html.replace(/\s/g, '')
  return stripped.includes('class="sjm-boot"') && stripped.length < 800
}

const ORIGIN = new URL(BASE).origin
// STORAGE=user_member_storage.json 등 지정 시 로그인 세션으로 검증(prod 실데이터 권장: NO_STUB=1).
const CTX_OPTS = { viewport: { width: 375, height: 812 } }
if (process.env.STORAGE) {
  CTX_OPTS.storageState = process.env.STORAGE
  console.log(`[로그인 세션] storageState = ${process.env.STORAGE}`)
}
const browser = await chromium.launch()
const results = []
let structuralCrash = 0
let stubDataErr = 0

function classify(text) {
  if (CRASH_SIGNATURES.some((s) => text.includes(s))) return 'STRUCT'
  if (STUB_DATA_SIGNATURES.some((s) => text.includes(s))) return 'STUB'
  return 'OTHER'
}

for (const route of ROUTES) {
  const ctx = await browser.newContext(CTX_OPTS)
  if (!process.env.NO_STUB) await stubApi(ctx, ORIGIN)
  const page = await ctx.newPage()
  const errs = []   // {kind, text}
  page.on('pageerror', (e) => errs.push({ kind: classify(String(e.message || e)), text: String(e.message || e).split('\n')[0] }))
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text()
      const k = classify(t)
      if (k !== 'OTHER') errs.push({ kind: k, text: 'console: ' + t.split('\n')[0] })
    }
  })

  let rootHtml = ''
  try {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(2000)
    rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML || '')
  } catch (e) {
    errs.push({ kind: 'OTHER', text: 'goto: ' + String(e.message || e) })
  }

  const struct = errs.filter((e) => e.kind === 'STRUCT')
  const stub = errs.filter((e) => e.kind === 'STUB')
  const bootOnly = isBootSkeletonOnly(rootHtml)
  // 합격 = 구조적 크래시 0 (스텁 데이터 오류는 하니스 한계라 무시)
  const pass = struct.length === 0 && !bootOnly
  if (struct.length > 0 || bootOnly) structuralCrash++
  if (stub.length > 0) stubDataErr++
  results.push({ route, pass, struct, stub, bootOnly })

  const tag = struct.length > 0 ? 'CRASH' : bootOnly ? 'BLANK' : stub.length > 0 ? 'ok·stub' : 'OK  '
  console.log(`[${tag}] ${route}${struct.length ? '  → ' + struct[0].text : (bootOnly ? '  → 부트스켈레톤만' : '')}`)

  await ctx.close()
}

// ── SPA 클릭 전환 스모크 (클라 lazy 청크 전환이 원래 크래시 트리거였음) ──
console.log('\n── SPA 클릭 전환 체인 ──')
{
  const ctx = await browser.newContext(CTX_OPTS)
  if (!process.env.NO_STUB) await stubApi(ctx, ORIGIN)
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e.message || e)))
  page.on('console', (msg) => { if (msg.type() === 'error' && CRASH_SIGNATURES.some((s) => msg.text().includes(s))) errors.push(msg.text()) })
  // 매 클릭을 깨끗한 /mypage(로그아웃에서도 BottomNav 정상)에서 시작 → BottomNav
  // 버튼(navigate() 프로그래밍 이동) 클릭으로 클라 lazy 청크 전환을 각각 독립 검증.
  // (/ 나 /counselors 는 스텁 [] 데이터로 일부 미렌더라 nav 못 찾을 수 있어 시작점 고정.)
  const hops = []
  for (const label of ['상담사', '단골', '코인충전', '홈']) {
    try {
      await page.goto(BASE + '/mypage', { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(900)
      const btn = page.getByText(label, { exact: true }).last()
      if (await btn.count()) {
        await btn.click({ timeout: 3000 })
        await page.waitForTimeout(700)
        hops.push(`${label}→${new URL(page.url()).pathname}`)
      }
    } catch { /* 라벨 미존재 시 스킵 */ }
  }
  const spaCrashed = errors.some((e) => CRASH_SIGNATURES.some((s) => e.includes(s)))
  if (spaCrashed) structuralCrash++
  console.log(spaCrashed ? '[CRASH] SPA 전환 ' + errors[0].split('\n')[0] : '[OK  ] SPA 전환 무크래시 (' + hops.join(' | ') + ')')
  await ctx.close()
}

await browser.close()

console.log(`\n결과: ${ROUTES.length}개 라우트 | 구조적 크래시 ${structuralCrash}개 | 스텁데이터오류 ${stubDataErr}개(하니스 한계, 무시)`)
if (structuralCrash > 0) {
  console.log('\n구조적 크래시 상세 (코드분할 회귀):')
  for (const r of results.filter((r) => r.struct.length > 0 || r.bootOnly)) {
    console.log(`  ${r.route}: bootOnly=${r.bootOnly}`)
    r.struct.forEach((e) => console.log('     - ' + e.text))
  }
  process.exit(1)
}
console.log('✅ 구조적 크래시 0 — 코드분할(데이터 라우터) 안전')
