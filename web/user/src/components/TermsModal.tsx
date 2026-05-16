import { useEffect, useState } from 'react'
import { CloseIcon } from './icons'
import { useDismissOnBack } from '../lib/use-dismiss-on-back'

export type TermsKind = 'terms' | 'privacy'

interface Props {
  kind: TermsKind | null
  onClose: () => void
}

const FALLBACK_TITLES: Record<TermsKind, string> = {
  terms: '회원가입약관',
  privacy: '개인정보처리방침',
}

interface PageResp {
  slug: string
  title: string
  content: string
  use_html: boolean
}

/**
 * 약관/개인정보처리방침 모달 — Figma node 16:50398
 * 본문은 /api/user/pages/{terms|privacy} 에서 fetch.
 * 어드민 → 콘텐츠 관리에서 수정 가능.
 */
export default function TermsModal({ kind, onClose }: Props) {
  useDismissOnBack(kind !== null, onClose)
  const [data, setData] = useState<PageResp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!kind) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [kind])

  useEffect(() => {
    if (!kind) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)
    fetch(`/api/user/pages/${kind}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const j: PageResp = await r.json()
        if (!cancelled) setData(j)
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : '로딩 실패'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [kind])

  if (!kind) return null

  const title = data?.title ?? FALLBACK_TITLES[kind]

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-[420px] max-h-[85vh] bg-white rounded-t-2xl sm:rounded-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-[18px] font-semibold text-[#030712]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="w-8 h-8 flex items-center justify-center -mr-1">
            <CloseIcon />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 pb-6 text-[14px] leading-[1.7] text-[#374151]">
          {loading ? (
            <div className="py-10 text-center text-[#9CA3AF]">로딩...</div>
          ) : error ? (
            <div className="py-10 text-center text-[#DC2626]">불러오기 실패 — {error}</div>
          ) : data?.use_html ? (
            <div dangerouslySetInnerHTML={{ __html: data.content }} />
          ) : (
            <div className="whitespace-pre-line">{data?.content ?? ''}</div>
          )}
        </div>
      </div>
    </div>
  )
}
