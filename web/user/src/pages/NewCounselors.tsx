import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FilterDropdown from '../components/FilterDropdown'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import { MOCK_NEW_COUNSELORS, type NewCounselorBadge } from '../data/myPageMockData'

const PAGE_SIZE = 8

const CATEGORY_OPTIONS: NewCounselorBadge[] = ['사주', '타로', '신점']

const BADGE_BG: Record<NewCounselorBadge, string> = {
  신규: '#F3EEFE',
  사주: '#FFE2E2',
  타로: '#EDE9FE',
  신점: '#CCFBF1',
}

const BADGE_TEXT: Record<NewCounselorBadge, string> = {
  신규: '#8259F5',
  사주: '#FF6467',
  타로: '#8259F5',
  신점: '#00BBA7',
}

/**
 * 신규상담사 — Figma 120:6804 (목록) / 130:11024 (빈 상태)
 *
 * 구조:
 *  - 헤더: 뒤로가기 + "신규상담사"
 *  - 필터/검색 (filter_select "전체" + 검색 인풋)
 *  - "신규 선생님을 N명을 소개합니다!" (보라 강조 카운터)
 *  - 2열 카드 그리드 (사진 + 좌상단 칩 + 이름 + 코드 + 카피 + 가격)
 *  - 페이지네이션
 *  - 비어있으면 빈 상태(보라 원형 채팅 아이콘 + 메시지)
 */
export default function NewCounselors() {
  const navigate = useNavigate()
  const [category, setCategory] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    return MOCK_NEW_COUNSELORS.filter((c) => {
      if (category && c.badge !== category) return false
      if (keyword && !c.name.includes(keyword)) return false
      return true
    })
  }, [category, keyword])

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
          신규상담사
        </h1>
      </header>

      <main className="flex-1">
        <section className="px-4 pt-4 pb-3 flex items-center gap-2">
          <FilterDropdown
            label="전체"
            options={CATEGORY_OPTIONS as unknown as string[]}
            value={category}
            onChange={(v) => {
              setCategory(v)
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

        {isEmpty ? (
          <section className="pt-[64px] flex flex-col items-center px-6">
            <div className="w-[80px] h-[80px] rounded-full bg-[#F3EEFE] flex items-center justify-center">
              <img src="/img/ic_message_p.svg" alt="" className="w-9 h-9" />
            </div>
            <p className="mt-4 text-[18px] leading-[140%] font-bold text-[#030712]">
              신규상담사가 없습니다.
            </p>
            <p className="mt-2 text-[15px] leading-[150%] text-[#6A7282] text-center">
              현재 신규 상담사를 준비 중입니다.<br />잠시만 기다려 주세요
            </p>
          </section>
        ) : (
          <>
            <p className="px-4 text-[15px] leading-[140%] font-semibold text-[#030712] mb-3">
              신규 선생님을 <span className="text-[#8259F5]">{filtered.length}명</span>을 소개합니다!
            </p>

            <ul className="px-4 grid grid-cols-2 gap-3">
              {pageItems.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/counselors/${c.id}`)}
                    className="w-full bg-white rounded-[12px] border border-[#F3F4F6] overflow-hidden text-left"
                  >
                    <div className="relative aspect-square bg-[#F9FAFB]">
                      <img
                        src={c.imgUrl}
                        alt={c.name}
                        className="w-full h-full object-cover"
                      />
                      <span
                        className="absolute top-2 left-2 inline-flex items-center h-[22px] px-2 rounded-full text-[12px] leading-none font-medium"
                        style={{ background: BADGE_BG[c.badge], color: BADGE_TEXT[c.badge] }}
                      >
                        {c.badge}
                      </span>
                    </div>
                    <div className="p-2.5">
                      <div className="flex items-center gap-1">
                        <span className="text-[14px] leading-[140%] font-bold text-[#030712]">
                          {c.name}
                        </span>
                        <span className="text-[12px] leading-[140%] text-[#99A1AF]">
                          {c.code}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[12px] leading-[140%] text-[#6A7282] line-clamp-2">
                        {c.tagline}
                      </p>
                      <p className="mt-1.5 text-[12px] leading-[140%] text-[#6A7282]">
                        30초당{' '}
                        <span className="text-[14px] font-bold text-[#030712]">
                          {c.pricePer30s.toLocaleString()}원
                        </span>
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav />
    </div>
  )
}
