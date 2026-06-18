import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { isNativeApp } from '../lib/native-bridge'
import { appVersionApi } from '../lib/api'

/**
 * [2026-06-12] 일반 브라우저 접근 게이트 (앱 전용 서비스).
 *
 * 사주플랜은 앱(RN WebView) 으로 이용하는 서비스. 일반 PC/모바일 브라우저로 sajuplan.com 에
 * 직접 들어오면 "앱에서 이용해주세요 + 스토어 링크" 안내 전체화면을 띄운다.
 *
 * 통과(게이트 안 띄움) 조건:
 *   - 앱 WebView (isNativeApp) — 정상 이용
 *   - 자동화 브라우저 (navigator.webdriver, 예: Playwright E2E) — 테스트 깨지지 않게
 *   - 수동 허용 (localStorage __allow_web__ = '1') — 운영자가 브라우저로 점검할 때
 *
 * 스토어 링크는 /api/app/version (setting namespace='app') 단일 출처. 강제업데이트와 같은 값.
 */

const FALLBACK_AOS = 'https://play.google.com/store/apps/details?id=com.dmonster.sajumoon'
const FALLBACK_IOS = 'https://apps.apple.com/kr/app/id6761353255'

function shouldGate(): boolean {
  if (typeof window === 'undefined') return false
  if (isNativeApp()) return false
  if (navigator.webdriver) return false
  // 모집인(서포터즈) 랜딩(/s/:code) · 대시보드(/promoter) 는 앱이 없는
  // 모집인·피모집자가 일반 브라우저에서 여는 화면이므로 게이트 예외.
  const path = window.location.pathname
  if (path.startsWith('/s/') || path === '/promoter' || path.startsWith('/promoter/')) {
    return false
  }
  try {
    if (localStorage.getItem('__allow_web__') === '1') return false
  } catch {
    /* ignore */
  }
  return true
}

function detectOS(): 'ios' | 'android' | 'other' {
  const ua = navigator.userAgent || ''
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'other'
}

export default function WebAppGate() {
  const [gate] = useState(shouldGate)
  const [aos, setAos] = useState(FALLBACK_AOS)
  const [ios, setIos] = useState(FALLBACK_IOS)

  useEffect(() => {
    if (!gate) return
    appVersionApi
      .get()
      .then((v) => {
        if (v.aos_store_url) setAos(v.aos_store_url)
        if (v.ios_store_url) setIos(v.ios_store_url)
      })
      .catch(() => undefined)
  }, [gate])

  if (!gate) return null
  const os = detectOS()
  const showAos = os === 'android' || os === 'other'
  const showIos = os === 'ios' || os === 'other'

  return (
    <div
      className="fixed inset-0 z-[2000] bg-gradient-to-b from-[#f5f2ff] via-white to-white flex flex-col items-center justify-center px-8 text-center overflow-y-auto py-10"
      role="dialog"
      aria-modal="true"
      aria-label="앱에서 이용해주세요"
      data-testid="web-app-gate"
    >
      <img
        src="/img/android-chrome-512x512.png"
        alt="사주플랜"
        className="w-[100px] h-[100px] rounded-[24px] shadow-[0_10px_28px_rgba(155,122,247,0.28)]"
      />
      <h1 className="text-[20px] font-bold text-[#030712] mt-5">앱에서 이용해주세요</h1>
      <p className="text-[14px] leading-[160%] text-[#6A7282] mt-2">
        사주플랜은 전용 앱에서 더 안정적이고 빠르게
        <br />
        이용하실 수 있어요 🐈
      </p>

      {os === 'other' ? (
        // PC — QR 로 폰에서 바로 설치
        <div className="mt-7 flex flex-col items-center gap-3 bg-white rounded-[20px] shadow-[0_4px_18px_rgba(0,0,0,0.06)] border border-[#F3F4F6] px-7 py-6">
          <p className="text-[13px] text-[#6A7282]">📱 스마트폰 카메라로 QR을 찍어 설치하세요</p>
          <div className="flex gap-6 mt-1">
            <div className="flex flex-col items-center gap-2">
              <div className="p-2.5 bg-white rounded-[12px] border border-[#E5E7EB]">
                <QRCodeSVG value={aos} size={130} />
              </div>
              <span className="text-[13px] font-medium text-[#030712]">Google Play</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="p-2.5 bg-white rounded-[12px] border border-[#E5E7EB]">
                <QRCodeSVG value={ios} size={130} />
              </div>
              <span className="text-[13px] font-medium text-[#030712]">App Store</span>
            </div>
          </div>
        </div>
      ) : (
        // 모바일 브라우저 — 탭하면 바로 스토어
        <div className="flex flex-col gap-3 w-full max-w-[300px] mt-7">
          {showAos && (
            <a
              href={aos}
              className="h-[52px] rounded-[14px] bg-[#9b7af7] text-white text-[15px] font-semibold flex items-center justify-center"
            >
              Google Play 에서 받기
            </a>
          )}
          {showIos && (
            <a
              href={ios}
              className="h-[52px] rounded-[14px] border border-[#9b7af7] text-[#9b7af7] text-[15px] font-semibold flex items-center justify-center"
            >
              App Store 에서 받기
            </a>
          )}
        </div>
      )}
    </div>
  )
}
