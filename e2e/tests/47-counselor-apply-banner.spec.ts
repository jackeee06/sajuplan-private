import { test, expect } from '@playwright/test'

/**
 * [2026-06-10] 상담사 신청 폼 — 파란 배너 문구 검증
 *
 * 변경 내용: 로그인 회원 pre-fill 배너에서
 *   "휴대폰 인증은 보안을 위해 다시 한 번 받아주세요." 문구 제거.
 *
 * 이유: 로그인 회원에겐 인증 UI가 없는데 인증 안내 문구가 남아있어 혼란 유발.
 *
 * 검증 방법: prod 번들에서 텍스트 직접 확인 (27-counselor-apply-region 패턴 동일).
 */

const BASE = (process.env.TARGET ?? 'prod') === 'prod'
  ? 'https://sajuplan.com'
  : 'https://sajumoon.kr'

test.describe('상담사 신청 폼 — 파란 배너 문구 검증', () => {

  let bundleContent = ''

  test.beforeAll(async ({ request }) => {
    const html = await (await request.get(`${BASE}/`)).text()
    const match = html.match(/src="(\/assets\/index-[^"]+\.js[^"]*)"/)?.[1]
    expect(match, 'index.html 에서 번들 파일을 찾지 못함').toBeTruthy()
    const res = await request.get(`${BASE}${match}`)
    expect(res.ok()).toBeTruthy()
    bundleContent = await res.text()
    console.log(`번들: ${BASE}${match} (${(bundleContent.length / 1024).toFixed(0)}KB)`)
  })

  test('제거된 문구가 번들에 없다 — "휴대폰 인증은 보안을 위해 다시 한 번 받아주세요"', () => {
    expect(bundleContent).not.toContain('휴대폰 인증은 보안을 위해 다시 한 번 받아주세요')
  })

  test('유지된 문구가 번들에 있다 — "회원 정보에서 일부 항목을 가져왔어요"', () => {
    expect(bundleContent).toContain('회원 정보에서 일부 항목을 가져왔어요')
  })

  test('유지된 문구가 번들에 있다 — "바뀐 정보가 있으면 수정해 주세요"', () => {
    expect(bundleContent).toContain('바뀐 정보가 있으면 수정해 주세요')
  })

})
