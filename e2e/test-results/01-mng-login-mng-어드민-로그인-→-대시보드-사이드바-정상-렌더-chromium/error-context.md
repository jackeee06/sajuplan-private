# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 01-mng-login.spec.ts >> mng 어드민 >> 로그인 → 대시보드/사이드바 정상 렌더
- Location: tests\01-mng-login.spec.ts:52:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('link', { name: '대시보드' })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByRole('link', { name: '대시보드' })

```

```yaml
- img "사주문"
- heading "사주문 Admin" [level=2]
- paragraph: 관리자 전용 페이지입니다. 인가된 사용자만 접근할 수 있습니다.
- heading "사주문 관리자 로그인" [level=1]
- paragraph: 관리자 아이디와 비밀번호를 입력해주세요.
- text: 아이디 *
- textbox "admin"
- text: 비밀번호 *
- textbox "비밀번호를 입력하세요"
- button:
  - img
- button "로그인"
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test'
  2   | 
  3   | /**
  4   |  * mng 어드민 — 로그인 + 핵심 페이지 비파괴 검증.
  5   |  *
  6   |  * prod 운영 데이터에 영향 안 주는 시나리오만:
  7   |  *   1. 로그인 성공 → 대시보드 도달
  8   |  *   2. /settings 진입 → 운영알림 탭 클릭 → 안내 박스 + 수신자 목록 보임
  9   |  *   3. 추가 버튼 클릭 → 빈 행 생성 (저장 안 함 — 새로고침하면 사라짐)
  10  |  *
  11  |  * 비번:
  12  |  *   admin / test1234! (prod 확인됨)
  13  |  */
  14  | 
  15  | const ADMIN_ID = 'admin'
  16  | const ADMIN_PW = 'test1234!'
  17  | 
  18  | /** 401/404 같은 인증 흐름 중 예상 가능한 HTTP 에러는 무시 */
  19  | function isIgnorableConsoleError(text: string): boolean {
  20  |   return /Failed to load resource.*status of (401|404)/.test(text)
  21  | }
  22  | 
  23  | function attachErrorCollectors(page: import('@playwright/test').Page, errors: string[]) {
  24  |   page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  25  |   page.on('console', (msg) => {
  26  |     if (msg.type() === 'error' && !isIgnorableConsoleError(msg.text())) {
  27  |       errors.push(`console.error: ${msg.text()}`)
  28  |     }
  29  |   })
  30  | }
  31  | 
  32  | async function login(page: import('@playwright/test').Page) {
  33  |   // storageState 로 이미 로그인되어 있으면 /mng/login 진입 시 자동 redirect.
  34  |   // 그래서 dashboard 로 바로 가는 게 안전.
  35  |   await page.goto('/mng/dashboard')
  36  | 
  37  |   // env placeholder 치환 검증
  38  |   const config = await page.evaluate(() => (window as any).__SAJUMOON_CONFIG)
  39  |   expect(config, '__SAJUMOON_CONFIG 미등록').toBeTruthy()
  40  |   expect(config.env, '__SAJUMOON_ENV__ 치환 누락').not.toBe('__SAJUMOON_ENV__')
  41  | 
  42  |   // 만약 인증 안 되어 /mng/login 으로 튕겼다면 — form 채우기
  43  |   if (page.url().includes('/mng/login')) {
  44  |     await page.getByPlaceholder('admin').fill(ADMIN_ID)
  45  |     await page.getByPlaceholder('비밀번호를 입력하세요').fill(ADMIN_PW)
  46  |     await page.getByRole('button', { name: '로그인' }).click()
  47  |     await expect(page).not.toHaveURL(/\/mng\/login/, { timeout: 10_000 })
  48  |   }
  49  | }
  50  | 
  51  | test.describe('mng 어드민', () => {
  52  |   test('로그인 → 대시보드/사이드바 정상 렌더', async ({ page }) => {
  53  |     const consoleErrors: string[] = []
  54  |     attachErrorCollectors(page, consoleErrors)
  55  | 
  56  |     await login(page)
  57  | 
  58  |     // 사이드바 — 주요 메뉴 (사이드바 안의 link/button role 명시)
> 59  |     await expect(page.getByRole('link', { name: '대시보드' })).toBeVisible()
      |                                                            ^ Error: expect(locator).toBeVisible() failed
  60  |     await expect(page.getByRole('button', { name: /회원현황/ })).toBeVisible()
  61  |     await expect(page.getByRole('button', { name: /환경설정/ })).toBeVisible()
  62  | 
  63  |     expect(consoleErrors, `JS 에러: ${consoleErrors.join(' / ')}`).toHaveLength(0)
  64  |   })
  65  | 
  66  |   test('운영알림 탭 — 안내 박스 + 수신자 목록 + 추가 버튼', async ({ page }) => {
  67  |     const consoleErrors: string[] = []
  68  |     attachErrorCollectors(page, consoleErrors)
  69  | 
  70  |     await login(page)
  71  |     await page.goto('/mng/settings')
  72  | 
  73  |     // "운영알림" 탭 클릭
  74  |     await page.getByRole('button', { name: '운영알림' }).click()
  75  | 
  76  |     // 안내 박스 — 핵심 단어들 보이는지
  77  |     await expect(page.getByRole('heading', { name: /운영자 알림이란/ })).toBeVisible()
  78  |     await expect(page.getByText(/자동으로 도는 5가지 작업/)).toBeVisible()
  79  |     await expect(page.getByText('상담사 등급 자동 재계산')).toBeVisible()
  80  | 
  81  |     // 수신자 목록 카드
  82  |     await expect(page.getByText('수신자 목록')).toBeVisible()
  83  | 
  84  |     // + 추가 버튼 존재
  85  |     const addBtn = page.getByRole('button', { name: /\+ 추가/ })
  86  |     await expect(addBtn).toBeVisible()
  87  | 
  88  |     // 추가 클릭 → 행 1개 늘어남
  89  |     const phoneInputs = page.locator('input[placeholder*="01012345678"]')
  90  |     const before = await phoneInputs.count()
  91  |     await addBtn.click()
  92  |     await page.waitForTimeout(300)
  93  |     const after = await phoneInputs.count()
  94  |     expect(after, '추가 버튼 클릭해도 행 안 늘어남').toBeGreaterThan(before)
  95  | 
  96  |     // 페이지 새로고침 — 저장 안 했으므로 추가한 빈 행은 사라져야 함
  97  |     await page.reload()
  98  |     await page.getByRole('button', { name: '운영알림' }).click()
  99  |     await page.waitForTimeout(500)
  100 |     const afterReload = await page.locator('input[placeholder*="01012345678"]').count()
  101 |     expect(afterReload, '저장 안 했는데 행이 남음 (이상)').toBe(before)
  102 | 
  103 |     expect(consoleErrors, `JS 에러: ${consoleErrors.join(' / ')}`).toHaveLength(0)
  104 |   })
  105 | 
  106 |   test('기본환경설정 페이지 — 글자가 너무 작지 않은지 (text-xs 거의 없음)', async ({ page }) => {
  107 |     await login(page)
  108 |     await page.goto('/mng/settings')
  109 |     await page.waitForLoadState('networkidle')
  110 | 
  111 |     // 안내 박스 안의 텍스트가 text-xs (12px 미만) 가 아닌지 — 가독성 검증
  112 |     // 운영알림 탭으로 이동 후 본문 폰트 크기 측정
  113 |     await page.getByRole('button', { name: '운영알림' }).click()
  114 |     await page.waitForTimeout(300)
  115 | 
  116 |     // 안내 박스 본문 폰트 크기
  117 |     const guideBoxText = page.getByText(/자동으로 도는 5개 작업/).first()
  118 |     const fontSize = await guideBoxText.evaluate((el) => {
  119 |       return parseFloat(getComputedStyle(el).fontSize)
  120 |     })
  121 |     expect(fontSize, `안내 박스 글자 너무 작음: ${fontSize}px`).toBeGreaterThanOrEqual(14)
  122 |   })
  123 | })
  124 | 
```