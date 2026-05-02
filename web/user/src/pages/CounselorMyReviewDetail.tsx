import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import FloatingActions from '../components/FloatingActions'
import {
  MOCK_COUNSELOR_REVIEWS,
  MOCK_COUNSELOR_REVIEW_REPLIES,
} from '../data/counselorMyPage'

/**
 * 08마이페이지_상담사_후기 상세
 * Figma node-id: 163:26352 (답변 있음) / 163:26385 (답변 없음)
 *
 * - 제목 + ⋮ / 보라체크 작성자 / 메타 / 본문 / 첨부 이미지
 * - 답변 N건 (수가 0이면 빈 상태) / 답변 입력란 / 목록으로
 */
export default function CounselorMyReviewDetail() {
  const navigate = useNavigate()
  const { id = '2' } = useParams<{ id: string }>()
  const review =
    MOCK_COUNSELOR_REVIEWS.find((r) => r.id === Number(id)) ?? MOCK_COUNSELOR_REVIEWS[0]
  const reply = MOCK_COUNSELOR_REVIEW_REPLIES[review.id]
  const hasReply = !!reply
  const [draft, setDraft] = useState(hasReply ? '' : '안녕하세요 사')

  return (
    <div className="mobile-frame flex flex-col pb-6">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">상담 후기</h1>
      </header>

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
          <span className="text-[14px] font-medium text-[#1E2939]">{review.customerName}</span>
        </div>

        <p className="mt-1 text-[13px] leading-[140%] text-[#99A1AF]">
          {review.consultType} · {review.date} · {review.duration}
        </p>

        <p className="mt-3 text-[15px] leading-[160%] text-[#1E2939] whitespace-pre-line">
          {review.content}
        </p>

        {review.imgUrl && (
          <div className="mt-4 w-full rounded-[16px] overflow-hidden bg-[#F3F4F6]">
            <img src={review.imgUrl} alt="" className="w-full h-auto object-cover" />
          </div>
        )}

        <div className="mt-6 border-t border-[#F3F4F6]" />

        <p className="mt-4 text-[14px] font-semibold text-[#1E2939]">
          {hasReply ? '상담 답변 ' : '답변목록 '}
          <span className="text-[#8259F5]">{hasReply ? 1 : 0}</span>건
        </p>

        {hasReply ? (
          <div className="py-4 border-b border-[#F3F4F6]">
            <div className="flex items-start gap-2">
              <p className="flex-1 text-[15px] leading-[160%] text-[#1E2939] whitespace-pre-line">
                {reply.text}
              </p>
              <button type="button" aria-label="더보기" className="w-5 h-5 shrink-0">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" aria-hidden>
                  <circle cx="12" cy="6" r="1.4" fill="#6A7282" />
                  <circle cx="12" cy="12" r="1.4" fill="#6A7282" />
                  <circle cx="12" cy="18" r="1.4" fill="#6A7282" />
                </svg>
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <img src={reply.profileImg} alt="" className="w-7 h-7 rounded-full object-cover" />
              <p className="text-[13px] leading-[140%] text-[#99A1AF]">
                {reply.author} · {reply.postedAt}
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

        <div className="mt-4 relative">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="답변을 입력해주세요."
            className="w-full h-[44px] pl-4 pr-14 rounded-full bg-[#F9FAFB] border border-[#9B7AF7] text-[14px] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none"
          />
          {draft && (
            <button
              type="button"
              aria-label="보내기"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#9B7AF7] flex items-center justify-center"
            >
              <img src="/img/ic_send.svg" alt="" className="w-4 h-4" />
            </button>
          )}
        </div>

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
