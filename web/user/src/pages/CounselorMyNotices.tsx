import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FilterDropdown from '../components/FilterDropdown'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import { MOCK_COUNSELOR_NOTICES } from '../data/counselorMyPage'

const PAGE_SIZE = 10

/**
 * 08마이페이지_상담사_상담사 공지사항
 * Figma node-id: 179:18155
 *
 * 텍스트 행형 리스트:
 *  - isPinned 행: 보라 배경 + "공지" 칩 (+ "New" 빨강 칩)
 *  - 일반 행: 흰 배경
 */
export default function CounselorMyNotices() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    return MOCK_COUNSELOR_NOTICES.filter((n) => {
      if (filter && filter !== '전체') return false
      if (keyword && !n.title.includes(keyword)) return false
      return true
    })
  }, [filter, keyword])

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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">상담사 공지사항</h1>
      </header>

      <main className="flex-1">
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

        <section className="px-4 pb-2">
          <p className="text-[13px] leading-[140%] text-[#6A7282]">
            전체 <span className="text-[#8259F5] font-medium">{filtered.length}</span>건{' '}
            <span className="text-[#8259F5] font-medium">{page}</span>페이지
          </p>
        </section>

        <ul className="flex flex-col">
          {pageItems.map((n) => (
            <li
              key={n.id}
              className={
                n.isPinned
                  ? 'border-b border-[#F3F4F6] bg-[#F3EEFE]'
                  : 'border-b border-[#F3F4F6] bg-white'
              }
            >
              <Link to={`/counselor/mypage/notices/${n.id}`} className="block px-4 py-3">
                <div className="flex items-start gap-2">
                  <span className="flex-1 text-[15px] leading-[140%] font-semibold text-[#030712]">
                    {n.title}
                  </span>
                  {n.isNew && (
                    <span className="shrink-0 inline-flex items-center h-[22px] px-2 rounded-full bg-[#FF6467] text-[12px] leading-none font-medium text-white">
                      New
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  {n.isPinned && (
                    <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-white border border-[#9B7AF7] text-[12px] leading-none font-medium text-[#8259F5]">
                      공지
                    </span>
                  )}
                  <span className="text-[13px] leading-[140%] text-[#99A1AF]">
                    {n.source} · {n.date}
                  </span>
                </div>
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
