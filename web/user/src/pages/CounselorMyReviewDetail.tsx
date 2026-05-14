import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import FloatingActions from '../components/FloatingActions'
import {
  counselorMyReviewsApi,
  type CounselorReviewDetail,
} from '../lib/api'

/**
 * 08마이페이지_상담사_후기 상세
 * Figma node-id: 163:26352 (답변 있음) / 163:26385 (답변 없음)
 *
 * - 제목 + ⋮ / 보라체크 작성자 / 메타 / 본문 / 첨부 이미지
 * - 답변 N건 (수가 0이면 빈 상태) / 답변 입력란 / 목록으로
 */
export default function CounselorMyReviewDetail() {
  const navigate = useNavigate()
  const { id = '0' } = useParams<{ id: string }>()
  const reviewId = Number(id)

  const [review, setReview] = useState<CounselorReviewDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!reviewId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    counselorMyReviewsApi
      .detail(reviewId)
      .then((res) => {
        if (cancelled) return
        setReview(res)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message =
          err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
            ? String((err as { message: string }).message)
            : '후기를 불러오지 못했습니다.'
        setError(message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reviewId])

  const handleSubmit = async () => {
    const text = draft.trim()
    if (!text || submitting) return
    setSubmitting(true)
    try {
      const next = await counselorMyReviewsApi.createReply(reviewId, text)
      setReview(next)
      setDraft('')
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? String((err as { message: string }).message)
          : '답변 등록에 실패했습니다.'
      alert(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!review?.reply) return
    if (!confirm('답변을 삭제하시겠습니까?')) return
    try {
      await counselorMyReviewsApi.deleteReply(reviewId)
      const next = await counselorMyReviewsApi.detail(reviewId)
      setReview(next)
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? String((err as { message: string }).message)
          : '답변 삭제에 실패했습니다.'
      alert(message)
    }
  }

  if (loading) {
    return (
      <div className="mobile-frame flex flex-col pb-6">
        <Header onBack={() => navigate(-1)} />
        <p className="px-4 py-12 text-center text-[14px] text-[#6A7282]">불러오는 중...</p>
      </div>
    )
  }
  if (error || !review) {
    return (
      <div className="mobile-frame flex flex-col pb-6">
        <Header onBack={() => navigate(-1)} />
        <p className="px-4 py-12 text-center text-[14px] text-[#FF6467]">{error ?? '후기를 찾을 수 없습니다.'}</p>
      </div>
    )
  }

  const hasReply = !!review.reply
  const replyPostedAt = review.reply?.posted_at
    ? formatPostedAt(review.reply.posted_at)
    : ''

  return (
    <div className="mobile-frame flex flex-col pb-6">
      <Header onBack={() => navigate(-1)} />

      <main className="flex-1 px-4 pt-2">
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-[18px] font-bold leading-[140%] text-[#030712] break-keep">
            {review.title}
          </h2>
          <button type="button" aria-label="더보기" className="w-5 h-5">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" aria-hidden>
              <circle cx="12" cy="6" r="1.4" fill="#6A7282" />
              <circle cx="12" cy="12" r="1.4" fill="#6A7282" />
              <circle cx="12" cy="18" r="1.4" fill="#6A7282" />
            </svg>
          </button>
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
            <circle cx="8" cy="8" r="7" stroke="#9B7AF7" strokeWidth="1.4" />
            <path d="M5 8L7 10L11 6" stroke="#9B7AF7" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[14px] font-medium text-[#1E2939]">{review.customer_name}</span>
        </div>

        <p className="mt-1 text-[13px] leading-[140%] text-[#99A1AF]">
          {[review.consult_type, review.date, review.duration].filter(Boolean).join(' · ')}
        </p>

        <p className="mt-3 text-[15px] leading-[160%] text-[#1E2939] whitespace-pre-line">
          {review.content}
        </p>

        {review.img_url && (
          <div className="mt-4 w-full rounded-[16px] overflow-hidden bg-[#F3F4F6]">
            <img src={review.img_url} alt="" className="w-full h-auto object-cover" />
          </div>
        )}

        <div className="mt-6 border-t border-[#F3F4F6]" />

        <p className="mt-4 text-[14px] font-semibold text-[#1E2939]">
          {hasReply ? '상담 답변 ' : '답변목록 '}
          <span className="text-[#8259F5]">{hasReply ? 1 : 0}</span>건
        </p>

        {hasReply && review.reply ? (
          <div className="py-4 border-b border-[#F3F4F6]">
            <div className="flex items-start gap-2">
              <p className="flex-1 text-[15px] leading-[160%] text-[#1E2939] whitespace-pre-line">
                {review.reply.text}
              </p>
              <button
                type="button"
                aria-label="답변 삭제"
                onClick={handleDelete}
                className="w-5 h-5 shrink-0"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" aria-hidden>
                  <circle cx="12" cy="6" r="1.4" fill="#6A7282" />
                  <circle cx="12" cy="12" r="1.4" fill="#6A7282" />
                  <circle cx="12" cy="18" r="1.4" fill="#6A7282" />
                </svg>
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              {review.reply.profile_img ? (
                <img src={review.reply.profile_img} alt="" className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#F3F4F6]" />
              )}
              <p className="text-[13px] leading-[140%] text-[#99A1AF]">
                {review.reply.author} · {replyPostedAt}
              </p>
            </div>
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#F3EEFE] flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" aria-hidden>
                <path
                  d="M21 11.5C21 16.7467 16.9706 21 12 21C10.4 21 8.9 20.55 7.6 19.85L3 21L4.18 16.5C3.42 15.05 3 13.32 3 11.5C3 6.25 7.03 2 12 2C16.97 2 21 6.25 21 11.5Z"
                  stroke="#8259F5"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-[14px] text-[#6A7282]">등록된 답변이 없습니다.</p>
          </div>
        )}

        {!hasReply && (
          <div className="mt-4 relative">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSubmit()
                }
              }}
              placeholder="답변을 입력해주세요."
              disabled={submitting}
              className="w-full h-[44px] pl-4 pr-14 rounded-full bg-[#F9FAFB] border border-[#9B7AF7] text-[14px] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none disabled:opacity-60"
            />
            {draft.trim() && (
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting}
                aria-label="보내기"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#9B7AF7] flex items-center justify-center disabled:opacity-60"
              >
                <img src="/img/ic_send.svg" alt="" className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/counselor/mypage/reviews')}
            className="h-10 px-6 rounded-full border border-[#9B7AF7] text-[14px] font-medium text-[#8259F5]"
          >
            목록으로
          </button>
        </div>
      </main>

      <FloatingActions bottomOffset={24} />
    </div>
  )
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
      <button
        type="button"
        onClick={onBack}
        aria-label="뒤로"
        className="w-[30px] h-[30px] flex items-center justify-center"
      >
        <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
      </button>
      <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">상담 후기</h1>
    </header>
  )
}

function formatPostedAt(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`
}
