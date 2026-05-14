import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import FloatingActions from '../components/FloatingActions'
import UploadedImage from '../components/UploadedImage'
import { ApiError, reviewsApi, type MyReviewItem } from '../lib/api'

const BADGE_BG: Record<MyReviewItem['counselor_badge'], string> = {
  타로: '#8259F5',
  신점: '#00BBA7',
  사주: '#FF6467',
  기타: '#6A7282',
}

/**
 * 나의 상담 후기 상세 — Figma 147:13357
 *  - GET /user/reviews/:id (본인 후기만)
 *  - 사진은 photo_url + photo_url_webp <picture> 로 노출
 *  - 상담사 답변(post_review_reply) 은 현재 본 페이지에서 노출 대상 아님 (CounselorMyReviewDetail 에서 작성).
 */
export default function MyReviewDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const reviewId = Number(id ?? '') || 0
  const [review, setReview] = useState<MyReviewItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!reviewId) {
      setError('잘못된 접근입니다.')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    reviewsApi
      .detail(reviewId)
      .then((r) => {
        if (cancelled) return
        setReview(r)
        setError(null)
      })
      .catch((e) => {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 401) {
          navigate('/login')
          return
        }
        setError(e instanceof Error ? e.message : '후기를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reviewId, navigate])

  return (
    <div className="mobile-frame flex flex-col pb-[40px]">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">
          상담 후기
        </h1>
      </header>

      <main className="flex-1 px-4 pt-3">
        {loading && (
          <p className="py-20 text-center text-[14px] text-[#99A1AF]">불러오는 중…</p>
        )}
        {!loading && error && (
          <p className="py-20 text-center text-[14px] text-[#FB2C36]">{error}</p>
        )}
        {!loading && !error && !review && (
          <p className="py-20 text-center text-[14px] text-[#99A1AF]">후기를 찾을 수 없습니다.</p>
        )}

        {review && (
          <>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-[#F3F4F6] overflow-hidden shrink-0">
                {review.counselor_avatar && (
                  <UploadedImage src={review.counselor_avatar} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <span
                className="px-2 h-[22px] inline-flex items-center text-[12px] font-medium text-white rounded"
                style={{ background: BADGE_BG[review.counselor_badge] }}
              >
                {review.counselor_badge}
              </span>
              <span className="text-[15px] font-bold text-[#030712] truncate">
                {review.counselor_name}
              </span>
              {review.counselor_code && (
                <span className="text-[14px] font-medium text-[#8259F5] shrink-0">
                  {review.counselor_code}
                </span>
              )}
            </div>

            <div className="mt-3 flex items-center gap-1">
              <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" aria-label="인증">
                <path d="M12 1.5L14.5 3.7L17.8 3.4L19 6.5L21.8 8.2L21 11.5L21.8 14.8L19 16.5L17.8 19.6L14.5 19.3L12 21.5L9.5 19.3L6.2 19.6L5 16.5L2.2 14.8L3 11.5L2.2 8.2L5 6.5L6.2 3.4L9.5 3.7L12 1.5Z" fill="#9B7AF7" />
                <path d="M8 12L11 15L16 9.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              <span className="text-[14px] font-medium text-[#1E2939]">{review.customer_name}</span>
            </div>
            <p className="mt-1 text-[12px] text-[#99A1AF]">
              {[review.consult_type, review.consult_date, review.consult_duration]
                .filter(Boolean)
                .join(' · ')}
            </p>

            <h2 className="mt-4 text-[18px] font-bold leading-[140%] text-[#1E2939] whitespace-pre-line">
              {review.title}
            </h2>

            <p className="mt-3 text-[15px] leading-[160%] text-[#4A5565] whitespace-pre-line">
              {review.content}
            </p>

            {review.photo_url && (
              <UploadedImage
                src={review.photo_url}
                srcWebp={review.photo_url_webp}
                alt=""
                className="mt-5 w-full rounded-[16px] object-cover"
              />
            )}

            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => navigate('/mypage/my-reviews')}
                className="h-11 px-8 rounded-full border border-[#9B7AF7] text-[14px] font-medium text-[#8259F5]"
              >
                목록으로
              </button>
            </div>
          </>
        )}
      </main>

      <FloatingActions bottomOffset={24} />
    </div>
  )
}
