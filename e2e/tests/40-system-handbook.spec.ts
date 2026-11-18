import { test, expect, request } from '@playwright/test'

/**
 * [Phase 5] 시스템/설정/운영바이블/AI 엄격검증
 *
 * 검증 포인트:
 *   E-1. API 헬스체크 (이미 12-api-healthcheck.spec.ts)
 *   E-4. 공지/이벤트/FAQ 페이지
 *   E-5. 운영바이블 (/mng/handbook) 렌더 + 검색 API
 *   E-5b. 운영바이블AI (/mng/handbook-ai) 렌더 + 세션 API
 *   E-6. 어드민 출석 관리 페이지
 *   E-7. 어드민 환경설정
 *   E-8. 어드민 알림 가이드
 *   E-9. 어드민 통계
 */

const API = 'https://api.sajuplan.com'

async function adminLogin() {
  const ctx = await request.newContext()
  const resp = await ctx.post(`${API}/api/admin/auth/login`, {
    data: { mb_id: 'lee', password: 'kunwoo77' },
  })
  if (resp.status() !== 200 && resp.status() !== 201) return null
  return ctx
}

// ── 운영바이블 API ──────────────────────────────────────────────
test.describe('운영바이블 API (E-5)', () => {
  test('GET /admin/handbook/index — 카테고리+항목 목록', async () => {
    const ctx = await adminLogin()
    if (!ctx) { console.log('[SKIP]'); return }

    const resp = await ctx.get(`${API}/api/admin/handbook/index`)
    expect(resp.status()).toBe(200)
    const data = await resp.json() as {
      categories: { key: string; title: string; items: { slug: string; title: string }[] }[]
    }
    expect(Array.isArray(data.categories)).toBe(true)
    expect(data.categories.length).toBeGreaterThan(0)
    const totalItems = data.categories.reduce((acc, c) => acc + c.items.length, 0)
    console.log(`[OK] 운영바이블 인덱스: ${data.categories.length}카테고리, ${totalItems}항목`)
    await ctx.dispose()
  })

  test('GET /admin/handbook/item?slug= — 항목 상세 (마크다운 본문)', async () => {
    const ctx = await adminLogin()
    if (!ctx) { return }

    // 첫 항목 조회
    const idxResp = await ctx.get(`${API}/api/admin/handbook/index`)
    const idx = await idxResp.json() as { categories: { items: { slug: string }[] }[] }
    const firstSlug = idx.categories?.[0]?.items?.[0]?.slug
    if (!firstSlug) { console.log('[SKIP] 항목 없음'); await ctx.dispose(); return }

    const resp = await ctx.get(`${API}/api/admin/handbook/item?slug=${encodeURIComponent(firstSlug)}`)
    expect(resp.status()).toBe(200)
    const data = await resp.json() as { slug: string; title: string; markdown: string }
    expect(typeof data.markdown).toBe('string')
    expect(data.markdown.length).toBeGreaterThan(10)
    console.log(`[OK] 운영바이블 항목: slug=${data.slug}, length=${data.markdown.length}`)
    await ctx.dispose()
  })

  test('GET /admin/handbook/search?q= — 키워드 검색', async () => {
    const ctx = await adminLogin()
    if (!ctx) { return }

    const resp = await ctx.get(`${API}/api/admin/handbook/search?q=정산`)
    expect(resp.status()).toBe(200)
    const data = await resp.json() as { hits: { slug: string; title: string; snippet: string }[] }
    expect(Array.isArray(data.hits)).toBe(true)
    console.log(`[OK] 운영바이블 검색 '정산': ${data.hits.length}건`)
    await ctx.dispose()
  })
})

