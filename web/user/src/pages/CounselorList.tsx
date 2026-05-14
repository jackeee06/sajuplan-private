import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import CounselorCard from '../components/CounselorCard'
import FilterDropdown from '../components/FilterDropdown'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import { ApiError, counselorsApi, type PublicCounselor } from '../lib/api'
import { mapPublicCounselorToCard } from '../lib/counselor-mapper'

type Category = '전체' | '사주' | '타로' | '신점'
const CATEGORIES: Category[] = ['전체', '사주', '타로', '신점']

const PAGE_SIZE = 10

/**
 * 상담사 리스트 — Figma 1:765 (03전체리스트)
 *
 * 백엔드 연동:
 *   GET /api/user/counselors?category=&limit=
 *   GET /api/user/counselors/filter-options  → 분야 옵션 동적 (DB 의 실제 hashtag)
 *
 * 좋아요는 CounselorCard 내부의 LikeContext 가 통합 처리.
 */
export default function CounselorList() {
  const navigate = useNavigate()
  const [category, setCategory] = useState<Category>('전체')
  const [field, setField] = useState<string | null>(null)
  const [availableOnly, setAvailableOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [counselors, setCounselors] = useState<PublicCounselor[]>([])
  const [fieldOptions, setFieldOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 분야 옵션은 한 번만 로드
  useEffect(() => {
    counselorsApi
      .filterOptions()
      .then((r) => setFieldOptions(r.fields))
      .catch(() => {
        /* 옵션 로드 실패해도 리스트는 동작 */
      })
  }, [])

  // 카테고리 변경 시 백엔드 재조회 + 30초 폴링 + 페이지 복귀 시 재조회
  useEffect(() => {
    let alive = true
    const cat = category === '전체' ? undefined : category
    let pollTimer: number | null = null

    const fetchList = (showLoading: boolean) => {
      if (!alive) return
      if (showLoading) {
        setLoading(true)
        setError(null)
      }
      counselorsApi
        .list({ tab: 'all', category: cat, limit: 50 })
        .then((r) => {
          if (alive) setCounselors(r.items)
        })
        .catch((e) => {
          if (!alive) return
          // 폴링 중 일시적 실패는 기존 리스트 유지
          if (showLoading) {
            if (e instanceof ApiError) setError(e.message)
            else setError('상담사를 불러오지 못했습니다.')
          }
        })
        .finally(() => {
          if (alive && showLoading) setLoading(false)
        })
    }

    setPage(1)
    fetchList(true)
    // 30초마다 백그라운드 갱신 (state 변동 — 상담중/대기 등 — 반영)
    pollTimer = window.setInterval(() => fetchList(false), 30_000)
    // 페이지 가시화/포커스 시 즉시 갱신 (탭 복귀 케이스)
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchList(false)
    }
    const onPageShow = () => fetchList(false)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      alive = false
      if (pollTimer) window.clearInterval(pollTimer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [category])

  // 클라이언트 필터: 분야(hashtag 포함) + 상담가능만
  const filtered = useMemo(
    () =>
      counselors.filter((c) => {
        if (field) {
          const tags = [c.hashtag1, c.hashtag2].filter((t): t is string => !!t)
          if (!tags.some((tag) => tag.includes(field))) return false
        }
        if (availableOnly) {
          const phoneOk = c.use_phone && ['IDLE', 'RDVC', 'CRDY'].includes(c.state)
          const chatOk = c.use_chat && ['IDLE', 'RDCH', 'CRDY'].includes(c.state)
          if (!phoneOk && !chatOk) return false
        }
        return true
      }),
    [counselors, field, availableOnly],
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pagedItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const resetPage = () => setPage(1)

  return (
    <div className="mobile-frame flex flex-col pb-[100px]">
      {/* 헤더 — hd2 (Figma 1:465) */}
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
          상담사 리스트
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
        {/* main_tab01 — 4 카테고리 */}
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

        {/* filter_select — 분야만 (스타일/성별은 신 DB 컬럼 미보유라 제외) */}
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
            <p className="text-center text-[14px] text-[#99A1AF] py-10">
              해당 조건의 상담사가 없습니다.
            </p>
          ) : (
            pagedItems.map((c) => (
              <CounselorCard key={c.id} counselor={mapPublicCounselorToCard(c)} />
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
