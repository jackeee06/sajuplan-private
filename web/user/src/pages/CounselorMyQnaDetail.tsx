import { useNavigate, useParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import { MOCK_COUNSELOR_MY_QNAS } from '../data/counselorMyPage'

/**
 * 08마이페이지_상담사_문의하기 상세 - 답변 있음
 * Figma node-id: 179:15850
 *
 * 상태칩 / 카테고리 + 제목 + ⋮ / 작성자·날짜 / 본문 / 답변 N건 / 답변 카드 / 목록으로
 */
export default function CounselorMyQnaDetail() {
  const navigate = useNavigate()
  const { id = '3' } = useParams<{ id: string }>()
  const qna =
    MOCK_COUNSELOR_MY_QNAS.find((q) => q.id === Number(id)) ?? MOCK_COUNSELOR_MY_QNAS[0]
  const replies = qna.replies ?? []

  return (
    <div className="mobile-frame flex flex-col pb-[100px]">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">문의하기</h1>
      </header>

      <main className="flex-1 px-4 pt-2">
        <span
          className={`inline-flex items-center h-[22px] px-2 rounded-full text-[12px] leading-none font-medium ${
            qna.status === '답변완료'
              ? 'bg-[#f3f0ff] text-[#8259F5]'
              : 'bg-[#F3F4F6] text-[#6A7282]'
          }`}
        >
          {qna.status}
        </span>

        <div className="mt-2 flex items-start gap-2">
          <h2 className="flex-1 text-[18px] font-bold leading-[140%] break-keep">
            <span className="text-[#8259F5] mr-1">{qna.category}</span>
            <span className="text-[#030712]">{qna.title}</span>
          </h2>
          <button
            type="button"
            aria-label="더보기"
            className="w-6 h-6 flex items-center justify-center shrink-0"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" aria-hidden>
              <circle cx="12" cy="6" r="1.4" fill="#6A7282" />
              <circle cx="12" cy="12" r="1.4" fill="#6A7282" />
              <circle cx="12" cy="18" r="1.4" fill="#6A7282" />
            </svg>
          </button>
        </div>

        <p className="mt-1 text-[13px] leading-[140%] text-[#99A1AF]">
          {qna.authorName} · {qna.postedAt}
        </p>

        <p className="mt-4 text-[15px] leading-[160%] text-[#1E2939] whitespace-pre-line">
          {qna.content}
        </p>

        <div className="mt-6 border-t border-[#F3F4F6]" />

        <p className="mt-4 text-[14px] font-semibold text-[#1E2939]">
          답변 <span className="text-[#8259F5]">{replies.length}</span>건
        </p>

        <ul className="mt-3 flex flex-col">
          {replies.map((r, i) => (
            <li key={i} className="py-4 border-b border-[#F3F4F6] last:border-b-0">
              <p className="text-[15px] leading-[160%] text-[#1E2939] whitespace-pre-line">
                {r.text}
              </p>
              <p className="mt-2 text-[13px] leading-[140%] text-[#99A1AF]">
                {r.author} · {r.postedAt}
              </p>
            </li>
          ))}
          {replies.length === 0 && (
            <li className="py-8 text-center text-[14px] text-[#99A1AF]">등록된 답변이 없습니다.</li>
          )}
        </ul>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/counselor/mypage/qnas')}
            className="h-10 px-6 rounded-full border border-[#8259F5] text-[14px] font-medium text-[#8259F5]"
          >
            목록으로
          </button>
        </div>
      </main>

      <FloatingActions bottomOffset={24} />
      <BottomNav myHref="/counselor/mypage" />
      </div>
  )
}
