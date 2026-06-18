import { test, expect } from '@playwright/test'

/**
 * [2026-06-12] 채팅 저장형 XSS 차단 — 실제 손가락 동작 검증.
 *
 * 사전(외부): 회원(e2e_member)이 방 82에 message_type=2 + 악성 HTML
 *   `<img src=x onerror="window.__XSS_FIRED__=true">악성HTML_E2E_XSS` 전송.
 * 여기선 상담사(dummy_01)가 채팅 로그를 브라우저로 열어:
 *   1) onerror 스크립트가 실행되지 않음(__XSS_FIRED__ !== true) — sanitize 로 onerror 제거됨
 *   2) 메시지 텍스트는 정상 노출(정화 후 렌더)
 */

const ROOM = process.env.CHAT_XSS_ROOM || '82'

test.use({ storageState: 'user_counselor_storage.json', viewport: { width: 375, height: 812 } })

test('채팅 악성 HTML(type=2) → 스크립트 미실행 + 텍스트 정상 노출', async ({ page }) => {
  await page.goto(`https://sajuplan.com/chat-log/${ROOM}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)

  // 일회성 손가락 테스트 — 사전 시드(방+악성메시지)가 없으면 graceful skip (정리 후 일반 회귀에서 통과 유지)
  const seeded = await page.getByText('악성HTML_E2E_XSS').count()
  test.skip(seeded === 0, '사전 시드된 악성 메시지 없음 — 방+message_type=2 메시지 수동 생성 후 CHAT_XSS_ROOM 지정 시 검증')

  // 메시지가 렌더됐는지(정화 후 텍스트 노출)
  await expect(page.getByText('악성HTML_E2E_XSS'), '정화된 메시지 텍스트 노출').toBeVisible({ timeout: 8000 })

  // onerror 스크립트가 실행됐는가? (정화됐으면 false)
  const fired = await page.evaluate(() => (window as unknown as { __XSS_FIRED__?: boolean }).__XSS_FIRED__ === true)
  expect(fired, 'onerror 스크립트 실행됨 = XSS 차단 실패!').toBe(false)

  // 렌더된 메시지 DOM 에 onerror 속성이 없어야
  const hasOnerror = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'))
    return imgs.some((i) => i.hasAttribute('onerror'))
  })
  expect(hasOnerror, '렌더 DOM 에 onerror 잔존').toBe(false)
})
