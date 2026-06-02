import { useEffect, useState } from 'react'

declare global {
  interface Window {
    Kakao?: {
      isInitialized: () => boolean
      Share: {
        sendDefault: (opts: unknown) => void
      }
    }
  }
}

interface Props {
  open: boolean
  onClose: () => void
  shareUrl: string
  title: string
  description: string
  imageUrl?: string | null
}

export default function ShareBottomSheet({ open, onClose, shareUrl, title, description, imageUrl }: Props) {
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1800)
  }

  const handleKakao = () => {
    if (!window.Kakao || !window.Kakao.isInitialized()) {
      showToast('카카오 SDK 로딩 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }
    // 카카오 메시지 imageUrl 은 반드시 절대 URL 이어야 미리보기가 노출된다.
    const absImg = (() => {
      if (!imageUrl) return ''
      if (/^https?:\/\//.test(imageUrl)) return imageUrl
      if (typeof window !== 'undefined') return `${window.location.origin}${imageUrl}`
      return ''
    })()
    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title,
        description,
        imageUrl: absImg,
        link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
      },
    })
  }

  const handleInstagram = async () => {
    // 인스타그램은 공식 웹 공유 API 가 없어 링크를 클립보드에 복사 + 안내.
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = shareUrl
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    showToast('링크 복사 완료! 인스타그램에 붙여넣어주세요')
    // 모바일이면 인스타 앱 열기 시도 (실패해도 무해)
    if (/iPhone|iPad|Android/i.test(navigator.userAgent)) {
      setTimeout(() => { window.location.href = 'instagram://app' }, 800)
    }
  }

  const handleFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      '_blank',
      'noopener,width=600,height=500'
    )
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      showToast('링크가 복사되었습니다')
    } catch {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = shareUrl
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      showToast('링크가 복사되었습니다')
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-[100]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="공유하기"
        className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-[600px] bg-white rounded-t-[20px] z-[101] pb-[max(20px,env(safe-area-inset-bottom))]"
        style={{ animation: 'slideUp 0.2s ease-out' }}
      >
        {/* 손잡이 바 */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-[40px] h-[4px] rounded-full bg-[#E5E7EB]" />
        </div>

        {/* 타이틀 */}
        <div className="px-5 pb-4 text-center">
          <h2 className="text-[16px] font-semibold text-[#030712]">공유하기</h2>
        </div>

        {/* 상담사 프리뷰 카드 */}
        <div className="mx-4 mb-5 px-4 py-3 rounded-[12px] bg-[#fdf2f8] flex items-center gap-3">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-white shrink-0" />
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] text-[#ec4899] font-medium truncate">{description}</span>
            <span className="text-[14px] text-[#030712] font-semibold truncate">{title}</span>
          </div>
        </div>

        {/* 4채널 그리드 */}
        <div className="px-4 pb-4 grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={handleKakao}
            className="flex flex-col items-center gap-2 py-2"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <div className="w-[50px] h-[50px] rounded-full bg-[#FEE500] flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden>
                <path
                  fill="#3C1E1E"
                  d="M12 3C6.48 3 2 6.58 2 10.99c0 2.84 1.86 5.34 4.66 6.77-.2.7-.74 2.6-.85 3-.13.5.18.5.39.36.16-.11 2.55-1.73 3.58-2.43.74.1 1.5.16 2.22.16 5.52 0 10-3.58 10-7.86C22 6.58 17.52 3 12 3z"
                />
              </svg>
            </div>
            <span className="text-[12px] text-[#4A5565]">카카오톡</span>
          </button>

          <button
            type="button"
            onClick={handleInstagram}
            className="flex flex-col items-center gap-2 py-2"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <div
              className="w-[50px] h-[50px] rounded-[14px] flex items-center justify-center"
              style={{
                background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
              }}
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </div>
            <span className="text-[12px] text-[#4A5565]">인스타그램</span>
          </button>

          <button
            type="button"
            onClick={handleFacebook}
            className="flex flex-col items-center gap-2 py-2"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <div className="w-[50px] h-[50px] rounded-full bg-[#1877F2] flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden>
                <path
                  fill="white"
                  d="M24 12c0-6.63-5.37-12-12-12S0 5.37 0 12c0 5.99 4.39 10.95 10.13 11.85V15.47H7.08V12h3.05V9.36c0-3.01 1.79-4.67 4.53-4.67 1.31 0 2.69.23 2.69.23v2.96h-1.52c-1.49 0-1.96.93-1.96 1.88V12h3.33l-.53 3.47h-2.8v8.38C19.61 22.95 24 17.99 24 12z"
                />
              </svg>
            </div>
            <span className="text-[12px] text-[#4A5565]">페이스북</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="flex flex-col items-center gap-2 py-2"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <div className="w-[50px] h-[50px] rounded-full bg-[#E5E7EB] flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#4A5565" strokeWidth="2" aria-hidden>
                <rect x="9" y="9" width="11" height="11" rx="2" />
                <path d="M5 15V5a2 2 0 0 1 2-2h10" />
              </svg>
            </div>
            <span className="text-[12px] text-[#4A5565]">링크복사</span>
          </button>
        </div>
      </div>

      {toast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 bottom-[30%] z-[200] px-4 py-2 rounded-full bg-black/80 text-white text-[14px]"
          role="status"
        >
          {toast}
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translate(-50%, 100%); }
          to { transform: translate(-50%, 0); }
        }
      `}</style>
    </>
  )
}