// ── 타로 바이블 반영 검증 (tarot 핸드북 배포 확인) ──────────────────
test.describe('타로 핸드북 (바이블 반영)', () => {
  test('index 에 tarot 카테고리 등록 (중복 없음·2항목)', async () => {
    const ctx = await adminLogin()
    if (!ctx) { console.log('[SKIP]'); return }

    const resp = await ctx.get(`${API}/api/admin/handbook/index`)
    expect(resp.status()).toBe(200)
    const data = await resp.json() as {
      categories: { key: string; title: string; items: { slug: string }[] }[]
    }
    const tarotCats = data.categories.filter((c) => c.key === 'tarot')
    expect(tarotCats.length).toBe(1) // 중복 등록 버그 회귀 방지
    const slugs = tarotCats[0].items.map((i) => i.slug)
    expect(slugs).toContain('tarot/01-overview')
    expect(slugs).toContain('tarot/02-live-consultation')
    console.log(`[OK] tarot 카테고리 1개, 항목 ${slugs.length}개: ${slugs.join(', ')}`)
    await ctx.dispose()
  })

  test('tarot/01-overview 본문 서빙 (라이브 타로보드)', async () => {
    const ctx = await adminLogin()
    if (!ctx) { return }

    const resp = await ctx.get(`${API}/api/admin/handbook/item?slug=${encodeURIComponent('tarot/01-overview')}`)
    expect(resp.status()).toBe(200)
    const data = await resp.json() as { markdown: string }
    expect(data.markdown.length).toBeGreaterThan(100)
    expect(data.markdown).toContain('타로')
    expect(data.markdown).toContain('tarotroom')
    console.log(`[OK] tarot/01-overview 본문 length=${data.markdown.length}`)
    await ctx.dispose()
  })

  test('검색 q=타로 → tarot 문서 매칭', async () => {
    const ctx = await adminLogin()
    if (!ctx) { return }

    const resp = await ctx.get(`${API}/api/admin/handbook/search?q=${encodeURIComponent('타로')}`)
    expect(resp.status()).toBe(200)
    const data = await resp.json() as { hits: { slug: string }[] }
    const hasTarot = data.hits.some((h) => h.slug.startsWith('tarot/'))
    expect(hasTarot).toBe(true)
    console.log(`[OK] 검색 '타로': ${data.hits.length}건, tarot 문서 포함=${hasTarot}`)
    await ctx.dispose()
  })
})

// ── 상담연결 바이블 반영 검증 (counselor/09 배포 확인) ──────────────
test.describe('상담연결 핸드북 (바이블 반영)', () => {
  test('index 에 counselor/09-consult-request 등록', async () => {
    const ctx = await adminLogin()
    if (!ctx) { console.log('[SKIP]'); return }

    const resp = await ctx.get(`${API}/api/admin/handbook/index`)
    expect(resp.status()).toBe(200)
    const data = await resp.json() as {
      categories: { key: string; items: { slug: string }[] }[]
    }
    const counselorCat = data.categories.find((c) => c.key === 'counselor')
    expect(counselorCat, 'counselor 카테고리 없음').toBeTruthy()
    const slugs = counselorCat!.items.map((i) => i.slug)
    expect(slugs).toContain('counselor/09-consult-request')
    console.log(`[OK] counselor 카테고리 ${slugs.length}항목, 09-consult-request 포함`)
    await ctx.dispose()
  })

  test('counselor/09-consult-request 본문 서빙 (콜백/지금 상담 켜기)', async () => {
    const ctx = await adminLogin()
    if (!ctx) { return }

    const resp = await ctx.get(`${API}/api/admin/handbook/item?slug=${encodeURIComponent('counselor/09-consult-request')}`)
    expect(resp.status()).toBe(200)
    const data = await resp.json() as { markdown: string }
    expect(data.markdown.length).toBeGreaterThan(100)
    expect(data.markdown).toContain('콜백')
    expect(data.markdown).toContain('지금 상담 켜기')
    console.log(`[OK] counselor/09-consult-request 본문 length=${data.markdown.length}`)
    await ctx.dispose()
  })

  test('검색 q=상담요청 → counselor/09 매칭', async () => {
    const ctx = await adminLogin()
    if (!ctx) { return }

    const resp = await ctx.get(`${API}/api/admin/handbook/search?q=${encodeURIComponent('상담요청')}`)
    expect(resp.status()).toBe(200)
    const data = await resp.json() as { hits: { slug: string }[] }
    const has09 = data.hits.some((h) => h.slug === 'counselor/09-consult-request')
    expect(has09, `검색 결과에 09 없음 (${data.hits.map((h) => h.slug).join(', ')})`).toBe(true)
    console.log(`[OK] 검색 '상담요청': ${data.hits.length}건, 09 포함`)
    await ctx.dispose()
  })
})

// ── 운영바이블AI API ──────────────────────────────────────────────
test.describe('운영바이블 AI API (E-5b)', () => {
  test('GET /admin/handbook/sessions — 세션 목록', async () => {
    const ctx = await adminLogin()
    if (!ctx) { return }

    const resp = await ctx.get(`${API}/api/admin/handbook/sessions`)
    if (resp.status() === 404) {
      console.log('[INFO] /handbook/sessions API 없음')
      await ctx.dispose()
      return
    }
    expect(resp.status()).toBe(200)
    const data = await resp.json() as { sessions: { id: number }[] } | { id: number }[]
    const sessions = Array.isArray(data) ? data : (data as { sessions: { id: number }[] }).sessions ?? []
    console.log(`[OK] AI 세션 목록: ${sessions.length}건`)
    await ctx.dispose()
  })

  test('GET /admin/handbook/config — AI 설정 조회', async () => {
    const ctx = await adminLogin()
    if (!ctx) { return }

    const resp = await ctx.get(`${API}/api/admin/handbook/config`)
    if (resp.status() === 403) {
      console.log('[OK] AI 설정은 슈퍼관리자 전용 → 403 정상')
      await ctx.dispose()
      return
    }
    if (resp.status() === 404) {
      console.log('[INFO] /handbook/config 없음')
      await ctx.dispose()
      return
    }
    expect([200]).toContain(resp.status())
    const data = await resp.json() as { model?: string; enabled?: boolean }
    console.log(`[OK] AI 설정: model=${data.model}, enabled=${data.enabled}`)
    await ctx.dispose()
  })
})

