import { test, expect, type Page } from '@playwright/test'

/**
 * 🌊 통합 운세 포털 — unse.sajuplan.com 스모크 (모바일 375px)
 *
 * 입력 패턴: 모든 생일-입력 화면은 공통 MyInfoBar(만세력식 접힘 카드)를 씀.
 *   프로필 한 번 입력 → 전 타일 자동. 테스트는 localStorage에 프로필을 시드하고 결과를 검증.
 * 신규 타일(2026-06-28): 별자리/신년/월간/토정비결/연예인궁합/혈액형궁합/꽃잎점/포춘쿠키.
 * 포털은 기존 만세·타로와 별개 도메인. 엔진만 재사용한 새 껍데기.
 */

const BASE = 'https://unse.sajuplan.com'
test.use({ viewport: { width: 375, height: 812 } })

// 공유 프로필 시드 — MyInfoBar가 읽는 localStorage 키. addInitScript = 모든 네비게이션 전 주입.
async function seedProfile(
  page: Page,
  prof: { birth: string; gender?: 'M' | 'F'; name?: string; time?: string } = { birth: '1990-06-15', gender: 'F', name: '홍길동', time: '07:20' },
) {
  await page.addInitScript((p) => {
    localStorage.setItem('unse_profile_v1', JSON.stringify(p))
  }, prof)
}

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  expect(overflow).toBe(false)
}

test('P-1 홈 — 타일 21개 + 무에러 + 가로 오버플로 0', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  await expect(page.locator('[data-testid=topic-tile]')).toHaveCount(21)
  await expect(page.getByRole('button', { name: '공유하기' })).toBeVisible() // 헤더 공유 버튼(상시)
  await expect(page.getByText('🔮 오늘의 한 줄')).toBeVisible() // 데일리 카드(이모지로 타일 부제와 구분)
  await expect(page.getByText('일째 방문', { exact: false })).toBeVisible() // 방문 스트릭
  await noOverflow(page)
  expect(errors).toEqual([])
})

