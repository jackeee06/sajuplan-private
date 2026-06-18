import { useEffect, useState } from 'react'
import { appVersionApi } from '../lib/api'

/**
 * 서포터즈(모집인) 모바일웹 — "바탕화면 바로가기(북마크)" 안내 크롬.
 *
 * 방향(2026-06-18 재정비): PWA/WebAPK 설치 방식 폐기.
 *  - 이유: 안드로이드에서 PWA 를 홈에 추가하면 크롬이 WebAPK(미니 앱)를 만드는데,
 *          일부 기기 Google Play 프로텍트가 "안전하지 않은 앱"으로 오인 경고 → 일반인 모집인 이탈 위험.
 *  - 대신 그냥 **홈 화면 바로가기(북마크)**: 경고 없음 + 안드/iOS 동일(구분 불필요).
 *    바탕화면 아이콘은 똑같이 생기고, 누르면 모바일웹으로 바로 열림(브라우저).
 *
 * 구성:
 *  - 홈 아이콘 이미지용 apple-touch-icon 만 주입(서포터즈 페이지 한정, 언마운트 시 제거).
 *  - "바탕화면에 아이콘 추가" 버튼 → 안드/iOS 공통 안내 모달(브라우저 메뉴 → '홈 화면에 추가').
 *  - 카카오 인앱 브라우저면 기본 브라우저로 유도(인앱에선 '홈 화면에 추가'가 안 되므로).
 *  - 하단 "사주플랜앱 다운로드" 링크.
 *
 * ※ 북마크는 추가 순간을 OS 가 안 알려줘서 "추가되었습니다" 자동 확인은 불가(대신 경고도 없음). 표기는 전부 "서포터즈".
 */

const FALLBACK_AOS = 'https://play.google.com/store/apps/details?id=com.dmonster.sajumoon'
const FALLBACK_IOS = 'https://apps.apple.com/kr/app/id6761353255'

const KAKAO_ESCAPE_FLAG = 'supporter_kakao_escape_tried'
const KAKAO_BANNER_FLAG = 'supporter_kakao_banner_dismissed'

function isAndroid(): boolean {
  return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '')
}
function isIOS(): boolean {
  return typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent || '')
}
function isKakaoInApp(): boolean {
  return typeof navigator !== 'undefined' && /KAKAOTALK/i.test(navigator.userAgent || '')
}

