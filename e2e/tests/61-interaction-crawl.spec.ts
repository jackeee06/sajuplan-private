import { test, expect, type Page } from '@playwright/test'

/**
 * [2026-06-11] 실사용자 손가락 동작 재현 — 인터랙션 크롤 (375px).
 *
 * 페이지 "열기"만 하는 축1 스캔이 못 잡는 **클릭으로 작동하는 기능의 soft 실패**를 찾는다.
 *   (예: 약관 모달이 bare /api 로 200-HTML 받아 "불러오기 실패" 뜨던 버그 — 클릭해야 드러남)
 *
 * 각 페이지에서 안전한(읽기성) 클릭 후보를 실제로 탭하고, 매 클릭마다:
 *   - pageerror / 5xx 발생 0
 *   - 에러 텍스트("불러오기 실패","오류가 발생","문제가 발생","로딩 실패","Unexpected token" 등) 노출 0
 *   - 열린 다이얼로그는 본문이 비어있지 않아야(약관/팝업 류)
 *
 * ⚠️ 운영 데이터 오염·돈 발생 방지: 변형/결제/신청/로그아웃/소셜이동/상담시작 버튼은 SKIP.
 */

const MOBILE = { width: 375, height: 812 }

// 누르면 안 되는(변형/이동/돈/소셜) 텍스트 — 부분일치 SKIP
const SKIP_TEXT =
  /로그아웃|회원탈퇴|탈퇴|삭제|차단|신청하기|신청 완료|동의하고|가입하기|회원가입 완료|충전하기|결제|정산|송금|출금|상담\s*시작|채팅하기|채팅 상담|전화 상담|전화하기|통화|카카오|네이버|구글|애플|단골|찜하기|좋아요|저장하기|등록하기|전송|보내기|제출|확인했|수정하기|로그인하기/

// [2026-06-12] `다시 시도` 제거 — "💬 인증번호는 카카오톡으로 발송됩니다. 잠시 후 다시 시도해 주세요."
//   같은 정상 안내문구를 에러로 오탐하던 false positive. 진짜 에러는 "오류가 발생|실패" 등으로 충분히 잡힘.
const ERROR_TEXT =
  /불러오기 실패|로딩 실패|오류가 발생|문제가 발생|실패했습니다|Unexpected token|Something went wrong|undefined is not|TypeError|네트워크 오류|일시적인 오류/

type Hit = { page: string; idx: number; label: string; kind: string; detail: string }

async function crawl(page: Page, path: string, hits: Hit[]) {
  const pageErrors: string[] = []
  const http5: string[] = []
  page.on('pageerror', (e) => pageErrors.push(e.message))
  page.on('response', (r) => { if (r.status() >= 500) http5.push(`${r.status()} ${r.url()}`) })

  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)

  // 클릭 후보 수집: 버튼/링크/role=button/탭/“보기” 등
  const candidates = page.locator(
    'button, a[href], [role="button"], [role="tab"], [aria-label*="보기"], [class*="tab"]'
  )
  const total = Math.min(await candidates.count(), 40)

  for (let i = 0; i < total; i++) {
    const el = candidates.nth(i)
    let label = ''
    try {
      if (!(await el.isVisible())) continue
      label = ((await el.getAttribute('aria-label')) || (await el.innerText()).trim() || '').slice(0, 24)
    } catch { continue }
    if (!label) continue
    if (SKIP_TEXT.test(label)) continue

    const before = pageErrors.length
    const before5 = http5.length
    try {
      await el.click({ timeout: 2500, trial: false })
    } catch { continue }
    await page.waitForTimeout(450)

    // 1) 에러 텍스트 노출?
    const errLoc = page.getByText(ERROR_TEXT)
    if (await errLoc.first().isVisible().catch(() => false)) {
      const txt = (await errLoc.first().innerText().catch(() => '')).slice(0, 60)
      hits.push({ page: path, idx: i, label, kind: 'ERROR_TEXT', detail: txt })
    }
    // 2) pageerror / 5xx?
    if (pageErrors.length > before) hits.push({ page: path, idx: i, label, kind: 'PAGEERROR', detail: pageErrors[pageErrors.length - 1].slice(0, 80) })
    if (http5.length > before5) hits.push({ page: path, idx: i, label, kind: '5xx', detail: http5[http5.length - 1] })

    // 3) 다이얼로그 열렸으면 본문 비었는지 확인 후 닫기
    const dialog = page.getByRole('dialog')
    if (await dialog.first().isVisible().catch(() => false)) {
      const body = (await dialog.first().innerText().catch(() => '')).replace(/\s/g, '')
      if (body.length < 8) hits.push({ page: path, idx: i, label, kind: 'EMPTY_DIALOG', detail: `len=${body.length}` })
      await page.keyboard.press('Escape').catch(() => {})
      await page.waitForTimeout(250)
      // Escape 안 먹으면 닫기 버튼
      if (await dialog.first().isVisible().catch(() => false)) {
        await page.getByRole('button', { name: /닫기|확인|취소|close/i }).first().click({ timeout: 1000 }).catch(() => {})
        await page.waitForTimeout(200)
      }
    }
    // 페이지 이탈(네비게이션) 시 원복
    if (!page.url().includes(path.split('?')[0]) && path !== '/') {
      await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => {})
      await page.waitForTimeout(1000)
    }
  }
  console.log(`[crawl ${path}] 후보=${total} 히트=${hits.filter((h) => h.page === path).length} pageErr=${pageErrors.length} 5xx=${http5.length}`)
}

