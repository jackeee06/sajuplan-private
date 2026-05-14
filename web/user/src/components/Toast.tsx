import { useEffect } from 'react'

interface Props {
  open: boolean
  message: string
  /** 자동 종료까지 밀리초 (기본 2200ms) */
  durationMs?: number
  onClose: () => void
}

/**
 * 짧은 안내 토스트 — 모달과 달리 사용자 액션 없이 자동 사라짐.
 *  - 단골 추가/해제, 정보 저장 완료 등 가벼운 알림용.
 *  - 화면 상단 가운데, 어두운 캡슐 스타일 (디자인 시스템 토큰).
 */
export default function Toast({ open, message, durationMs = 2200, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const t = setTimeout(onClose, durationMs)
    return () => clearTimeout(t)
  }, [open, durationMs, onClose])

  if (!open) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-[80px] left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-full bg-[#1F2937] text-white text-[14px] leading-[140%] shadow-[0_4px_20px_rgba(0,0,0,0.2)] pointer-events-none whitespace-nowrap"
    >
      {message}
    </div>
  )
}
