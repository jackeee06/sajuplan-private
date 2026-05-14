import { useEffect } from 'react'
import { CloseIcon } from './icons'
import { useDismissOnBack } from '../lib/use-dismiss-on-back'

export type TermsKind = 'terms' | 'privacy'

interface Props {
  kind: TermsKind | null
  onClose: () => void
}

const TITLES: Record<TermsKind, string> = {
  terms: '회원가입약관',
  privacy: '개인정보처리방침',
}

// TODO: 실제 약관 본문은 정책팀에서 제공받은 후 교체
const PLACEHOLDER_BODY = `(본문 준비 중)

본 약관/처리방침의 정식 본문은 정책팀에서 제공받아 추가 예정입니다.`

/**
 * 약관/개인정보처리방침 모달 — Figma node 16:50398
 * 화면 위에 떠 있는 카드 (배경 dim, 카드 white, 우상단 X 버튼)
 */
export default function TermsModal({ kind, onClose }: Props) {
  useDismissOnBack(kind !== null, onClose)
  useEffect(() => {
    if (!kind) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [kind])

  if (!kind) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={TITLES[kind]}
    >
      <div
        className="w-full max-w-[420px] max-h-[85vh] bg-white rounded-t-2xl sm:rounded-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-[18px] font-semibold text-[#030712]">{TITLES[kind]}</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="w-8 h-8 flex items-center justify-center -mr-1">
            <CloseIcon />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 pb-6 text-[14px] leading-[1.7] text-[#374151] whitespace-pre-line">
          {PLACEHOLDER_BODY}
        </div>
      </div>
    </div>
  )
}
