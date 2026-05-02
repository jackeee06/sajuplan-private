import { useNavigate, useParams } from 'react-router-dom'
import FloatingActions from '../components/FloatingActions'
import { MOCK_MY_QNAS } from '../data/myActivities'

/**
 * 나의 상담문의 상세 — Figma 147:13518 (답변 있음 변형)
 *  - 제목 + ⋮
 *  - 메타: 작성자 · 작성시각
 *  - 본문
 *  - 구분선
 *  - "상담사 답변 N건" (보라 강조 숫자)
 *  - 답변 박스들 (각: 본문 + 28×28 아바타 + 이름 + 시각)
 *  - 하단 "목록으로" 버튼
 */
export default function MyQnaDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const qna = MOCK_MY_QNAS.find((q) => String(q.id) === id)

  if (!qna) {
    return (
      <div className="mobile-frame flex items-center justify-center min-h-screen text-[#6A7282]">
        문의를 찾을 수 없습니다.
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
          상담 문의
        </h1>
      </header>

      <main className="flex-1 px-4 pt-3">
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-[18px] font-bold leading-[140%] text-[#1E2939]">
            {qna.title}
          </h2>
          <button type="button" aria-label="더보기" className="w-7 h-7 flex items-center justify-center text-[#9CA3AF]">
            ⋮
          </button>
        </div>
        <p className="mt-1 text-[12px] text-[#99A1AF]">
          {qna.customerName} · {qna.postedAt}
        </p>
        <p className="mt-5 text-[15px] leading-[160%] text-[#4A5565] whitespace-pre-line">
          {qna.content}
        </p>

        {qna.replies && qna.replies.length > 0 && (
          <div className="mt-7">
            <p className="text-[14px] font-medium text-[#364153] pb-3 border-b border-[#F3F4F6]">
              상담사 답변 <span className="text-[#8259F5] font-bold">{qna.replies.length}</span>건
            </p>
            {qna.replies.map((reply, idx) => (
              <div
                key={idx}
                className="py-4 border-b border-[#F3F4F6]"
              >
                <p className="text-[14px] leading-[160%] text-[#4A5565] whitespace-pre-line">
                  {reply.text}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <img src={reply.profileImg} alt="" className="w-7 h-7 rounded-full object-cover" />
                  <span className="text-[13px] text-[#99A1AF]">
                    {reply.name} · {reply.postedAt}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/mypage/my-qnas')}
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
