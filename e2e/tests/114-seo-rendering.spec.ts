import { test, expect } from '@playwright/test'

/**
 * [2026-06-25] SEO dynamic rendering E2E
 *
 * 사용자 사이트는 CSR SPA — 크롤러/카톡 스크래퍼는 빈 #root 만 본다.
 * nginx 가 봇 UA 요청을 API(/api/seo/render)로 프록시 → 풀 HTML(메타·OG·JSON-LD) 반환.
 * 사람(일반 UA)은 기존 SPA 를 그대로 받는다(회귀 없어야 함).
 *
 * 검증:
 *  1. 봇 UA → 상담사 상세가 서버렌더 HTML(제목·description·og·canonical·JSON-LD·h1), SPA 부트 아님
 *  2. 사람 UA → 동일 URL 이 SPA(부트 스켈레톤), og:title 없음 (클로킹 분기 정상)
 *  3. 카톡 스크래퍼 UA → og:title 존재 (공유 카드)
 *  4. 봇 UA → 메인('/')·목록('/counselors') 서버렌더
 *  5. sitemap.xml → 유효 XML + 상담사 URL 포함
 *  6. robots.txt → Sitemap 줄 존재
 */

const DOMAIN = (process.env.TARGET ?? 'prod') === 'prod' ? 'sajuplan.com' : 'sajumoon.kr'
const API_DOMAIN = (process.env.TARGET ?? 'prod') === 'prod' ? 'api.sajuplan.com' : 'api.sajumoon.kr'
const SITE = `https://${DOMAIN}`

const BOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const KAKAO = 'Mozilla/5.0 (compatible; kakaotalk-scrap/1.0; +https://devtalk.kakao.com)'
const HUMAN =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

/** 공개 API 에서 실재 상담사 1명 id 확보 (테스트 견고성). */
async function pickCounselorId(request: any): Promise<number> {
  const res = await request.get(`https://${API_DOMAIN}/api/user/counselors?tab=all&limit=1`)
  expect(res.ok()).toBeTruthy()
  const json = await res.json()
  const id = json?.items?.[0]?.id
  expect(typeof id).toBe('number')
  return id
}

test.describe('SEO dynamic rendering', () => {
  test('1. 봇 UA → 상담사 상세 서버렌더(메타·OG·JSON-LD)', async ({ page }) => {
    const id = await pickCounselorId(page.request)
    const res = await page.request.get(`${SITE}/counselors/${id}`, { headers: { 'User-Agent': BOT } })
    expect(res.status()).toBe(200)
    const html = await res.text()
    // 서버렌더 신호
    expect(html).toMatch(/<title>[^<]+\| 사주플랜<\/title>/)
    expect(html).toContain('<meta name="description"')
    expect(html).toContain('property="og:title"')
    expect(html).toContain('property="og:image"')
    expect(html).toContain(`<link rel="canonical" href="${SITE}/counselors/${id}"`)
    expect(html).toContain('application/ld+json')
    expect(html).toContain('<h1')
    // SPA 부트 스켈레톤이 아니어야 함
    expect(html).not.toContain('sjm-boot')
    expect(html).not.toContain('/src/main.tsx')
  })

  test('2. 사람 UA → 동일 URL 은 SPA(회귀 없음, og 없음)', async ({ page }) => {
    const id = await pickCounselorId(page.request)
    const res = await page.request.get(`${SITE}/counselors/${id}`, { headers: { 'User-Agent': HUMAN } })
    expect(res.status()).toBe(200)
    const html = await res.text()
    // 기존 SPA index.html 신호
    expect(html).toContain('id="root"')
    expect(html.includes('sjm-boot') || html.includes('/assets/')).toBeTruthy()
    // 사람에겐 서버렌더 OG 가 안 나가야 함(클로킹 분기 정상 동작)
    expect(html).not.toContain('property="og:title"')
  })

  test('3. 카톡 스크래퍼 UA → OG 카드 HTML', async ({ page }) => {
    const id = await pickCounselorId(page.request)
    const res = await page.request.get(`${SITE}/counselors/${id}`, { headers: { 'User-Agent': KAKAO } })
    expect(res.status()).toBe(200)
    const html = await res.text()
    expect(html).toContain('property="og:title"')
    expect(html).toContain('property="og:image"')
  })

  test('4. 봇 UA → 메인/목록 서버렌더', async ({ page }) => {
    const home = await page.request.get(`${SITE}/`, { headers: { 'User-Agent': BOT } })
    expect(home.status()).toBe(200)
    const homeHtml = await home.text()
    expect(homeHtml).toContain('property="og:title"')
    expect(homeHtml).toContain('application/ld+json')
    expect(homeHtml).not.toContain('sjm-boot')

    const list = await page.request.get(`${SITE}/counselors`, { headers: { 'User-Agent': BOT } })
    expect(list.status()).toBe(200)
    const listHtml = await list.text()
    expect(listHtml).toContain('상담사')
    expect(listHtml).toContain('<link rel="canonical"')
  })

  test('5. sitemap.xml → 유효 XML + 상담사 URL', async ({ page }) => {
    const res = await page.request.get(`${SITE}/sitemap.xml`)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('xml')
    const xml = await res.text()
    expect(xml).toContain('<urlset')
    expect(xml).toContain(`${SITE}/counselors/`)
    expect(xml).toContain(`<loc>${SITE}/</loc>`)
  })

  test('6. robots.txt → Sitemap 줄', async ({ page }) => {
    const res = await page.request.get(`${SITE}/robots.txt`)
    expect(res.status()).toBe(200)
    const txt = await res.text()
    expect(txt).toContain(`Sitemap: ${SITE}/sitemap.xml`)
    expect(txt).toContain('Disallow: /mng')
  })
})