test('P-2 로또 운명번호 — 프로필 자동 → 6개 공 + 풀이 + 결정론', async ({ page }) => {
  await seedProfile(page, { birth: '1990-03-15', gender: 'M' })
  await page.goto(`${BASE}/#/lotto`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  await expect(page.locator('.ball-pop')).toHaveCount(6)
  await expect(page.getByText('의 수').first()).toBeVisible()
  const first = await page.locator('.ball-pop').allInnerTexts()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  expect(await page.locator('.ball-pop').allInnerTexts()).toEqual(first) // 결정론
})

test('P-3 오늘의 운세 — 종합 점수 + 분야별(만세 엔진 결합)', async ({ page }) => {
  await seedProfile(page, { birth: '1990-03-15', gender: 'M' })
  await page.goto(`${BASE}/#/today`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  await expect(page.getByText('종합운')).toBeVisible()
  await expect(page.getByText('애정운')).toBeVisible()
  await expect(page.getByText('재물운')).toBeVisible()
  await expect(page.getByText('오늘의 일진')).toBeVisible()
})

test('P-4 띠별 — 프로필 자동 → 띠 운세', async ({ page }) => {
  await seedProfile(page) // 1990 = 말띠
  await page.goto(`${BASE}/#/zodiac`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  await expect(page.getByText('종합운')).toBeVisible()
  await expect(page.getByText('오늘의 행운 요소')).toBeVisible()
})

test('P-5 꿈해몽 v3 — 긴 기사(상황별 다수·분야별·심리·조언) + 멀티워드/유사어 검색', async ({ page }) => {
  await page.goto(`${BASE}/#/dream`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  await expect(page).toHaveTitle(/꿈해몽/) // 페이지별 문서 제목
  await expect(page.locator('section.grid button')).toHaveCount(100)
  // 돼지꿈 디럭스 결과(상황별 다수 그룹·분야별·심리·조언)
  await page.getByText('돼지꿈').first().click()
  await page.waitForTimeout(500)
  await expect(page.locator('.ball-pop')).toHaveCount(6)
  await expect(page.getByText('색깔·종류별')).toBeVisible()
  await expect(page.getByText('내 행동별')).toBeVisible()
  await expect(page.getByText('분야별 영향')).toBeVisible()
  await expect(page.getByText('심리 해석', { exact: false })).toBeVisible()
  await expect(page.getByText('함께 보면 좋은 꿈')).toBeVisible()
  // 멀티워드 검색 — '돼지 도망' → 돼지꿈 1순위(상황 라벨 매칭)
  await page.fill('input[type=text]', '돼지 도망')
  await page.waitForTimeout(300)
  await expect(page.locator('section.grid button').first()).toContainText('돼지꿈')
  // 유사어 검색 — '구렁이' → 뱀꿈
  await page.fill('input[type=text]', '구렁이')
  await page.waitForTimeout(300)
  await expect(page.locator('section.grid button').first()).toContainText('뱀꿈')
})

test('P-6 궁합 v3 — 읽을거리·재미(캐릭터·서사·십성·인연코드·연애스타일·속궁합·전생) + 결정론', async ({ page }) => {
  await seedProfile(page, { birth: '1990-03-15' })
  await page.goto(`${BASE}/#/couple`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(300)
  // 서브페이지 헤더 로고 → 사주플랜 사이트 링크
  await expect(page.locator('header a[href="https://sajuplan.com"]')).toBeVisible()
  // 없는 날짜(6월 86일)는 막힘 — "궁합 보기" 비활성
  await page.locator('input[inputmode="numeric"]').fill('19960686')
  await page.waitForTimeout(200)
  await expect(page.getByRole('button', { name: '궁합 보기' })).toBeDisabled()
  await page.locator('input[inputmode="numeric"]').fill('1992-07-20') // 정상 입력
  await page.getByText('궁합 보기').click()
  await page.waitForTimeout(500)
  const scoreA = await page.getByTestId('couple-score').innerText()
  expect(Number(scoreA)).toBeGreaterThan(0)
  // 겉/속궁합
  await expect(page.getByText('겉궁합 (띠)')).toBeVisible()
  await expect(page.getByText('속궁합 (일주)')).toBeVisible()
  // v3 읽을거리·재미 섹션
  await expect(page.getByText('우리 궁합 유형')).toBeVisible()
  await expect(page.getByText('두 사람 이야기')).toBeVisible()
  await expect(page.getByText('서로에게 어떤 사람', { exact: false })).toBeVisible()
  await expect(page.getByText('두 사람을 잇는 인연 코드')).toBeVisible()
  await expect(page.getByText('두 사람의 연애 스타일')).toBeVisible()
  await expect(page.getByText('🗝️ 마음을 여는 법')).toBeVisible()
  await expect(page.getByText('속궁합 케미')).toBeVisible()
  await expect(page.getByText('위기와 극복법')).toBeVisible()
  await expect(page.getByText('전생의 인연')).toBeVisible()
  await expect(page.getByText('오행 상보 — 부족함을 채워줘요')).toBeVisible()
  await expect(page.getByText('분야별 궁합')).toBeVisible()
  await expect(page.getByText('두 사람의 행운 숫자')).toBeVisible()
  // 같은 상대 다시 → 같은 점수(결정론)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(300)
  await page.locator('input[inputmode="numeric"]').fill('1992-07-20')
  await page.getByText('궁합 보기').click()
  await page.waitForTimeout(500)
  expect(await page.getByTestId('couple-score').innerText()).toBe(scoreA)
})

test('P-6b 궁합 공유 딥링크 — #/couple?p=생일 → 상대 자동 채움+결과', async ({ page }) => {
  await seedProfile(page, { birth: '1990-03-15' })
  await page.goto(`${BASE}/#/couple?p=1992-07-20`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(700)
  await expect(page.getByTestId('couple-score')).toBeVisible()
  await expect(page.getByText('우리 궁합 유형')).toBeVisible()
})

test('P-7 면책 노출 + 기존 사이트 무영향', async ({ page, request }) => {
  await seedProfile(page)
  await page.goto(`${BASE}/#/lotto`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('당첨을 보장하지 않습니다', { exact: false })).toBeVisible()
  for (const u of ['https://manse.sajuplan.com', 'https://tarot.sajuplan.com', 'https://sajuplan.com']) {
    const r = await request.get(u)
    expect(r.status(), `${u} 정상`).toBe(200)
  }
})

test('P-8 공유 프로필 입력(MyInfoBar) → 접힘 카드 + 전 타일 자동', async ({ page }) => {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.getByText('생년월일 넣고 내 운세 받기').click()
  await page.getByPlaceholder('이름').fill('홍길동')
  await page.locator('input[inputmode="numeric"]').first().fill('1990-06-15')
  await page.getByRole('button', { name: '여성' }).click()
  await page.getByText('저장하고 모든 운세 받기').click()
  await page.waitForTimeout(400)
  // 만세력식 접힘 요약 카드
  await expect(page.getByText('홍길동')).toBeVisible()
  await expect(page.getByText('말띠', { exact: false })).toBeVisible()
  await expect(page.getByText('정보 수정하기')).toBeVisible()
  // 띠별 자동
  await page.goto(`${BASE}/#/zodiac`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  await expect(page.getByText('종합운')).toBeVisible()
  // 로또 자동
  await page.goto(`${BASE}/#/lotto`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  await expect(page.locator('.ball-pop')).toHaveCount(6)
  // 궁합 — "나"는 접힘 카드에 자동(1990.06.15), 상대만 입력하면 됨
  await page.goto(`${BASE}/#/couple`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(300)
  await expect(page.getByText('1990.06.15', { exact: false })).toBeVisible()
})

test('P-9 만세·타로 — 포털 안 임베드(복사X) + 뒤로가기', async ({ page }) => {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid=topic-tile]', { hasText: '만세력' }).click()
  await page.waitForTimeout(1500)
  expect(page.url()).toContain('/manse') // pushState 경로(해시 아님)
  await expect(page.getByText('운세 포털')).toBeVisible()
  const frame = page.locator('iframe')
  await expect(frame).toHaveCount(1)
  expect(await frame.getAttribute('src')).toContain('manse.sajuplan.com')
  await page.getByText('운세 포털').click()
  await page.waitForTimeout(500)
  await expect(page.getByText('오늘은 어떤 운이', { exact: false })).toBeVisible()
})

test('P-10 만세력 연동 — 프로필 입력(시각 포함) → 만세력 자동 채움', async ({ page }) => {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.getByText('생년월일 넣고 내 운세 받기').click()
  await page.getByPlaceholder('이름').fill('홍길동')
  await page.getByRole('button', { name: '여성' }).click()
  const nums = page.locator('input[inputmode="numeric"]')
  await nums.nth(0).fill('19900615') // 생년월일
  await nums.nth(1).fill('0720') // 시각
  await page.getByText('저장하고 모든 운세 받기').click()
  await page.waitForTimeout(400)
  await expect(page.getByText('오전 7:20', { exact: false })).toBeVisible()
  // 만세력 열기 → 입력 없이 결과
  await page.locator('[data-testid=topic-tile]', { hasText: '만세력' }).click()
  await page.waitForTimeout(3000)
  const src = await page.locator('iframe').getAttribute('src')
  expect(src).toContain('b=1990-06-15T07')
  expect(src).toContain('uh=0')
  await expect(page.frameLocator('iframe').getByText('홍길동').first()).toBeVisible()
})

test('P-11 사주타일 — 신년·월간·재물운·평생운세·택일', async ({ page }) => {
  await seedProfile(page, { birth: '1990-06-15', gender: 'F' })
  // 신년(세운)
  await page.goto(`${BASE}/#/newyear`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  await expect(page.getByText('올해운')).toBeVisible()
  await expect(page.getByText('월별 흐름')).toBeVisible()
  // 월간(월운)
  await page.goto(`${BASE}/#/monthly`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  await expect(page.getByText('이달운')).toBeVisible()
  await expect(page.getByText('기간별 흐름')).toBeVisible()
  // 재물운 v2 (만세엔진 결합 — 재물그릇·성향·시기·개운)
  await page.goto(`${BASE}/#/wealth`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  expect(Number(await page.getByTestId('wealth-score').innerText())).toBeGreaterThan(0)
  await expect(page.getByText('나의 부자 유형')).toBeVisible()
  await expect(page.getByText('재물운 총평')).toBeVisible()
  await expect(page.getByText('내 재물 그릇', { exact: true })).toBeVisible()
  await expect(page.getByText('재물 4능력')).toBeVisible()
  await expect(page.getByText('💪 버는 힘')).toBeVisible()
  await expect(page.getByText('🛡️ 지키는 힘')).toBeVisible()
  await expect(page.getByText('재물 성향')).toBeVisible()
  await expect(page.getByText('정재 (안정 수입)')).toBeVisible()
  await expect(page.getByText('편재 (사업·투자)')).toBeVisible()
  await expect(page.getByText('소비 · 투자 성향')).toBeVisible()
  await expect(page.getByText('나에게 맞는 돈 버는 방법')).toBeVisible()
  await expect(page.getByText('재물 신살·귀인')).toBeVisible()
  await expect(page.getByText('재물이 강한 시기', { exact: false })).toBeVisible()
  await expect(page.getByText('평생 재물 흐름', { exact: false })).toBeVisible()
  await expect(page.getByText('분야별 재물운')).toBeVisible()
  await expect(page.getByText('돈이 들어오는 시기')).toBeVisible()
  await expect(page.getByText('재물 개운법')).toBeVisible()
  // 평생운세 v3 (만세엔진 대운 결합 — 캐릭터·강약점·천직·타고난복·대운곡선·대운별풀이)
  await page.goto(`${BASE}/#/life`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  await expect(page.getByText('내 인생 유형')).toBeVisible()
  await expect(page.getByText('타고난 기질')).toBeVisible()
  await expect(page.getByText('타고난 강점', { exact: false })).toBeVisible()
  await expect(page.getByText('타고난 천직·적성')).toBeVisible()
  await expect(page.getByText('타고난 복')).toBeVisible()
  await expect(page.getByText('인생 대운 흐름', { exact: false })).toBeVisible()
  await expect(page.getByText('대운별 인생 풀이')).toBeVisible()
  await expect(page.getByText('분야별 평생운')).toBeVisible()
  await expect(page.getByText('시기별 인생 흐름')).toBeVisible()
  await expect(page.getByText('타고난 오행 균형')).toBeVisible()
  // 택일 v2(만세 결합 정통 택일 — 프로필 불필요)
  await page.goto(`${BASE}/#/taegil`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('방위·삼재')).toBeVisible() // 올해 삼살·대장군·삼재 배너
  await page.getByText('이사', { exact: true }).click()
  await page.waitForTimeout(300)
  await expect(page.getByText('이사 좋은 날', { exact: false }).first()).toBeVisible() // 달력 헤더(월 표시)
  await expect(page.getByText('손 없는 날').first()).toBeVisible() // 상세 카드(정통 택일)
  await expect(page.getByText('황도길일 · 오늘의 수호신')).toBeVisible()
  await expect(page.getByText('건제12신', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('이 날, 용도별 점수')).toBeVisible()
  // 캘린더 안 월 이동 → 다음 달
  const cm = new Date().getMonth() + 1
  const nm = cm === 12 ? 1 : cm + 1
  await page.getByRole('button', { name: '다음 달' }).click()
  await page.waitForTimeout(300)
  await expect(page.getByText(`${nm}월 ·`, { exact: false }).first()).toBeVisible() // 다음달 반영
})

test('P-12 오늘의 운세 풍성도 — 명식·오행·대운·신살·총운·시간대·행운표·띠궁합', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await seedProfile(page, { birth: '1990-06-15', gender: 'M', time: '12:30' })
  await page.goto(`${BASE}/#/today`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  for (const t of ['오늘의 일진', '종합운', '분야별 운세', '시간대별 흐름', '이렇게 하세요', '이건 피하세요', '오늘의 행운 요소', '맞는 성씨', '오늘 잘 맞는 띠 · 조심할 띠', '오늘의 행운번호', '나의 사주 명식', '오행 분포']) {
    await expect(page.getByText(t)).toBeVisible()
  }
  await expect(page.getByText('일간 강약', { exact: false })).toBeVisible()
  const paras = await page.locator('section >> text=/하루|날입니다|흐름|기운/').count()
  expect(paras).toBeGreaterThan(2)
  const score = (await page.locator('div', { hasText: /^\d+종합운$/ }).first().innerText()).replace('종합운', '').trim()
  expect(Number(score)).toBeGreaterThan(0)
  await noOverflow(page)
  expect(errors).toEqual([])
  // 결정론
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  const score2 = (await page.locator('div', { hasText: /^\d+종합운$/ }).first().innerText()).replace('종합운', '').trim()
  expect(score2).toBe(score)
})

test('P-13 별자리 — 별자리 배지 + 개인화 풀이(명식 미노출)', async ({ page }) => {
  await seedProfile(page, { birth: '1990-06-15' })
  await page.goto(`${BASE}/#/star`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  await expect(page.getByText('쌍둥이자리', { exact: true })).toBeVisible() // 별자리 배지(접힘카드 요약과 구분)
  await expect(page.getByText('당신의 별자리', { exact: false })).toBeVisible()
  await expect(page.getByText('종합운')).toBeVisible()
  await expect(page.getByText('나의 사주 명식')).toHaveCount(0)
})

test('P-14 토정비결 — 올해 신수 + 12개월 달별 풀이', async ({ page }) => {
  await seedProfile(page, { birth: '1990-06-15' })
  await page.goto(`${BASE}/#/tojeong`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  await expect(page.getByText('올해의 신수', { exact: false })).toBeVisible()
  await expect(page.getByText('올해의 총운')).toBeVisible()
  await expect(page.getByText('내 괘 풀이 (상·중·하)')).toBeVisible() // 정통 작괘 상중하 3괘
  await expect(page.getByText('달별 운세 (정월~섣달)')).toBeVisible()
  await expect(page.getByText('토정비결 이야기')).toBeVisible() // 유래 스토리
  await expect(page.getByText('12월', { exact: false })).toBeVisible()
  // 연도 토글 — 내년 토정비결 보기
  const nextYear = new Date().getFullYear() + 1
  await page.getByText('🎊 내년').click()
  await page.waitForTimeout(300)
  await expect(page.getByText(`${nextYear}년`, { exact: false }).first()).toBeVisible() // 내년 반영
})

test('P-15 연예인 궁합 — 스타 유형 선택 → 케미', async ({ page }) => {
  await seedProfile(page, { birth: '1990-06-15' })
  await page.goto(`${BASE}/#/celeb`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(300)
  await page.getByText('청량 아이돌').first().click()
  await page.waitForTimeout(300)
  await expect(page.getByText('둘은 서로에게 어떤 사람?')).toBeVisible() // 십성 양방향
  await expect(page.getByText('둘을 잇는 인연 코드')).toBeVisible()
  await expect(page.getByText('가상 시나리오', { exact: false })).toBeVisible() // 데이트 시나리오
  await expect(page.getByText('우리의 덕질 코드')).toBeVisible()
  await expect(page.getByText('잘 맞는 점')).toBeVisible()
})

test('P-16 혈액형 궁합 — 나/상대 선택 → 궁합', async ({ page }) => {
  await page.goto(`${BASE}/#/blood`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'O형' }).first().click()
  await page.getByRole('button', { name: 'A형' }).nth(1).click()
  await page.waitForTimeout(300)
  await expect(page.getByText('환상의 케미', { exact: false })).toBeVisible() // 등급 라벨
  await expect(page.getByText('이럴 때 잘 맞아요')).toBeVisible()
  await expect(page.getByText('전생의 인연')).toBeVisible() // 전생 드립
  await expect(page.getByText('O형의 궁합 랭킹')).toBeVisible() // 운명/조심 상대
  await expect(page.getByText('MBTI로 치면', { exact: false }).first()).toBeVisible() // MBTI 교차
})

test('P-17 꽃잎점 — 이름 입력 → 마음 게이지', async ({ page }) => {
  await page.goto(`${BASE}/#/petal`, { waitUntil: 'domcontentloaded' })
  await page.getByPlaceholder('그 사람 이름').fill('홍길동')
  await page.getByText('꽃잎점 보기').click()
  await page.waitForTimeout(200)
  // 꽃잎을 다 뗄 때까지 클릭(7~13장)
  for (let i = 0; i < 16; i++) {
    const btn = page.getByRole('button', { name: /꽃잎 떼기/ })
    if (await btn.count() === 0) break
    await btn.click()
  }
  await expect(page.getByText('마음 게이지', { exact: false })).toBeVisible()
  await expect(page.getByText('우리 케미 5항목')).toBeVisible() // 5항목 분해
  await expect(page.getByText('짝사랑 리포트')).toBeVisible() // 성공확률·고백타이밍
  await expect(page.getByText('이렇게 하면 이뤄져요')).toBeVisible() // 행동 가이드
})

test('P-18 포춘쿠키 — 까기 → 메시지+행운', async ({ page }) => {
  await page.goto(`${BASE}/#/cookie`, { waitUntil: 'domcontentloaded' })
  await page.getByText('깨보세요').click()
  await page.waitForTimeout(300)
  await expect(page.getByText('오늘의 행운지수')).toBeVisible() // 종합 헤더
  await expect(page.getByText('분야별 오늘운')).toBeVisible() // 분야별 4
  await expect(page.getByText('테마 쿠키 더 까기')).toBeVisible() // 테마 쿠키
  await expect(page.getByText('쿠키에게 물어보기', { exact: false })).toBeVisible() // 매직8볼
  await expect(page.getByText('오늘의 행운 행동', { exact: false })).toBeVisible()
})

test('P-19 공통 MyInfoBar — 접힘 카드 + 정보 수정하기 펼침(전 화면 동일 부품)', async ({ page }) => {
  await seedProfile(page, { birth: '1990-06-15', gender: 'F', name: '홍길동', time: '07:20' })
  for (const route of ['today', 'star', 'newyear', 'monthly', 'tojeong', 'wealth', 'life', 'celeb', 'couple', 'zodiac']) {
    await page.goto(`${BASE}/#/${route}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(250)
    // 접힘 카드(입력폼 아님)가 떠 있고 수정 버튼 존재
    await expect(page.getByText('정보 수정하기'), `${route}: 접힘 카드`).toBeVisible()
    await noOverflow(page)
  }
  // 한 화면에서 수정 → 폼 펼침 확인
  await page.goto(`${BASE}/#/today`, { waitUntil: 'domcontentloaded' })
  await page.getByText('정보 수정하기').click()
  await expect(page.getByText('저장하고 모든 운세 받기')).toBeVisible()
})

test('P-20 SEO 경로 — 직접 URL(/route) 접근 동작 + 페이지별 제목(pushState)', async ({ page }) => {
  // 해시(#/) 아닌 실제 경로로 직접 들어가도 nginx fallback + 라우터가 받아 렌더
  await page.goto(`${BASE}/dream`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  await expect(page).toHaveTitle(/꿈해몽/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('꿈해몽') // 헤더 라우팅(직접 경로 인식)
  await page.goto(`${BASE}/tojeong`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  await expect(page).toHaveTitle(/토정비결/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('토정비결')
})

test('P-21 공유 폴백 모달 — navigator.share 미지원(카톡 인앱)이면 친절 모달', async ({ page }) => {
  await page.addInitScript(() => { delete (navigator as { share?: unknown }).share }) // 카톡 인앱 모사
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: '공유하기' }).click()
  await page.waitForTimeout(300)
  await expect(page.getByText('친구에게 공유하기')).toBeVisible()
  await expect(page.getByText('링크 복사하기')).toBeVisible()
})

test('P-22 MBTI 운세 — 유형 선택 → 오늘운세 + 궁합(무에러)', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${BASE}/mbti`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'ENFP', exact: true }).click()
  await page.waitForTimeout(400)
  await expect(page.getByText('오늘의 ENFP 운세')).toBeVisible()
  await expect(page.getByText('ENFP 완전정복')).toBeVisible() // 롱폼 에세이
  await expect(page.getByText('네 글자에 담긴 나')).toBeVisible() // 4지표 심층
  expect(errors, errors.join('\n')).toHaveLength(0)
})

test('P-23 이름 궁합 — 두 이름 → 오행·케미(무에러·결정론)', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${BASE}/namecompat`, { waitUntil: 'networkidle' })
  await page.getByPlaceholder('내 이름').fill('김민준')
  await page.getByPlaceholder('상대 이름').fill('이서연')
  await page.getByRole('button', { name: /이름 궁합 보기/ }).click()
  await page.waitForTimeout(400)
  await expect(page.getByText('이름에 담긴 오행')).toBeVisible()
  await expect(page.getByText('우리 케미 5항목')).toBeVisible()
  expect(errors, errors.join('\n')).toHaveLength(0)
})

test('P-24 전생 이야기 — 생년월일 → 전생 신분·인연(무에러)', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => localStorage.setItem('unse_profile_v1', JSON.stringify({ name: '홍길동', birth: '1990-06-15', time: '07:20', gender: 'F' })))
  await page.goto(`${BASE}/pastlife`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await expect(page.getByText('전생의 당신은')).toBeVisible()
  await expect(page.getByText('이번 생에 가져온 것')).toBeVisible()
  expect(errors, errors.join('\n')).toHaveLength(0)
})

test('P-25 청크 로드 실패 → 자동 새로고침 복구(재배포 캐시 불일치 안전망)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('unse_profile_v1', JSON.stringify({ name: '테스트', birth: '1990-06-15', time: '07:20', gender: 'F' })))
  let first = true
  // 재배포로 옛 청크가 404 나는 상황 모사 — 첫 요청만 차단, 자동 새로고침 후엔 정상 통과
  await page.route(/RichFortuneView.*\.js/, (route) => {
    if (first) { first = false; route.abort() } else route.continue()
  })
  await page.goto(`${BASE}/zodiac`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4500) // 청크실패 → ErrorBoundary → 자동 reload → 정상 렌더
  await expect(page.getByText('잠시 문제가 생겼어요')).toHaveCount(0) // 폴백이 떠 있지 않아야(자동복구)
  await expect(page.getByRole('heading', { name: '띠별 운세' })).toBeVisible()
})
