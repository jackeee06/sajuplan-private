import { useEffect } from 'react'
import { useDismissOnBack } from '../lib/use-dismiss-on-back'

interface Props {
  open: boolean
  /** 표시할 메시지 — \n 으로 줄바꿈 */
  message: string
  /** 선택 — 없으면 메시지만 표시 */
  title?: string
  /** 확인 버튼 라벨 */
  confirmLabel?: string
  /** 확인 클릭 / 백드롭 클릭 / Esc 시 호출 */
  onClose: () => void
}

/**
 * 단일 확인 버튼 알림 모달 — `window.alert()` 대체.
 * TermsModal 과 동일한 백드롭·카드 패턴을 따르고, 버튼은 PrimaryButton 디자인 토큰을 그대로 사용.
 */
export default function AlertModal({
  open,
  message,
  title,
  confirmLabel = '확인',
  onClose,
}: Props) {
  useDismissOnBack(open, onClose)
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center px-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-[320px] bg-white rounded-2xl px-5 pt-6 pb-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 className="text-[16px] font-semibold text-[#030712] text-center mb-2">
            {title}
          </h2>
        )}
        <p className="text-[15px] leading-[1.55] text-[#1E2939] text-center whitespace-pre-line mt-1 mb-5">
          {message}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-full h-12 rounded-full bg-[#8259F5] text-white text-[15px] font-medium hover:opacity-90 transition"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
