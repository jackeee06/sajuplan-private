import { useEffect, useRef, useState } from 'react'
import { useDismissOnBack } from '../lib/use-dismiss-on-back'

/**
 * 쿠폰번호로 사용하기 모달 — Figma 128:15905
 *
 * 구조:
 *  - 헤더: "쿠폰번호로 사용하기" + 우측 X
 *  - 구분선
 *  - 라벨: "사용하실 쿠폰번호를 입력해주세요." (검정 굵음)
 *  - 4-4-4-4 input (가운데 - 구분자)
 *  - 안내 박스 (회색 bg, ! 아이콘): "쿠폰을 사용하시면 포인트로 바로 적립됩니다."
 *  - "사용" 버튼 (보라 채움, 가운데, mid 너비)
 *
 * 16자리 모두 채워지면 onSubmit(code) 호출하고 닫힘.
 */
interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (code: string) => void
  /** 등록 실패 시 모달 내 인라인 에러 메시지 */
  error?: string | null
  submitting?: boolean
}

export default function CouponRegisterModal({ open, onClose, onSubmit, error, submitting }: Props) {
  const [parts, setParts] = useState<string[]>(['', '', '', ''])
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useDismissOnBack(open, onClose)

  useEffect(() => {
    if (!open) setParts(['', '', '', ''])
  }, [open])

  if (!open) return null

  const onPartChange = (idx: number, value: string) => {
    const v = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
    setParts((prev) => {
      const next = [...prev]
      next[idx] = v
      return next
    })
    if (v.length === 4 && idx < 3) {
      refs.current[idx + 1]?.focus()
    }
  }

  const code = parts.join('-')
  const filled = parts.every((p) => p.length === 4)

  const handleSubmit = () => {
    if (!filled) return
    onSubmit(code)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: 'rgba(0, 0, 0, 0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[360px] bg-white rounded-[20px] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-bold text-[#1E2939]">쿠폰번호로 사용하기</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="w-7 h-7 flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" aria-hidden>
              <path d="M6 6L18 18M6 18L18 6" stroke="#1E2939" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mt-3 -mx-5 border-t border-[#F3F4F6]" />

        <p className="mt-4 text-[15px] font-bold text-[#1E2939]">
          사용하실 쿠폰번호를 입력해주세요.
        </p>

        <div className="mt-3 flex items-center gap-2">
          {parts.map((p, idx) => (
            <div key={idx} className="contents">
              <input
                ref={(el) => {
                  refs.current[idx] = el
                }}
                type="text"
                value={p}
                onChange={(e) => onPartChange(idx, e.target.value)}
                maxLength={4}
                className="w-0 flex-1 h-10 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] text-center text-[14px] font-medium text-[#1E2939] focus:outline-none focus:border-[#f472b6]"
              />
              {idx < 3 && <span className="text-[#99A1AF]">-</span>}
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-[10px] bg-[#F9FAFB] px-3 py-3 flex items-start gap-2">
          <svg viewBox="0 0 24 24" className="w-4 h-4 mt-0.5 shrink-0" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="#99A1AF" strokeWidth="1.4" />
            <path d="M12 7.5V13" stroke="#99A1AF" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="12" cy="16.5" r="1" fill="#99A1AF" />
          </svg>
          <p className="text-[13px] leading-[150%] text-[#4A5565]">
            쿠폰을 사용하시면 코인으로 바로 적립됩니다.
          </p>
        </div>

        {error && (
          <p className="mt-3 text-[13px] text-[#FB2C36] leading-[140%]">{error}</p>
        )}

        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!filled || !!submitting}
            className={`h-11 px-12 rounded-full text-[15px] font-medium text-white transition ${
              filled && !submitting ? 'bg-[#f472b6]' : 'bg-[#f472b6]/60 cursor-not-allowed'
            }`}
          >
            {submitting ? '처리 중…' : '사용'}
          </button>
        </div>
      </div>
    </div>
  )
}
