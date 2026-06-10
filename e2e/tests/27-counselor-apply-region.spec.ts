import { test, expect } from '@playwright/test'

/**
 * 상담사 신청 폼 — 거주 지역 필드 텍스트 검증
 *
 * /counselor-apply/new 는 로그인 필수 페이지라 브라우저 직접 방문 불가.
 * 대신 prod 서버에서 실제 서빙 중인 JS 번들을 fetch 해서
 * 소스코드 레벨로 텍스트 포함 여부를 검증한다.
 * (bundle hash 는 index.html 에서 동적 추출)
 */

const BASE = (process.env.TARGET ?? 'prod') === 'prod'
  ? 'https://sajuplan.com'
  : 'https://sajumoon.kr'

test.describe('상담사 신청 폼 — 지역 필드 번들 검증', () => {

  let bundleContent = ''

  test.beforeAll(async ({ request }) => {
    // index.html 에서 메인 번들 파일명 추출
    const html = await (await request.get(`${BASE}/`)).text()
    const match = html.match(/src="(\/assets\/index-[^"]+\.js[^"]*)"/)?.[1]
    expect(match, 'index.html 에서 번들 파일을 찾지 못함').toBeTruthy()
    const res = await request.get(`${BASE}${match}`)
    expect(res.ok()).toBeTruthy()
    bundleContent = await res.text()
    console.log(`번들: ${BASE}${match} (${(bundleContent.length / 1024).toFixed(0)}KB)`)
  })

  test('번들에 "거주 지역" 텍스트가 포함된다', () => {
    expect(bundleContent).toContain('거주 지역')
  })

  test('번들에 "거주/활동 지역을 선택해주세요" 텍스트가 포함된다', () => {
    expect(bundleContent).toContain('거주/활동 지역을 선택해주세요')
  })

  test('번들에 구버전 "메인 활동 지역" 텍스트가 없다', () => {
    expect(bundleContent).not.toContain('메인 활동 지역')
  })

  test('번들에 구버전 "전국을 선택해주세요" 텍스트가 없다', () => {
    expect(bundleContent).not.toContain('전국을 선택해주세요')
    expect(bundleContent).not.toContain('전국을 선택')
  })

})
