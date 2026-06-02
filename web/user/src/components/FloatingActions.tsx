/**
 * FloatingActions — go_top + kakao_btn 우측 하단 클러스터
 * Figma 84:6771 / 163:16669 / 84:6798 (Frame 1410129515)
 *
 * 카카오 1:1 상담 URL은 어드민 site_setting의 `site.kakao_channel_url`에서 가져옴.
 * 모듈 레벨 캐시로 한 번 fetch하면 페이지 이동해도 재요청 없음.
 *
 * bottomOffset: BottomNav 위에 띄우려면 100, 없으면 16 정도.
 */
import { useEffect, useState } from 'react'
import { settingsApi } from '../lib/api'
import { openExternalUrl } from '../lib/native-bridge'

let cachedKakaoUrl: string | null = null
let kakaoUrlPromise: Promise<string> | null = null

function loadKakaoUrl(): Promise<string> {
  if (cachedKakaoUrl !== null) return Promise.resolve(cachedKakaoUrl)
  if (kakaoUrlPromise) return kakaoUrlPromise
  kakaoUrlPromise = settingsApi
    .public()
    .then((r) => {
      cachedKakaoUrl = r['site.kakao_channel_url'] || ''
      return cachedKakaoUrl
    })
    .catch(() => {
      cachedKakaoUrl = ''
      return ''
    })
  return kakaoUrlPromise
}

interface Props {
  /** 하단 여유. BottomNav 있으면 100, 없으면 16. 기본 100. */
  bottomOffset?: number
  /** 카카오 채널 URL을 직접 지정(override). 비우면 어드민 site_setting에서 자동 로드. */
  kakaoUrl?: string
  /** 카카오 버튼 표시 여부. Figma 후기 상세 등 일부 페이지는 go_top만 노출. 기본 true. */
  showKakao?: boolean
}

export default function FloatingActions({ bottomOffset = 100, kakaoUrl, showKakao = true }: Props) {
  const [resolvedUrl, setResolvedUrl] = useState<string>(kakaoUrl ?? cachedKakaoUrl ?? '')

  useEffect(() => {
    if (kakaoUrl) {
      setResolvedUrl(kakaoUrl)
      return
    }
    let mounted = true
    loadKakaoUrl().then((u) => {
      if (mounted) setResolvedUrl(u)
    })
    return () => {
      mounted = false
    }
  }, [kakaoUrl])
  return (
    <div
      className="fixed right-4 z-40 flex flex-col gap-2"
      style={{ bottom: bottomOffset }}
    >
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="위로 가기"
        className="w-[50px] h-[50px] rounded-full border border-[#F9FAFB] backdrop-blur-[6px] flex items-center justify-center"
        style={{ background: 'rgba(243, 244, 246, 0.8)' }}
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#030712" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19V5" />
          <path d="M5 12l7-7 7 7" />
        </svg>
      </button>
      {showKakao && resolvedUrl && (
        <button
          type="button"
          onClick={() => openExternalUrl(resolvedUrl)}
          aria-label="카카오톡 문의"
          className="w-[50px] h-[50px] rounded-full bg-[#ec4899] flex items-center justify-center"
          style={{
            boxShadow:
              '0px 4px 6px -2px rgba(130, 89, 245, 0.1), 0px 10px 15px -3px rgba(130, 89, 245, 0.15)',
          }}
        >
          <svg viewBox="0 0 18 18" className="w-[22px] h-[22px]" fill="none" aria-hidden>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M9 0.6C4.02917 0.6 0 3.71293 0 7.55226C0 9.94 1.5584 12.0449 3.93152 13.2969L2.93303 16.9445C2.84481 17.2668 3.21341 17.5237 3.49646 17.3369L7.87334 14.4482C8.2427 14.4838 8.61808 14.5046 9 14.5046C13.9705 14.5046 17.9999 11.3918 17.9999 7.55226C17.9999 3.71293 13.9705 0.6 9 0.6Z"
              fill="white"
            />
          </svg>
        </button>
      )}
    </div>
  )
}
