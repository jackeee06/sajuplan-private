import { useEffect, useState } from 'react'
import { appVersionApi } from '../lib/api'
import { detectMobileOS, STORE_FALLBACK_AOS, STORE_FALLBACK_IOS } from '../lib/app-gate'

/**
 * 앱 유도 바텀시트 — 웹에서 전화·채팅 상담을 누르면 띄운다.
 *
 * 정책(2026-06-25): 콘텐츠(프로필)는 웹에서도 보이되, 실제 상담 행동은 앱에서만.
 *  여기서 손님 의도가 가장 높으므로(상담 누른 순간) 앱 설치/실행으로 유도.
 *  하드 전체화면 차단이 아니라 "행동 시점 안내"라 검색 페널티 없음.
 *
 * 스타일: ShareBottomSheet 와 동일한 바텀시트 골격(슬라이드업, max-w 600).
 */

interface Props {
  open: boolean
  onClose: () => void
  /** 어떤 상담을 시도했는지 — 문구 분기 */
  variant?: 'phone' | 'chat'
  /** 미리보기용 상담사 정보(선택) */
  counselorName?: string | null
  avatarUrl?: string | null
}

export default function AppRequiredSheet({ open, onClose, variant = 'phone', counselorName, avatarUrl }: Props) {
  const [aos, setAos] = useState(STORE_FALLBACK_AOS)
  const [ios, setIos] = useState(STORE_FALLBACK_IOS)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    appVersionApi
      .get()
      .then((v) => {
        if (v.aos_store_url) setAos(v.aos_store_url)
        if (v.ios_store_url) setIos(v.ios_store_url)
      })
      .catch(() => undefined)
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const os = detectMobileOS()
  const storeUrl = os === 'ios' ? ios : aos // PC/안드는 Play, iOS는 App Store
  const actionWord = variant === 'chat' ? '채팅 상담' : '전화 상담'

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[100]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="앱에서 상담하기"
        data-testid="app-required-sheet"
        className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-[600px] bg-white rounded-t-[20px] z-[101] pb-[max(24px,env(safe-area-inset-bottom))]"
        style={{ animation: 'slideUp 0.2s ease-out' }}
      >
        {/* 손잡이 바 */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-[40px] h-[4px] rounded-full bg-[#E5E7EB]" />
        </div>

        {/* 앱 아이콘 + 안내 */}
        <div className="px-6 pt-2 flex flex-col items-center text-center">
          <img
            src="/img/android-chrome-512x512.png"
            alt="사주플랜"
            className="w-[64px] h-[64px] rounded-[18px] shadow-[0_8px_22px_rgba(155,122,247,0.28)]"
          />
          <h2 className="text-[18px] font-bold text-[#030712] mt-4">앱에서 상담할 수 있어요</h2>
          <p className="text-[14px] leading-[160%] text-[#6A7282] mt-2">
            {counselorName ? (
              <>
                <span className="font-semibold text-[#ec4899]">{counselorName}</span> 상담사와의 {actionWord}은
                <br />
              </>
            ) : (
              <>{actionWord}은 </>
            )}
            사주플랜 앱에서 안전하고 빠르게 진행돼요 🐈
          </p>

          {/* 상담사 미리보기 (있으면) */}
          {(counselorName || avatarUrl) && (
            <div className="mt-5 w-full px-4 py-3 rounded-[12px] bg-[#fdf2f8] flex items-center gap-3">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white shrink-0" />
              )}
              <div className="flex flex-col min-w-0 text-left">
                <span className="text-[13px] text-[#ec4899] font-medium">사주플랜 상담사</span>
                <span className="text-[14px] text-[#030712] font-semibold truncate">{counselorName}</span>
              </div>
            </div>
          )}
        </div>

        {/* 스토어 버튼 */}
        <div className="px-5 mt-6 flex flex-col gap-2.5">
          <a
            href={storeUrl}
            className="h-[52px] rounded-[14px] bg-[#9b7af7] text-white text-[15px] font-semibold flex items-center justify-center"
            data-testid="app-required-store-btn"
          >
            {os === 'ios' ? 'App Store 에서 앱 받기' : 'Google Play 에서 앱 받기'}
          </a>
          <button
            type="button"
            onClick={onClose}
            className="h-[48px] rounded-[14px] text-[14px] font-medium text-[#6A7282]"
          >
            다음에 할게요
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translate(-50%, 100%); }
          to { transform: translate(-50%, 0); }
        }
      `}</style>
    </>
  )
}
