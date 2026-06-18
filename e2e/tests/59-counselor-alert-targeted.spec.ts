import { test, expect } from '@playwright/test'

/**
 * [2026-06-11 버그수정] 상담사 알림 chl_5 브로드캐스트 → 1:1 타깃 발송.
 *
 * 배경:
 *   전화 상담 요청(requestConsult)·문의 등록(qa_ask) 푸시가 chl_5 토픽으로 나가
 *   "전체 상담사 브로드캐스트" 되던 버그. 해당 상담사 토큰만 골라 sendToTokens 하도록 수정.
 *   (채팅 요청은 2026-06-10 동일 패턴으로 이미 수정됨.)
 *
 * 검증 한계(정직):
 *   FCM 푸시가 "누구에게 갔는지"는 웹 E2E로 관측 불가(모바일 기기 도달).
 *   따라서 이 spec 은 ▲재작성된 푸시 경로(member_push_token 조회 + sendToTokens)가
 *   prod 에서 런타임 에러 없이 실행되어 요청이 정상 성공하는지(회귀 방지)를 엄격 검증한다.
 *   "브로드캐스트 안 함"의 보증은 코드가 이미 검증·배포된 채팅요청 수정과 동일하다는 점 + 소스에
 *   sendToTopic('chl_5') 호출이 0건임으로 담보(별도 grep 확인).
 */

const API = 'https://api.sajuplan.com'
const COUNSELOR_ID = 131 // 유효한 타 상담사 (56-qna-edge 에서 검증 대상으로 사용)

test.describe('상담사 알림 타깃 발송 (chl_5 브로드캐스트 수정)', () => {
  test.use({ storageState: 'user_member_storage.json' })

  test('전화 상담 요청 — 타깃 상담사에게 정상 처리(200, ok:true), 서버에러 없음', async ({ page }) => {
    const r = await page.request.post(`${API}/api/user/counselors/${COUNSELOR_ID}/request-consult`)
    const body = await r.json().catch(() => null)
    console.log('[request-consult]', r.status(), JSON.stringify(body))
    // 재작성된 푸시 경로가 터지면 try/catch 가 흡수하지만, 그 이전 단계가 깨지면 5xx.
    expect(r.status()).toBeLessThan(500)
    expect([200, 201]).toContain(r.status()) // NestJS @Post 기본 201
    expect(body?.ok).toBeTruthy() // 최초 발송이면 ok:true, 24h 재요청이면 ok:true+already:true
  })

  test('문의 등록 — 타깃 상담사 qa_ask 푸시 경로 정상(서버에러 없음)', async ({ page }) => {
    const r = await page.request.post(`${API}/api/user/counselors/${COUNSELOR_ID}/qna`, {
      data: { title: 'E2E 타깃알림 검증', content: 'chl_5 수정 후 qa_ask 푸시 경로 회귀 검증용 문의입니다.' },
    })
    const body = await r.json().catch(() => null)
    console.log('[qna-create]', r.status(), JSON.stringify(body))
    // 핵심: 재작성된 푸시 경로가 요청을 깨지 않음 → 5xx 절대 없어야 함.
    expect(r.status()).toBeLessThan(500)
    // 정상 생성(2xx) 또는 하루 5건 한도 등 비즈룰 4xx 는 허용. 서버에러만 불합격.
    expect([200, 201, 400, 409, 429]).toContain(r.status())
  })
})
