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
 * Open a URL outside the WebView. In the native app this hands off to the
 * OS via Linking.openURL (Kakao app for kakao://, system browser for https://).
 * On web it falls back to window.open / direct navigation.
 */
export function openExternalUrl(url: string): void {
  if (!url) return
  const bridge = typeof window !== 'undefined' ? window.SajumoonBridge : undefined
  if (bridge?.isNative && typeof bridge.openExternal === 'function') {
    bridge.openExternal(url)
    return
  }
  const w = window.open(url, '_blank', 'noopener,noreferrer')
  if (!w) window.location.href = url
}