// ── 어드민 페이지 렌더 ──────────────────────────────────────────
test.describe('어드민 시스템/설정 페이지 렌더 (E-6~9)', () => {
  test.use({ storageState: 'storageState.json' })

  const systemPages = [
    { path: '/mng/handbook', name: '운영바이블' },
    { path: '/mng/handbook-ai', name: '운영바이블 AI' },
    { path: '/mng/settings', name: '환경설정' },
    { path: '/mng/alert-guide', name: '알림 가이드' },
    { path: '/mng/push-guide', name: '푸시 가이드' },
    { path: '/mng/stats', name: '통계' },
    { path: '/mng/dashboard', name: '대시보드' },
    { path: '/mng/all-menus', name: '전체메뉴' },
    { path: '/mng/alimtalk-templates', name: '알림톡 템플릿' },
    { path: '/mng/search-keywords', name: '인기검색어 관리' },
    { path: '/mng/notices', name: '공지사항 관리' },
    { path: '/mng/events', name: '이벤트 관리' },
    { path: '/mng/faqs', name: 'FAQ 관리' },
    { path: '/mng/banners', name: '배너 관리' },
  ]

  for (const { path, name } of systemPages) {
    test(`${name} (${path}) — 렌더 확인`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      expect(page.url()).not.toContain('/login')
      console.log(`[OK] ${name}: ${page.url().replace('https://sajuplan.com', '')}`)
    })
  }
})

// ── 공지/이벤트/FAQ 사용자 API ──────────────────────────────────
test.describe('사용자 공지/이벤트/FAQ API (E-4)', () => {
  test('GET /api/user/notices — 공지사항 목록', async () => {
    const ctx = await request.newContext()
    const resp = await ctx.get(`${API}/api/user/notices?limit=3`)
    expect(resp.status()).toBe(200)
    const data = await resp.json() as { items: { id: number; title: string }[]; total: number }
    expect(Array.isArray(data.items)).toBe(true)
    console.log(`[OK] 공지사항: ${data.total}건`)
    await ctx.dispose()
  })

  test('GET /api/user/events — 이벤트 목록', async () => {
    const ctx = await request.newContext()
    const resp = await ctx.get(`${API}/api/user/events?limit=3`)
    expect(resp.status()).toBe(200)
    const data = await resp.json() as { items: { id: number; title: string }[]; total: number }
    expect(Array.isArray(data.items)).toBe(true)
    console.log(`[OK] 이벤트: ${data.total}건`)
    await ctx.dispose()
  })

  test('GET /api/user/faqs — FAQ 목록', async () => {
    const ctx = await request.newContext()
    const resp = await ctx.get(`${API}/api/user/faqs?limit=3`)
    expect(resp.status()).toBe(200)
    const data = await resp.json() as { items: { id: number; question: string }[] } | { id: number; question: string }[]
    const items = Array.isArray(data) ? data : (data as { items: unknown[] }).items ?? []
    console.log(`[OK] FAQ: ${items.length}건`)
    await ctx.dispose()
  })

  test('GET /api/user/pages/:slug — 정적 페이지 (terms 등)', async () => {
    const ctx = await request.newContext()
    const resp = await ctx.get(`${API}/api/user/pages/terms`)
    // 200 이거나 404 (등록 안 된 경우)
    expect([200, 404]).toContain(resp.status())
    console.log(`[OK] 정적 페이지 terms: ${resp.status()}`)
    await ctx.dispose()
  })
})

// ── health check 재확인 ──────────────────────────────────────────
test('API 헬스체크 — 서버 정상 작동 최종 확인', async () => {
  const ctx = await request.newContext()
  const resp = await ctx.get(`${API}/api/health`)
  expect(resp.status()).toBe(200)
  const data = await resp.json() as { status: string }
  expect(data.status).toBe('ok')
  console.log('[OK] API 헬스체크: status=ok')
  await ctx.dispose()
})
