import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import FloatingActions from '../components/FloatingActions'
import { MOCK_CUSTOMER_QNAS } from '../data/counselorMyPage'

/**
 * 08마이페이지_상담사_고객 문의 관리 (상세)
 * Figma node-id: 160:10685 (답변 있음) / 162:11279 (답변 없음)
 *
 * - 제목 / 작성자·시각 / 본문
 * - 답변 N건 (수가 0이면 빈 상태 + 보내기 입력란)
 * - 답변 입력란 (placeholder)
 * - 목록으로
 */
export default function CounselorMyCustomerQnaDetail() {
  const navigate = useNavigate()
  const { id = '3' } = useParams<{ id: string }>()
  const qna = MOCK_CUSTOMER_QNAS.find((q) => q.id === Number(id)) ?? MOCK_CUSTOMER_QNAS[0]
  const replies = qna.replies ?? []
  const hasReplies = replies.length > 0
  const [draft, setDraft] = useState(hasReplies ? '' : '안녕하세요 사')

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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">고객 문의 관리</h1>
      </header>

      <main className="flex-1 px-4 pt-2">
        <h2 className="text-[18px] font-bold leading-[140%] text-[#030712] break-keep">{qna.title}</h2>
        <p className="mt-1 text-[13px] leading-[140%] text-[#99A1AF]">
          {qna.customerName} · {qna.postedAt}
        </p>
        <p className="mt-4 text-[15px] leading-[160%] text-[#1E2939] whitespace-pre-line">
          {qna.content}
        </p>

        <div className="mt-6 border-t border-[#F3F4F6]" />

        <p className="mt-4 text-[14px] font-semibold text-[#1E2939]">
          {hasReplies ? '상담사 답변 ' : '답변목록 '}
          <span className="text-[#8259F5]">{replies.length}</span>건
        </p>

        {hasReplies ? (
          <ul className="mt-3 flex flex-col">
            {replies.map((r, i) => (
              <li key={i} className="py-4 border-b border-[#F3F4F6] last:border-b-0">
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-[15px] leading-[160%] text-[#1E2939] whitespace-pre-line">
                    {r.text}
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
                  <img src={r.profileImg} alt="" className="w-7 h-7 rounded-full object-cover" />
                  <p className="text-[13px] leading-[140%] text-[#99A1AF]">
                    {r.author} · {r.postedAt}
                  </p>
                </div>
              </li>
            ))}
          </ul>
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

        {/* 답변 입력 */}
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
            onClick={() => navigate('/counselor/mypage/customer-qnas')}
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
