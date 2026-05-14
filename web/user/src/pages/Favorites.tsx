import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import CounselorCard, { type Counselor } from '../components/CounselorCard'
import FilterDropdown from '../components/FilterDropdown'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import { ApiError, counselorsApi, type PublicCounselor } from '../lib/api'
import { mapPublicCounselorToCard } from '../lib/counselor-mapper'

type Category = '전체' | '사주' | '타로' | '신점'
const CATEGORIES: Category[] = ['전체', '사주', '타로', '신점']

// 분야 옵션은 DB 의 실제 hashtag 분포에서 동적으로 가져옴 (counselorsApi.filterOptions)

const PAGE_SIZE = 10

/**
 * 단골 상담사 — Figma 163:16645 (03전체리스트_단골 상담사)
 *
 * 백엔드 연동:
 *   GET /api/user/counselors/favorites?category=
 *
 * 좋아요 토글: 카드 하트 → counselorsApi.removeLike → 목록에서 제거 후 갱신.
 */

// 카드 매핑은 src/lib/counselor-mapper.ts 통합 헬퍼 사용. 단골 페이지는 응답 자체가 is_liked=true.

export default function Favorites() {
  const navigate = useNavigate()
  const [category, setCategory] = useState<Category>('전체')
  const [field, setField] = useState<string | null>(null)
  const [availableOnly, setAvailableOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [counselors, setCounselors] = useState<PublicCounselor[]>([])
  const [fieldOptions, setFieldOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    counselorsApi.filterOptions().then((r) => setFieldOptions(r.fields)).catch(() => {})
  }, [])

  // 카테고리 변경 시 백엔드 재조회
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    setPage(1)
    const cat = category === '전체' ? undefined : category
    counselorsApi
      .favorites({ category: cat, limit: 100 })
      .then((r) => {
        if (alive) setCounselors(r.items)
      })
      .catch((e) => {
        if (!alive) return
        if (e instanceof ApiError && e.status === 401) {
          navigate('/login', { replace: true, state: { from: '/favorites' } })
          return
        }
        setError(e instanceof Error ? e.message : '단골 상담사를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [category, navigate])

  /**
   * CounselorCard 내부에서 통합 LikeContext 가 API 를 호출하고 결과를 콜백으로 전달.
   * 단골 페이지는 unlike 시 즉시 목록에서 제거.
   */
  const onLikeToggle = (id: Counselor['id'], nextLiked: boolean) => {
    if (!nextLiked) {
      setCounselors((list) => list.filter((c) => c.id !== id))
    }
  }

  // 클라이언트 필터 (분야 = 해시태그 부분일치, 상담가능만)
  const filtered = useMemo(
    () =>
      counselors.filter((c) => {
        // 분야 필터 — hashtag1/2 에 키워드 포함
        if (field) {
          const tags = [c.hashtag1, c.hashtag2].filter((t): t is string => !!t)
          if (!tags.some((tag) => tag.includes(field))) return false
        }
        // 상담가능만
        if (availableOnly) {
          const phoneOk = c.use_phone && ['IDLE', 'RDVC', 'CRDY'].includes(c.state)
          const chatOk = c.use_chat && ['IDLE', 'RDCH', 'CRDY'].includes(c.state)
          if (!phoneOk && !chatOk) return false
        }
        return true
      }),
    [counselors, field, availableOnly],
  )

  // 페이지네이션
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pagedItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const resetPage = () => setPage(1)

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
          단골 상담사
        </h1>
        <div className="flex items-center gap-3">
          <Link to="/search" aria-label="검색" className="w-[30px] h-[30px] flex items-center justify-center">
            <img src="/img/ic_hd_search.svg" alt="" className="w-7 h-7" />
          </Link>
          <Link to="/notifications" aria-label="알림" className="w-[30px] h-[30px] flex items-center justify-center">
            <img src="/img/ic_hd_push.svg" alt="" className="w-7 h-7" />
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="px-4 pt-4 pb-3 flex gap-6">
          {CATEGORIES.map((c) => {
            const active = category === c
            return (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCategory(c)
                  resetPage()
                }}
                className={`text-[20px] leading-[120%] font-semibold transition ${
                  active ? 'text-[#8259F5]' : 'text-[#6A7282]'
                }`}
              >
                {c}
              </button>
            )
          })}
        </section>

        <section className="px-4 pt-1 pb-3 flex gap-1 items-center">
          <FilterDropdown
            label="분야"
            options={fieldOptions}
            value={field}
            onChange={(v) => {
              setField(v)
              resetPage()
            }}
          />
          <button
            type="button"
            aria-label="필터 초기화"
            onClick={() => {
              setField(null)
              resetPage()
            }}
            className="w-9 h-9 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] flex items-center justify-center shrink-0"
          >
            <img src="/img/ic_reset.svg" alt="" className="w-5 h-5" />
          </button>
        </section>

        <section className="px-4 py-3 flex items-center justify-between border-b border-[#F3F4F6]">
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(e) => {
                setAvailableOnly(e.target.checked)
                resetPage()
              }}
              className="w-[22px] h-[22px]"
            />
            <span className="text-[15px] leading-[120%] text-[#364153]">상담가능만 보기</span>
          </label>
          <p className="text-[14px] text-[#6A7282]">
            <span className="font-semibold text-[#8259F5]">{filtered.length}</span>명
          </p>
        </section>

        <section className="flex flex-col">
          {loading ? (
            <div className="py-20 text-center text-[14px] text-[#99A1AF]">불러오는 중…</div>
          ) : error ? (
            <div className="py-20 text-center text-[14px] text-[#FB2C36]">{error}</div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-[14px] text-[#99A1AF] py-16 whitespace-pre-line">
              {counselors.length === 0
                ? '아직 단골 상담사가 없습니다.\n메인에서 마음에 드는 상담사를 단골로 등록해보세요.'
                : '해당 조건의 단골 상담사가 없습니다.'}
            </p>
          ) : (
            pagedItems.map((c) => (
              <CounselorCard
                key={c.id}
                counselor={mapPublicCounselorToCard(c)}
                onLikeToggle={onLikeToggle}
              />
            ))
          )}
        </section>

        {!loading && !error && filtered.length > PAGE_SIZE && (
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </main>

      <FloatingActions bottomOffset={100} />

      <BottomNav />
    </div>
  )
}