function assertNoHits(hits: Hit[], path: string) {
  const mine = hits.filter((h) => h.page === path)
  if (mine.length) {
    console.log(`  ⛔ ${path} 인터랙션 실패:`)
    mine.forEach((h) => console.log(`     [${h.kind}] "${h.label}" (#${h.idx}) → ${h.detail}`))
  }
  expect(mine, `${path} 클릭 인터랙션 soft 실패`).toEqual([])
}

const PUBLIC = ['/', '/counselors', '/reviews', '/search', '/login', '/signup', '/mypage/notices', '/mypage/events', '/mypage/help']

test.describe('인터랙션 크롤 — 공개 (비로그인, 375px)', () => {
  test.use({ viewport: MOBILE, storageState: { cookies: [], origins: [] } })
  for (const p of PUBLIC) {
    test(`공개 클릭 ${p}`, async ({ page }) => { const hits: Hit[] = []; await crawl(page, p, hits); assertNoHits(hits, p) })
  }
  test('공개 상담사 상세 클릭', async ({ page }) => {
    await page.goto('/counselors', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1800)
    const href = await page.locator('a[href^="/counselors/"]').first().getAttribute('href').catch(() => null)
    if (!href) { test.skip(true, '상담사 링크 없음'); return }
    const hits: Hit[] = []; await crawl(page, href, hits); assertNoHits(hits, href)
  })
})

const MEMBER = ['/mypage', '/mypage/member', '/mypage/coupons', '/mypage/points', '/favorites', '/notifications']
test.describe('인터랙션 크롤 — 회원 (로그인, 375px)', () => {
  test.use({ viewport: MOBILE, storageState: 'user_member_storage.json' })
  for (const p of MEMBER) {
    test(`회원 클릭 ${p}`, async ({ page }) => { const hits: Hit[] = []; await crawl(page, p, hits); assertNoHits(hits, p) })
  }
})

const COUNSELOR = ['/counselor/mypage', '/counselor/mypage/settlement/history', '/counselor/mypage/payout', '/counselor/mypage/referral', '/counselor/mypage/grade' ]
test.describe('인터랙션 크롤 — 상담사 (로그인, 375px)', () => {
  test.use({ viewport: MOBILE, storageState: 'user_counselor_storage.json' })
  for (const p of COUNSELOR) {
    test(`상담사 클릭 ${p}`, async ({ page }) => { const hits: Hit[] = []; await crawl(page, p, hits); assertNoHits(hits, p) })
  }
})
