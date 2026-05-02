import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import {
  FAQ_CATEGORIES,
  MOCK_FAQS,
  type FaqCategory,
} from '../data/myPageMockData'

const PAGE_SIZE = 5

/**
 * 이용안내 — Figma 06마이페이지(비회원) > 이용안내 (+ 빈 상태)
 *
 * 구조:
 *  - 고객센터 카드 (보라 전화 아이콘 + 운영시간 + 1:1 문의 버튼)
 *  - "자주 묻는 질문" + 카테고리 셀렉트(풀폭)
 *  - FAQ 아코디언 (Q 원형 + 질문 + chevron, 펼치면 답변)
 *  - 페이지네이션
 *  - 빈 상태: 채팅 아이콘 원형 + "등록된 질문이 없습니다." + 서브카피
 */
export default function Help() {
  const navigate = useNavigate()
  const [category, setCategory] = useState<FaqCategory>('전체')
  const [catOpen, setCatOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<number | null>(MOCK_FAQS[0]?.id ?? null)

  const filtered = useMemo(() => {
    return category === '전체' ? MOCK_FAQS : MOCK_FAQS.filter((f) => f.category === category)
  }, [category])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const isEmpty = filtered.length === 0

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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">
          이용안내
        </h1>
      </header>

      <main className="flex-1 px-4 pt-2">
        <section className="rounded-[16px] bg-[#F9FAFB] p-5">
          <div className="flex items-center gap-3">
            <img src="/img/ic_my_phone.svg" alt="" className="w-10 h-10" />
            <div className="flex flex-col">
              <span className="text-[18px] leading-[140%] font-bold text-[#8259F5]">
                고객센터
              </span>
              <span className="text-[13px] leading-[140%] text-[#4A5565]">
                운영시간: 9시~18시 (주말 및 공휴일 휴무)
              </span>
              <span className="text-[13px] leading-[140%] text-[#4A5565]">
                점심시간: 12시~13시
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/mypage/inquiry/new')}
            className="mt-4 w-full h-[44px] rounded-full border border-[#9B7AF7] bg-white flex items-center justify-center gap-1.5 text-[15px] font-medium text-[#8259F5]"
          >
            <img src="/img/ic_write_p.svg" alt="" className="w-5 h-5" />
            1:1 문의
          </button>
        </section>

        <section className="mt-6">
          <h2 className="text-[18px] leading-[140%] font-bold text-[#030712] mb-2">
            자주 묻는 질문
          </h2>

          <div className="relative">
            <button
              type="button"
              onClick={() => setCatOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={catOpen}
              className="w-full h-[48px] px-4 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] flex items-center justify-between text-[15px] text-[#1E2939]"
            >
              <span className={category === '전체' ? 'text-[#99A1AF]' : 'text-[#1E2939]'}>
                {category === '전체' ? '카테고리 선택' : category}
              </span>
              <svg
                viewBox="0 0 16 16"
                className={`w-4 h-4 transition-transform ${catOpen ? 'rotate-180' : ''}`}
                fill="none"
                aria-hidden
              >
                <path
                  d="M4 6L8 10L12 6"
                  stroke="#6A7282"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {catOpen && (
              <ul
                role="listbox"
                aria-label="카테고리"
                className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 max-h-[260px] overflow-y-auto bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_8px_20px_rgba(16,24,40,0.08)] py-1"
              >
                {FAQ_CATEGORIES.map((c) => {
                  const selected = c === category
                  return (
                    <li key={c}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          setCategory(c)
                          setCatOpen(false)
                          setPage(1)
                          setOpenId(null)
                        }}
                        className={`w-full px-4 py-2.5 text-left text-[15px] leading-5 ${
                          selected
                            ? 'text-[#8259F5] font-medium bg-[#F3EEFE]'
                            : 'text-[#1E2939] hover:bg-[#F9FAFB]'
                        }`}
                      >
                        {c}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        {isEmpty ? (
          <section className="pt-[64px] flex flex-col items-center">
            <div className="w-[80px] h-[80px] rounded-full bg-[#F3EEFE] flex items-center justify-center">
              <img src="/img/ic_message_p.svg" alt="" className="w-9 h-9" />
            </div>
            <p className="mt-4 text-[18px] leading-[140%] font-bold text-[#030712]">
              등록된 질문이 없습니다.
            </p>
            <p className="mt-2 text-[15px] leading-[150%] text-[#6A7282] text-center">
              궁금하신 부분이 있다면<br />1:1문의를 통해 문의 해주세요
            </p>
          </section>
        ) : (
          <ul className="mt-2 flex flex-col">
            {pageItems.map((f) => {
              const open = openId === f.id
              return (
                <li key={f.id} className="border-b border-[#F3F4F6]">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : f.id)}
                    aria-expanded={open}
                    className="w-full py-4 flex items-center gap-3 text-left"
                  >
                    <span className="w-7 h-7 rounded-full bg-[#9B7AF7] text-white text-[14px] font-bold flex items-center justify-center shrink-0">
                      Q
                    </span>
                    <span className="flex-1 text-[15px] leading-[140%] font-semibold text-[#030712]">
                      {f.question}
                    </span>
                    <svg
                      viewBox="0 0 16 16"
                      className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M4 6L8 10L12 6"
                        stroke="#6A7282"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  {open && (
                    <div className="pb-4">
                      <p className="text-[14px] leading-[160%] text-[#4A5565] whitespace-pre-line">
                        {f.answer}
                      </p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {!isEmpty && (
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav />
    </div>
  )
}
