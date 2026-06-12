import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FilterDropdown from '../components/FilterDropdown'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import UploadedImage from '../components/UploadedImage'
import { ApiError, counselorsApi, type PublicCounselor } from '../lib/api'
import { formatCounselorNo } from '../lib/counselor-mapper'

const PAGE_SIZE = 8

const CATEGORY_OPTIONS = ['사주', '타로', '신점'] as const

type Badge = '신규' | '사주' | '타로' | '신점'

const BADGE_BG: Record<Badge, string> = {
  신규: '#fdf2f8',
  사주: '#FFE2E2',
  타로: '#EDE9FE',
  신점: '#CCFBF1',
}

const BADGE_TEXT: Record<Badge, string> = {
  신규: '#ec4899',
  사주: '#FF6467',
  타로: '#ec4899',
  신점: '#00BBA7',
}

/**
 * 신규상담사 — Figma 120:6804 (목록) / 130:11024 (빈 상태)
 *
 * 데이터: GET /api/user/counselors?tab=new&category=사주|타로|신점&limit=50
 *  - 가입 최근순 정렬 (member.created_at DESC).
 *  - sample 의 bo_table=new 게시판은 관리자가 직접 글을 올리는 구조였으나,
 *    신규에선 최근 가입한 상담사 카드를 자동으로 노출.
 *
 * 카드 뱃지:
 *  - 카테고리 추정 결과(사주/타로/신점)가 있으면 해당 색의 카테고리 칩.
 *  - '기타' 면 '신규' 보라 칩.
 */
export default function NewCounselors() {
  const navigate = useNavigate()
  const [category, setCategory] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<PublicCounselor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    counselorsApi
      .list({ tab: 'new', category: category ?? undefined, limit: 50 })
      .then((res) => {
        if (!alive) return
        setItems(res.items)
      })
      .catch((e: unknown) => {
        if (!alive) return
        const msg =
          e instanceof ApiError
            ? e.message
            : '신규상담사 목록을 불러오지 못했습니다.'
        setError(msg)
        setItems([])
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [category])

  const filtered = useMemo(() => {
    const k = keyword.trim()
    if (!k) return items
    return items.filter(
      (c) => c.name.includes(k) || c.nickname.includes(k),
    )
  }, [items, keyword])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const isEmpty = !loading && filtered.length === 0

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

        {error ? (
          <section className="pt-[64px] flex flex-col items-center px-6">
            <p className="text-[15px] leading-[150%] text-[#6A7282] text-center">
              {error}
            </p>
          </section>
        ) : loading ? (
          <section className="pt-[64px] flex flex-col items-center px-6">
            <p className="text-[15px] leading-[150%] text-[#6A7282]">
              불러오는 중...
            </p>
          </section>
        ) : isEmpty ? (
          <section className="pt-[64px] flex flex-col items-center px-6">
            <div className="w-[80px] h-[80px] rounded-full bg-[#fdf2f8] flex items-center justify-center">
              <img src="/img/ic_message_p.svg?v=v2" alt="" className="w-9 h-9" />
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
              신규 선생님을 <span className="text-[#ec4899]">{filtered.length}명</span>을 소개합니다!
            </p>

            <ul className="px-4 grid grid-cols-2 gap-3">
              {pageItems.map((c) => {
                const badge: Badge =
                  c.category === '사주' || c.category === '타로' || c.category === '신점'
                    ? c.category
                    : '신규'
                const tagline = c.headline || c.title || '속 시원하게 풀어드립니다'
                const pricePer30s = priceFor30s(c.unit_seconds, c.unit_cost)
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/counselors/${c.id}`)}
                      className="w-full bg-white rounded-[12px] border border-[#F3F4F6] overflow-hidden text-left"
                    >
                      <div className="relative aspect-square bg-[#F9FAFB]">
                        {c.profile_image ? (
                          <UploadedImage
                            src={c.profile_image}
                            srcWebp={c.profile_image_webp}
                            alt={c.nickname || c.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#D1D5DC] text-[12px]">
                            no image
                          </div>
                        )}
                        <span
                          className="absolute top-2 left-2 inline-flex items-center h-[22px] px-2 rounded-full text-[12px] leading-none font-medium"
                          style={{ background: BADGE_BG[badge], color: BADGE_TEXT[badge] }}
                        >
                          {badge}
                        </span>
                      </div>
                      <div className="p-2.5">
                        <div className="flex items-center gap-1">
                          <span className="text-[14px] leading-[140%] font-bold text-[#030712]">
                            {c.nickname || c.name}
                          </span>
                          {formatCounselorNo(c.dtmfno) != null && (
                            <span className="text-[12px] leading-[140%] text-[#99A1AF]">
                              {formatCounselorNo(c.dtmfno)}번
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[12px] leading-[140%] text-[#6A7282] line-clamp-2">
                          {tagline}
                        </p>
                        {pricePer30s != null && (
                          <p className="mt-1.5 text-[12px] leading-[140%] text-[#6A7282]">
                            30초당{' '}
                            <span className="text-[14px] font-bold text-[#030712]">
                              {pricePer30s.toLocaleString()}원
                            </span>
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
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

/**
 * unit_seconds 동안 unit_cost 원 → 30초당 가격 환산.
 * unit_seconds 가 0/null 이면 null (가격 미노출).
 * 카드의 가격 표기 정책은 sample 메인 카드(30초당 X,XXX원) 와 동일.
 */
function priceFor30s(unitSeconds: number | null, unitCost: number | null): number | null {
  if (!unitSeconds || !unitCost) return null
  const per30 = (unitCost / unitSeconds) * 30
  return Math.round(per30)
}
