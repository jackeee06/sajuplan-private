import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import { MOCK_CUSTOMER_QNAS } from '../data/counselorMyPage'

const PAGE_SIZE = 10

/**
 * 08마이페이지_상담사_고객 문의 관리 (목록)
 * Figma node-id: 152:9624 (목록) / 157:12409 (빈 목록)
 *
 * - 카드: 답변상태 칩 + (자물쇠) + 제목 + ⋮ / 본문 / 작성자·날짜
 * - 빈 상태: 가운데 말풍선 아이콘 + "등록된 1:1문의가 없습니다."
 */
export default function CounselorMyCustomerQnas() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)

  const list = MOCK_CUSTOMER_QNAS
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const pageItems = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">고객 문의 관리</h1>
      </header>

      <main className="flex-1">
        <section className="px-4 pt-3 pb-2 border-b border-[#F3F4F6]">
          <p className="text-[13px] leading-[140%] text-[#6A7282]">
            전체 <span className="text-[#8259F5] font-medium">{list.length}</span>건{' '}
            <span className="text-[#8259F5] font-medium">{page}</span>페이지
          </p>
        </section>

        {list.length === 0 ? (
          <div className="pt-24 flex flex-col items-center gap-3">
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
            <p className="text-[14px] text-[#6A7282]">등록된 1:1문의가 없습니다.</p>
          </div>
        ) : (
          <ul className="flex flex-col">
            {pageItems.map((q) => (
              <li key={q.id} className="border-b border-[#F3F4F6]">
                <Link to={`/counselor/mypage/customer-qnas/${q.id}`} className="block px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center h-[22px] px-2 rounded-full text-[12px] leading-none font-medium ${
                        q.status === '답변완료'
                          ? 'bg-[#F3EEFE] text-[#8259F5]'
                          : 'bg-[#F3F4F6] text-[#6A7282]'
                      }`}
                    >
                      {q.status}
                    </span>
                    {q.isPrivate && (
                      <svg viewBox="0 0 16 16" className="w-4 h-4 shrink-0" fill="none" aria-hidden>
                        <rect x="3.5" y="7.5" width="9" height="6" rx="1" stroke="#1E2939" strokeWidth="1.4" />
                        <path d="M5 7.5V5C5 3.34 6.34 2 8 2C9.66 2 11 3.34 11 5V7.5" stroke="#1E2939" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    )}
                    <span className="flex-1 text-[15px] font-semibold text-[#030712] truncate">
                      {q.title}
                    </span>
                    <MoreIcon />
                  </div>
                  <p className="mt-1 text-[14px] leading-[140%] text-[#6A7282] line-clamp-2">
                    {q.content}
                  </p>
                  <p className="mt-1 text-[13px] leading-[140%] text-[#99A1AF]">
                    {q.customerName} · {q.date}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {list.length > 0 && (
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav myHref="/counselor/mypage" />
    </div>
  )
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" aria-hidden>
      <circle cx="12" cy="6" r="1.4" fill="#6A7282" />
      <circle cx="12" cy="12" r="1.4" fill="#6A7282" />
      <circle cx="12" cy="18" r="1.4" fill="#6A7282" />
    </svg>
  )
}
