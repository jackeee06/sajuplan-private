/**
 * Helpers for talking to the native shell (RN WebView).
 *
 * These are no-ops on plain mobile web / desktop browsers — the SajumoonBridge
 * global only exists when running inside the native app's WebView.
 */

type SajumoonBridge = {
  isNative?: boolean
  platform?: 'android' | 'ios' | string
  openExternal?: (url: string) => void
  closeApp?: () => void
  pickImage?: (
    source?: 'camera' | 'gallery' | 'auto',
  ) => Promise<{ uri: string; mime: string; fileName?: string }>
  onBackPressed?: (
    handler: ((info: { url: string; path: string }) => boolean) | null,
  ) => void
  fcmGetToken?: () => Promise<string | null>
  fcmTopicUpdate?: (subscribe: string[], unsubscribe: string[]) => void
}

declare global {
  interface Window {
    SajumoonBridge?: SajumoonBridge
  }
}

export function isNativeApp(): boolean {
  return typeof window !== 'undefined' && !!window.SajumoonBridge?.isNative
}

/**
 * pf.kakao.com URL → kakaoplus:// scheme 변환.
 * kakaoplus:// 은 KakaoTalk 채널 전용 scheme으로 Android/iOS 동일하게 동작한다.
 * kakaotalk:// (앱 전체 scheme) 이나 pf.kakao.com HTTPS (브라우저로 열림) 과 다름.
 */
function resolveKakaoUrl(url: string, platform: string | undefined): string {
  const m = url.match(/pf\.kakao\.com\/([^/?#\s]+)/)
  if (!m) return url
  if (platform !== 'android' && platform !== 'ios') return url
  return `kakaoplus://plusfriend/home/${m[1]}`
}

/**
 * Open a URL outside the WebView. In the native app this hands off to the
 * OS via Linking.openURL (Kakao app for kakao://, system browser for https://).
 * pf.kakao.com 채널 URL은 kakaoplus:// scheme으로 자동 변환해 KakaoTalk 앱으로 직접 실행.
 * On web it falls back to window.open / direct navigation.
 */
export function openExternalUrl(url: string): void {
  if (!url) return
  const bridge = typeof window !== 'undefined' ? window.SajumoonBridge : undefined
  if (bridge?.isNative && typeof bridge.openExternal === 'function') {
    bridge.openExternal(resolveKakaoUrl(url, bridge.platform))
    return
  }
  const w = window.open(url, '_blank', 'noopener,noreferrer')
  if (!w) window.location.href = url
}
