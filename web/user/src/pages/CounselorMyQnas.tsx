import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FilterDropdown from '../components/FilterDropdown'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import {
  MOCK_COUNSELOR_MY_QNAS,
  COUNSELOR_MY_QNA_CATEGORIES,
  type CounselorMyQnaCategory,
} from '../data/counselorMyPage'

const PAGE_SIZE = 10

type Tab = '전체' | CounselorMyQnaCategory

/**
 * 08마이페이지_상담사_문의하기
 * Figma node-id: 179:15834
 *
 * 상단 배너 + 셀렉트/검색 + 메인 탭 5종 + 카드 리스트
 */
export default function CounselorMyQnas() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [tab, setTab] = useState<Tab>('전체')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    return MOCK_COUNSELOR_MY_QNAS.filter((q) => {
      if (filter && filter !== '전체') return false
      if (tab !== '전체' && q.category !== tab) return false
      if (keyword && !q.title.includes(keyword) && !q.content.includes(keyword)) return false
      return true
    })
  }, [filter, tab, keyword])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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

      <main className="flex-1">
        {/* 상단 강조 배너 */}
        <section className="px-4 pt-2">
          <p className="text-[18px] font-bold leading-[140%] text-[#8259F5]">
            궁금하신 점이 있으신가요?
          </p>
          <p className="mt-1 text-[14px] leading-[140%] text-[#6A7282]">
            자주하는 질문에서 빠르게 확인이 가능합니다!
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="h-11 rounded-full border border-[#8259F5] text-[14px] font-medium text-[#8259F5]"
            >
              자주하는 질문
            </button>
            <button
              type="button"
              onClick={() => navigate('/counselor/mypage/qnas/new')}
              className="h-11 rounded-full bg-[#8259F5] text-[14px] font-semibold text-white"
            >
              문의하기
            </button>
          </div>
        </section>

        {/* 필터 */}
        <section className="px-4 pt-4 pb-3 flex items-center gap-2">
          <FilterDropdown
            label="전체"
            options={[]}
            value={filter}
            onChange={(v) => {
              setFilter(v)
              setPage(1)
            }}
          />
          <div className="relative flex-1">
            <input
              type="text"
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value)
                setPage(1)
              }}
              placeholder="검색어를 입력하세요."
              className="w-full h-9 pl-4 pr-10 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] text-[14px] leading-5 text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none"
            />
            <img
              src="/img/ic_input_search.svg"
              alt=""
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5"
            />
          </div>
        </section>

        {/* 메인 탭 */}
        <div className="px-4 border-b border-[#F3F4F6]">
          <div className="flex">
            {(['전체', ...COUNSELOR_MY_QNA_CATEGORIES] as Tab[]).map((t) => {
              const on = tab === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTab(t)
                    setPage(1)
                  }}
                  className={`relative h-11 flex-1 px-2 text-[14px] ${
                    on ? 'text-[#8259F5] font-bold' : 'text-[#6A7282]'
                  }`}
                >
                  {t}
                  {on && <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-[#8259F5]" />}
                </button>
              )
            })}
          </div>
        </div>

        <ul className="flex flex-col">
          {pageItems.map((q) => (
            <li key={q.id} className="border-b border-[#F3F4F6]">
              <Link to={`/counselor/mypage/qnas/${q.id}`} className="block px-4 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center h-[22px] px-2 rounded-full text-[12px] leading-none font-medium ${
                      q.status === '답변완료'
                        ? 'bg-[#f3f0ff] text-[#8259F5]'
                        : 'bg-[#F3F4F6] text-[#6A7282]'
                    }`}
                  >
                    {q.status}
                  </span>
                  <span className="text-[14px] font-medium text-[#8259F5]">{q.category}</span>
                  <span className="text-[15px] font-semibold text-[#030712] break-keep">
                    {q.title}
                  </span>
                </div>
                <p className="mt-1 text-[14px] leading-[140%] text-[#6A7282] line-clamp-2">
                  {q.content}
                </p>
                <p className="mt-1 text-[13px] leading-[140%] text-[#99A1AF]">
                  {q.authorName} · {q.date}
                </p>
              </Link>
            </li>
          ))}
        </ul>

        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav myHref="/counselor/mypage" />
    </div>
  )
}
