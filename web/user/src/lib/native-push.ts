/**
 * 네이티브 앱(WebView) ↔ 서버 ↔ FCM 토큰/토픽 동기화 헬퍼.
 *
 *  - 일반 웹(브라우저)에서 호출되면 모두 no-op.
 *  - 네이티브 앱일 때:
 *      • member 가 있으면 → 디바이스 토큰을 서버에 등록(member_id 매핑)
 *      • role 별 chl_2 / chl_5 토픽 구독, 반대 토픽 해제
 *      • 비로그인이면 → chl_all / chl_2 / chl_5 모두 해제
 *
 *  sample/js/platform.js 의 push_topic_update + insert_phone_id 책임을
 *  RN bridge + REST 콜로 옮긴 것.
 */

import { authApi } from './api'
import type { UserMember } from './api'

const ALL_AUTH_TOPICS = ['chl_2', 'chl_5', 'chl_all']

/** role/level 에 맞는 구독 대상 토픽 목록. sample push_update.php 매핑과 동일. */
function topicsForMember(m: UserMember): string[] {
  const out: string[] = ['chl_all']
  if (m.role === 'counselor') out.push('chl_5')
  else out.push('chl_2')
  return out
}

/**
 * 멤버 상태가 결정된 직후(로그인/로그아웃) 호출. 토큰 매핑 + 토픽 동기화를
 * 한 번에 처리. fire-and-forget — 실패해도 UX 에 영향 X.
 */
export async function syncNativePushForMember(
  member: UserMember | null,
): Promise<void> {
  if (typeof window === 'undefined') return
  const bridge = window.SajumoonBridge
  if (!bridge?.isNative) return

  // 1) 토큰 가져오기 (네이티브가 발급한 현재 디바이스 토큰)
  let token: string | null = null
  try {
    if (typeof bridge.fcmGetToken === 'function') {
      token = await bridge.fcmGetToken()
    }
  } catch {
    token = null
  }

  // 2) 서버에 토큰 등록 — 로그인 상태면 자동으로 member_id 매핑됨
  //    (POST /user/auth/push-token, 인증 쿠키와 함께)
  if (token) {
    try {
      await authApi.registerPushToken({
        token,
        platform: bridge.platform === 'ios' ? 'ios' : 'android',
        mb_id: member?.mb_id ?? undefined,
      })
    } catch {
      // 비로그인/네트워크 실패 — 다음 부팅 / 로그인 시 재시도
    }
  }

  // 3) 토픽 구독/해제 — sample push_topic_update 와 동일한 시퀀스
  if (typeof bridge.fcmTopicUpdate === 'function') {
    if (member) {
      const sub = topicsForMember(member)
      const unsub = ALL_AUTH_TOPICS.filter((t) => !sub.includes(t))
      bridge.fcmTopicUpdate(sub, unsub)
    } else {
      // 비로그인 → 모두 해제
      bridge.fcmTopicUpdate([], ALL_AUTH_TOPICS)
    }
  }
}