export default function SupporterAppChrome() {
  const kakao = isKakaoInApp()

  // ── 북마크/홈화면 바로가기 이름·아이콘 (서포터즈 페이지에서만) ──
  //   ★ 안드로이드(삼성인터넷/크롬)의 "홈 화면에 추가" 바로가기 이름은 **manifest** 가 결정한다(document.title 아님).
  //   기본 전역 site.webmanifest 는 name "사주플랜" + display "standalone" 이라
  //     ① 바로가기 이름이 "사주플랜" 으로 뜨고
  //     ② display:standalone 이라 WebAPK 가 생겨 Google Play 프로텍트 "안전하지 않은 앱" 경고까지 유발.
  //   → 서포터즈 페이지에선 manifest 를 /promoter.webmanifest(name "사주플랜 서포터즈" + display "browser") 로 교체.
  //     display:browser = WebAPK 안 만듦(경고 없음) + 바로가기 이름은 "사주플랜 서포터즈". 언마운트 시 원복(메인 무영향).
  useEffect(() => {
    const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null
    const prevManifestHref = manifestLink ? manifestLink.getAttribute('href') : null
    let createdManifest: HTMLLinkElement | null = null
    if (manifestLink) {
      manifestLink.setAttribute('href', '/promoter.webmanifest')
    } else {
      createdManifest = document.createElement('link')
      createdManifest.setAttribute('rel', 'manifest')
      createdManifest.setAttribute('href', '/promoter.webmanifest')
      createdManifest.setAttribute('data-supporter-pwa', '1')
      document.head.appendChild(createdManifest)
    }

    // document.title 도 백업으로 변경(manifest 무시하고 제목 쓰는 브라우저 대비)
    const prevTitle = document.title
    document.title = '사주플랜 서포터즈'

    return () => {
      document.title = prevTitle
      if (manifestLink && prevManifestHref) manifestLink.setAttribute('href', prevManifestHref)
      if (createdManifest && createdManifest.parentNode) createdManifest.parentNode.removeChild(createdManifest)
    }
  }, [])

  // ── 카카오톡 인앱 → 기본 브라우저 (안드로이드: 자동 1회) ──
  //   인앱 브라우저에선 '홈 화면에 추가' 메뉴가 없거나 동작 안 함 → 기본 브라우저로 빼줘야 함.
  useEffect(() => {
    if (!kakao || !isAndroid()) return
    try {
      if (sessionStorage.getItem(KAKAO_ESCAPE_FLAG) === '1') return
      sessionStorage.setItem(KAKAO_ESCAPE_FLAG, '1')
    } catch {
      /* ignore */
    }
    window.location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(window.location.href)
  }, [kakao])

  // ── 카카오 인앱(iOS) 안내 배너 — 애플 정책상 자동 전환 불가 ──
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(KAKAO_BANNER_FLAG) === '1'
    } catch {
      return false
    }
  })
  const showKakaoBanner = kakao && isIOS() && !bannerDismissed
  const dismissBanner = () => {
    setBannerDismissed(true)
    try {
      sessionStorage.setItem(KAKAO_BANNER_FLAG, '1')
    } catch {
      /* ignore */
    }
  }

  // ── 바탕화면 바로가기 안내 모달 (안드/iOS 공통) ──
  const [guideOpen, setGuideOpen] = useState(false)

  // ── 스토어 링크 ──
  const [aos, setAos] = useState(FALLBACK_AOS)
  const [ios, setIos] = useState(FALLBACK_IOS)
  useEffect(() => {
    appVersionApi
      .get()
      .then((v) => {
        if (v.aos_store_url) setAos(v.aos_store_url)
        if (v.ios_store_url) setIos(v.ios_store_url)
      })
      .catch(() => undefined)
  }, [])
  return (
    <>
      {/* 카카오 인앱(iOS) 안내 배너 — 상단 고정 */}
      {showKakaoBanner && (
        <div className="fixed top-0 left-1/2 -translate-x-1/2 z-[60] w-full max-w-[600px] px-3 pt-3">
          <div className="flex items-start gap-2 rounded-[16px] bg-[#fdf2f8] border border-[#fbcfe8] shadow-[0_4px_16px_rgba(236,72,153,0.18)] px-4 py-3">
            <span className="text-[18px] leading-none mt-0.5">🌐</span>
            <p className="flex-1 text-[13px] leading-[160%] text-[#1E2939]">
              더 편하게 쓰려면 <span className="font-semibold text-[#ec4899]">기본 브라우저</span>로 열어주세요.
              <br />
              오른쪽 위 <span className="font-semibold">⋯</span> → <span className="font-semibold">다른 브라우저로 열기</span>
            </p>
            <button
              type="button"
              onClick={dismissBanner}
              aria-label="안내 닫기"
              className="shrink-0 -mr-1 -mt-0.5 w-7 h-7 flex items-center justify-center text-[#99A1AF] text-[18px] leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* 이 화면(모바일웹) 바로가기 — 원하는 사람만. "아이콘 추가"(앱처럼 들림) 대신 "바로가기" + 대상 명시 */}
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          className="w-full h-11 flex items-center justify-center gap-2 rounded-full bg-white border border-[#f3c6dd] text-[#ec4899] text-[14px] font-medium hover:bg-[#fdf2f8] transition"
        >
          <span className="text-[16px] leading-none">📲</span>
          서포터즈 화면 바로가기 추가
        </button>
        <p className="text-[11.5px] leading-[150%] text-[#99A1AF] text-center">
          앱 설치 없이, 이 화면을 홈 화면에 저장해요
        </p>
      </div>

      {/* 구분 — 위(웹 바로가기) vs 아래(정식 앱)는 다른 것 */}
      <div className="flex items-center gap-3">
        <span className="flex-1 h-px bg-[#f3f4f6]" />
        <span className="text-[11px] text-[#c0c4cc]">또는</span>
        <span className="flex-1 h-px bg-[#f3f4f6]" />
      </div>

      {/* 사주플랜 정식 앱 — 공식 스토어 배지 (웹 바로가기와 별개) */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-[12px] text-[#99A1AF]">사주플랜 정식 앱이 필요하면</p>
        <div className="flex gap-2 w-full">
          <StoreBadge href={ios} kind="ios" />
          <StoreBadge href={aos} kind="aos" />
        </div>
      </div>

      {/* 바탕화면 바로가기 안내 모달 (안드/iOS 동일) */}
      {guideOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/30 flex items-center justify-center px-6"
          onClick={() => setGuideOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-[330px] bg-white rounded-2xl px-5 pt-6 pb-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[16px] font-semibold text-[#030712] text-center mb-1">
              서포터즈 화면 바로가기 추가
            </h2>
            <p className="text-[13px] leading-[160%] text-[#6A7282] text-center mb-4">
              브라우저 메뉴에서 2단계면 끝나요.
            </p>
            <ol className="flex flex-col gap-3 mb-5">
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-[#fdf2f8] text-[#ec4899] text-[13px] font-bold flex items-center justify-center">
                  1
                </span>
                <span className="text-[14px] leading-[150%] text-[#1E2939]">
                  브라우저 메뉴 <span className="font-semibold">⋮</span> 열기
                  <br />
                  <span className="text-[12px] text-[#6A7282]">
                    메뉴 버튼은 브라우저마다 화면 <span className="font-semibold">위 또는 아래</span>에 있어요 (아이폰은 <span className="font-semibold">공유 아이콘 􀈂</span>)
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-[#fdf2f8] text-[#ec4899] text-[13px] font-bold flex items-center justify-center">
                  2
                </span>
                <span className="text-[14px] leading-[150%] text-[#1E2939]">
                  <span className="font-semibold">'홈 화면에 추가'</span> 선택
                </span>
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setGuideOpen(false)}
              className="w-full h-12 rounded-full bg-[#ec4899] text-white text-[15px] font-medium hover:opacity-90 transition"
            >
              알겠어요
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/** 공식 스토어 배지 (App Store / Google Play) — 검정 라운드 + 로고 + 2줄 텍스트 */
function StoreBadge({ href, kind }: { href: string; kind: 'ios' | 'aos' }) {
  return (
    <a
      href={href}
      className="flex-1 flex items-center justify-center gap-2 h-[46px] rounded-[10px] bg-black px-2.5 text-white active:opacity-90 transition"
    >
      {kind === 'ios' ? (
        <svg width="17" height="17" viewBox="0 0 384 512" fill="#fff" aria-hidden="true">
          <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3.6 1.8 13.8 12 3.6 22.2a1 1 0 0 1-.3-.7V2.5c0-.27.1-.52.3-.7z" fill="#00C3FF" />
          <path d="M16.85 8.6l2.79 1.62c1.18.68 1.18 2.36 0 3.04l-2.79 1.61L13.8 12l3.05-3.4z" fill="#FFC400" />
          <path d="M3.6 1.8a1 1 0 0 1 1.05-.08l11.16 6.44L12.84 11 3.6 1.8z" fill="#00D26A" />
          <path d="M12.84 13L15.81 16l-11.16 6.44a1 1 0 0 1-1.05-.08L12.84 13z" fill="#FF3D00" />
        </svg>
      )}
      <span className="flex flex-col leading-none text-left">
        <span className="text-[8.5px] opacity-80">다운로드</span>
        <span className="text-[13.5px] font-semibold mt-[3px]">{kind === 'ios' ? 'App Store' : 'Google Play'}</span>
      </span>
    </a>
  )
}
