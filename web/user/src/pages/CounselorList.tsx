import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import CounselorCard from '../components/CounselorCard'
import FloatingActions from '../components/FloatingActions'
import { ApiError, counselorsApi, statsApi, type PublicCounselor } from '../lib/api'
import { mapPublicCounselorToCard } from '../lib/counselor-mapper'

type Category = '전체' | '사주' | '타로' | '신점'
const CATEGORIES: Category[] = ['전체', '사주', '타로', '신점']

// 2026-05-22: 페이지네이션 → 누적 더보기 (한 번에 전체 펼침).
const INITIAL_VISIBLE = 10

// 분야 칩에서 제외할 hashtag — 상위 카테고리(사주/타로/신점) 와 중복.
// 데이터(post_counselor.hashtag) 자체에 큰 카테고리가 섞여 들어와 있어서 클라이언트에서 거른다.
// 운영 안정화 후 Phase C 에서 DB 데이터 정리 예정.
const EXCLUDED_FIELDS = new Set<string>(['사주', '타로', '신점'])

// 강조 줄(이벤트 칩과 같은 줄)에 항상 노출할 PINNED 분야 칩.
// emoji 가 ⭐이벤트 와 시각적으로 묶여 위계가 생긴다.
// (사장님 결정 2026-05-29: 재회 수요 큼 → 진입점 항상 제공)
type PinnedField = { name: string; emoji: string }
const PINNED_FIELDS: PinnedField[] = [{ name: '재회', emoji: '💕' }]
const PINNED_NAMES = new Set(PINNED_FIELDS.map((p) => p.name))

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
  const [eventOnly, setEventOnly] = useState(false)
  // 누적 노출 개수 — 필터 바뀌면 INITIAL_VISIBLE 로 리셋, "더보기" 누르면 한 번에 전체 펼침
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)
  const [counselors, setCounselors] = useState<PublicCounselor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // 메인 화면의 "접속중상담사 N명" 과 동일한 보정값 적용 (어드민 override 포함).
  // 전체 + 무필터 일 때만 사용 — 필터 적용 시는 실제 필터 결과 수가 정직하다.
  const [boostedCount, setBoostedCount] = useState<number | null>(null)

  useEffect(() => {
    statsApi.main().then(
      (r) => setBoostedCount(r.online_counselors),
      () => {
        /* 실패 시 실수만 — 사용자 화면엔 영향 X */
      },
    )
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
        .list({ tab: 'all', category: cat, limit: 300, event: eventOnly })
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

    setVisibleCount(INITIAL_VISIBLE)
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
  }, [category, eventOnly])

  // 일반 분야 칩(2번째 줄~) — 현재 카테고리 안의 상담사들의 실제 hashtag 에서만 추출.
  // 큰 카테고리(사주/타로/신점) 는 EXCLUDED_FIELDS 로 제외(중복 방지).
  // PINNED 항목(재회 등)은 강조 줄에서 따로 그리므로 일반 줄에서는 제외.
  const regularFields = useMemo(() => {
    const fromCounselors = new Set<string>()
    counselors.forEach((c) => {
      if (c.hashtag1) fromCounselors.add(c.hashtag1)
      if (c.hashtag2) fromCounselors.add(c.hashtag2)
    })
    EXCLUDED_FIELDS.forEach((b) => fromCounselors.delete(b))
    PINNED_NAMES.forEach((b) => fromCounselors.delete(b))
    return Array.from(fromCounselors).sort((a, b) => a.localeCompare(b, 'ko'))
  }, [counselors])

  // 현재 카테고리의 전체 칩 라벨(PINNED + regular) — 활성 칩 자동 해제 판정용
  const allFieldNames = useMemo(
    () => new Set<string>([...PINNED_FIELDS.map((p) => p.name), ...regularFields]),
    [regularFields],
  )

  // 선택된 분야가 현재 카테고리의 칩 목록에 더 이상 없으면 자동 해제 (탭 전환 시 사용자 혼란 방지).
  useEffect(() => {
    if (field && !allFieldNames.has(field)) {
      setField(null)
    }
  }, [field, allFieldNames])

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

  const visibleItems = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  // 필터 변경 시 누적 노출도 처음으로 리셋
  const resetPage = () => setVisibleCount(INITIAL_VISIBLE)

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
                  active ? 'text-[#ec4899]' : 'text-[#6A7282]'
                }`}
              >
                {c}
              </button>
            )
          })}
        </section>

        {/* 강조 칩 줄 — 이벤트 상담사 + PINNED 분야(재회).
            2026-05-29: 칩 사이즈/간격을 조밀화 (h-8, px-2.5, gap-1.5, text-13)
            — 사장님 피드백 "떠다니는 느낌" 해소. */}
        <section className="px-4 pt-2 pb-1.5 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setEventOnly((v) => !v)
              resetPage()
            }}
            className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-full text-[13px] leading-[1.2] font-medium transition ${
              eventOnly
                ? 'bg-[#fdf2f8] text-[#ec4899] border border-[#f472b6]'
                : 'bg-[#F9FAFB] text-[#6A7282] border border-[#E5E7EB]'
            }`}
          >
            <span aria-hidden>⭐</span>
            <span>이벤트 상담사</span>
          </button>
          {PINNED_FIELDS.map((p) => {
            const active = field === p.name
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  setField(active ? null : p.name)
                  resetPage()
                }}
                className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-full text-[13px] leading-[1.2] font-medium transition ${
                  active
                    ? 'bg-[#fdf2f8] text-[#ec4899] border border-[#f472b6]'
                    : 'bg-[#F9FAFB] text-[#6A7282] border border-[#E5E7EB]'
                }`}
              >
                <span aria-hidden>{p.emoji}</span>
                <span>{p.name}</span>
              </button>
            )
          })}
        </section>

        {/* 구분선 — 강조 줄과 일반 분야 줄 사이의 위계 표현 */}
        <div className="mx-4 border-t border-[#F3F4F6]" />

        {/* 일반 분야 칩 — 가나다순. 큰 카테고리(사주/타로/신점)와 PINNED 는 제외. */}
        <section className="px-4 pt-1.5 pb-2 flex flex-wrap items-center gap-1.5">
          {regularFields.map((opt) => {
            const active = field === opt
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  setField(active ? null : opt)
                  resetPage()
                }}
                className={`h-8 px-2.5 rounded-full text-[13px] leading-[1.2] font-medium transition ${
                  active
                    ? 'bg-[#fdf2f8] text-[#ec4899] border border-[#f472b6]'
                    : 'bg-[#F9FAFB] text-[#6A7282] border border-[#E5E7EB]'
                }`}
              >
                {opt}
              </button>
            )
          })}
          {(field !== null || eventOnly) && (
            <button
              type="button"
              aria-label="필터 초기화"
              onClick={() => {
                setField(null)
                setEventOnly(false)
                resetPage()
              }}
              className="w-8 h-8 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center shrink-0"
            >
              <img src="/img/ic_reset.svg" alt="" className="w-4 h-4" />
            </button>
          )}
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
            <span className="font-semibold text-[#ec4899]">
              {(() => {
                // 전체 + 분야 무선택 + 이벤트 미사용 + 상담가능만 미사용 = "전체 카운트"
                // → 메인 화면 "접속중상담사 N명" 과 동일한 boost 값 노출.
                const isAllUnfiltered =
                  category === '전체' && !field && !eventOnly && !availableOnly
                if (isAllUnfiltered && boostedCount != null) return boostedCount
                return filtered.length
              })()}
            </span>
            명
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
            visibleItems.map((c) => (
              <CounselorCard key={c.id} counselor={mapPublicCounselorToCard(c)} />
            ))
          )}
        </section>

        {/* 더보기 (2026-05-22) — 클릭 시 한 번에 모두 펼침. 풀폭 큰 버튼으로 존재감 강조. */}
        {!loading && !error && filtered.length > 0 && (
          <div className="px-4 pt-3 pb-6">
            {hasMore ? (
              <button
                type="button"
                onClick={() => setVisibleCount(filtered.length)}
                className="w-full h-14 rounded-2xl border border-[#f472b6] bg-white text-[16px] text-[#ec4899] font-semibold flex items-center justify-center gap-2 hover:bg-[#fdf2f8] transition shadow-[0_2px_8px_rgba(244,114,182,0.12)]"
              >
                <span>더보기</span>
                <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-[#ec4899] fill-none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            ) : (
              <p className="text-center text-[13px] text-[#99A1AF]">
                모든 상담사를 확인했어요 ✨
              </p>
            )}
          </div>
        )}
      </main>

      <FloatingActions bottomOffset={100} />

      <BottomNav />
    </div>
  )
}
