import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FilterDropdown from '../components/FilterDropdown'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import { MOCK_NOTICES, NOTICE_CATEGORIES } from '../data/myPageMockData'

const PAGE_SIZE = 10

/**
 * 공지사항 리스트 — Figma 06마이페이지(비회원) > 공지사항
 *
 *  - 상단: filter_select(전체/공지/이벤트/업데이트) + 검색 인풋
 *  - 카운터: "전체 N건 1페이지" (숫자 강조: #8259F5)
 *  - 고정 공지: 연보라 배경 + "공지" 칩(보라 outline) [+ "New" 빨간 뱃지 옵션]
 *  - 일반 공지: 흰 배경, 칩 없음
 *  - 페이지네이션 1~5
 */
export default function Notices() {
  const navigate = useNavigate()
  const [category, setCategory] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    return MOCK_NOTICES.filter((n) => {
      if (category && category !== '전체' && !(category === '공지' && n.pinned)) return false
      if (keyword && !n.title.includes(keyword)) return false
      return true
    })
  }, [category, keyword])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const onCategoryChange = (v: string | null) => {
    setCategory(v)
    setPage(1)
  }

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
          공지사항
        </h1>
      </header>

      <main className="flex-1">
        <section className="px-4 pt-4 pb-3 flex items-center gap-2">
          <FilterDropdown
            label="전체"
            options={NOTICE_CATEGORIES.filter((c) => c !== '전체') as unknown as string[]}
            value={category}
            onChange={onCategoryChange}
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
                n.pinned
                  ? 'border-b border-[#F3F4F6] bg-[#F3EEFE]'
                  : 'border-b border-[#F3F4F6] bg-white'
              }
            >
              <Link to={`/mypage/notices/${n.id}`} className="block px-4 py-3">
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
                  {n.pinned && (
                    <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-white border border-[#9B7AF7] text-[12px] leading-none font-medium text-[#8259F5]">
                      공지
                    </span>
                  )}
                  <span className="text-[13px] leading-[140%] text-[#99A1AF]">
                    {n.author} · {n.date}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav />
    </div>
  )
}
