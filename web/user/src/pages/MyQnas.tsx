import { Link, useNavigate } from 'react-router-dom'
import FloatingActions from '../components/FloatingActions'
import { MOCK_MY_QNAS } from '../data/myActivities'

/**
 * 나의 상담 문의 — Figma 147:13466
 *  카드 리스트:
 *   - 상단: 이름 + 코드(보라) + 우측 ⋮
 *   - 상태 칩 (답변완료 보라 / 답변대기 회색) + 자물쇠 + 제목
 *   - 본문 미리보기 + 메타(작성자 · 날짜)
 */
export default function MyQnas() {
  const navigate = useNavigate()

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
          나의 상담문의
        </h1>
      </header>

      <main className="flex-1 px-4">
        {MOCK_MY_QNAS.map((q) => (
          <Link
            key={q.id}
            to={`/mypage/my-qnas/${q.id}`}
            className="block py-4 border-b border-[#F3F4F6]"
          >
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-bold text-[#030712]">{q.counselor.name}</span>
              <span className="text-[15px] font-medium text-[#8259F5]">{q.counselor.code}</span>
              <button
                type="button"
                aria-label="더보기"
                className="ml-auto w-7 h-7 flex items-center justify-center text-[#9CA3AF]"
                onClick={(e) => e.preventDefault()}
              >
                ⋮
              </button>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span
                className={
                  q.status === '답변완료'
                    ? 'h-[24px] px-2 inline-flex items-center rounded text-[12px] font-medium bg-[#F3EEFE] text-[#8259F5]'
                    : 'h-[24px] px-2 inline-flex items-center rounded text-[12px] font-medium bg-[#F3F4F6] text-[#6A7282]'
                }
              >
                {q.status}
              </span>
              {q.showLock && (
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" aria-hidden>
                  <rect x="5" y="11" width="14" height="9" rx="2" stroke="#030712" strokeWidth="1.6" />
                  <path d="M8 11V8a4 4 0 018 0v3" stroke="#030712" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              )}
              <span className="text-[15px] font-semibold text-[#030712] truncate">{q.title}</span>
            </div>

            <p className="mt-1 text-[14px] text-[#6A7282] line-clamp-2 whitespace-pre-line">
              {q.preview}
            </p>
            <p className="mt-2 text-[12px] text-[#99A1AF]">
              {q.customerName} · {q.date}
            </p>
          </Link>
        ))}
      </main>

      <FloatingActions bottomOffset={24} />
    </div>
  )
}
