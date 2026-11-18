/**
 * 앱 유입 깔때기 — 검색 페널티 없는(SEO-안전) 행동 게이트.
 *
 * 정책(2026-06-25): "콘텐츠는 웹에서도 보이게, 실제 상담 행동(전화·채팅)은 앱에서만".
 *  - 콘텐츠(상담사 프로필·소개·후기)는 그대로 노출 → 클로킹/전면팝업 페널티 없음.
 *  - 행동(상담 시작)을 누르는 순간에만 "앱에서 상담하세요" 안내 → 앱 유도.
 *
 * 하드 전체화면 차단(WebAppGate, WEB_OPEN=false)은 클로킹+전면팝업 페널티 위험으로 폐기.
 */
import { isNativeApp } from './native-bridge'

/**
 * 앱 전용 행동(전화·채팅 상담 등)을 웹에서 막아 앱으로 유도해야 하는가?
 *  - 앱 WebView 안 → false(통과, 정상 동작)
 *  - 자동화 브라우저(E2E Playwright) → false(테스트 안 깨지게)
 *  - 운영자 수동허용(localStorage __allow_web__='1') → false(브라우저 점검용)
 *  그 외 일반 웹 브라우저 → true(앱 유도)
 *
 * WebAppGate.shouldGate() 의 예외 규칙과 동일하게 맞춤.
 */
export function shouldGateAppAction(): boolean {
  if (typeof window === 'undefined') return false
  if (isNativeApp()) return false
  try {
    if (navigator.webdriver) return false
    if (localStorage.getItem('__allow_web__') === '1') return false
  } catch {
    /* ignore */
  }
  return true
}

/** 모바일 OS 판별 — 스토어 버튼 분기용. */
export function detectMobileOS(): 'ios' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent || ''
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'other'
}

/** 스토어 URL 폴백 — WebAppGate 와 동일 출처(실값은 /api/app/version 에서 덮어씀). */
export const STORE_FALLBACK_AOS =
  'https://play.google.com/store/apps/details?id=com.dmonster.sajumoon'
export const STORE_FALLBACK_IOS = 'https://apps.apple.com/kr/app/id6761353255'
