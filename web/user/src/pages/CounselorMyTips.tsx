import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FilterDropdown from '../components/FilterDropdown'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import { MOCK_COUNSELOR_TIPS } from '../data/counselorMyPage'

const PAGE_SIZE = 10

/**
 * 08마이페이지_상담사_알짜 정보
 * Figma node-id: 153:10223
 *
 * 카드형 리스트: 풀폭 배너 이미지 + 제목 + "사주플랜 · 날짜"
 * 상단: 전체 셀렉트 + 검색바 / 카운터 / 페이지네이션
 */
export default function CounselorMyTips() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    return MOCK_COUNSELOR_TIPS.filter((t) => {
      if (filter && filter !== '전체') return false
      if (keyword && !t.title.includes(keyword)) return false
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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">알짜 정보</h1>
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

        <ul className="px-4 pt-2 flex flex-col gap-5">
          {pageItems.map((t) => (
            <li key={t.id}>
              <Link to={`/counselor/mypage/tips/${t.id}`} className="block">
                <div className="w-full aspect-[16/9] rounded-[16px] overflow-hidden bg-[#F3F4F6]">
                  <img src={t.imgUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <p className="mt-3 text-[16px] leading-[140%] font-semibold text-[#030712]">
                  {t.title}
                </p>
                <p className="mt-1 text-[13px] leading-[140%] text-[#99A1AF]">
                  {t.source} · {t.date}
                </p>
              </Link>
            </li>
          ))}
          {pageItems.length === 0 && (
            <li className="py-20 text-center text-[14px] text-[#99A1AF]">알짜 정보가 없습니다.</li>
          )}
        </ul>

        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav myHref="/counselor/mypage" />
    </div>
  )
}
