import { useNavigate, useParams } from 'react-router-dom'
import FloatingActions from '../components/FloatingActions'
import { MOCK_MY_REVIEWS } from '../data/myActivities'

/**
 * 나의 상담후기 상세 — Figma 147:13357 (답변 없음 변형)
 *  답변 있음 케이스: reply 필드 있을 때 하단 답변 박스 노출.
 */
export default function MyReviewDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const review = MOCK_MY_REVIEWS.find((r) => String(r.id) === id)

  if (!review) {
    return (
      <div className="mobile-frame flex items-center justify-center min-h-screen text-[#6A7282]">
        후기를 찾을 수 없습니다.
      </div>
    )
  }

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
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-[18px] font-bold leading-[140%] text-[#1E2939]">
            {review.title}
          </h2>
          <button type="button" aria-label="더보기" className="w-7 h-7 flex items-center justify-center text-[#9CA3AF]">
            ⋮
          </button>
        </div>

        <div className="mt-2 flex items-center gap-1">
          <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" aria-label="인증">
            <path d="M12 1.5L14.5 3.7L17.8 3.4L19 6.5L21.8 8.2L21 11.5L21.8 14.8L19 16.5L17.8 19.6L14.5 19.3L12 21.5L9.5 19.3L6.2 19.6L5 16.5L2.2 14.8L3 11.5L2.2 8.2L5 6.5L6.2 3.4L9.5 3.7L12 1.5Z" fill="#9B7AF7" />
            <path d="M8 12L11 15L16 9.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <span className="text-[14px] font-medium text-[#1E2939]">{review.customerName}</span>
        </div>
        <p className="mt-1 text-[12px] text-[#99A1AF]">
          {review.consultType} · {review.date} · {review.duration}
        </p>

        <p className="mt-4 text-[15px] leading-[160%] text-[#4A5565] whitespace-pre-line">
          {review.content}
        </p>

        {review.imgUrl && (
          <img
            src={review.imgUrl}
            alt=""
            className="mt-5 w-full rounded-[16px] object-cover"
          />
        )}

        {review.reply && (
          <div className="mt-6 pt-4 border-t border-[#F3F4F6]">
            <div className="flex items-center gap-2">
              <img src={review.counselor.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
              <span className="text-[14px] font-bold text-[#1E2939]">{review.reply.name}</span>
            </div>
            <p className="mt-2 text-[14px] leading-[160%] text-[#4A5565] whitespace-pre-line">
              {review.reply.text}
            </p>
          </div>
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
      </main>

      <FloatingActions bottomOffset={24} />
    </div>
  )
}
