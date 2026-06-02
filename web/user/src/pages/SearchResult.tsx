import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import CounselorCard from '../components/CounselorCard'
import { counselorsApi, type PublicCounselor } from '../lib/api'
import { mapPublicCounselorToCard } from '../lib/counselor-mapper'

/**
 * 검색 결과 — Figma 163:22619 (02홈_검색결과), 결과 없음 163:22750
 *
 *  헤더(60×390): ←(30) + 인풋(h40, radius 1000, bg #F9FAFB, border #F3F4F6) + 🔍(30)
 *  본문: 카드 리스트 + "검색결과 더보기 ⌄" 버튼
 *  결과 없음: nodata_search 이미지 + 안내 텍스트
 *  하단: BottomNav (홈과 동일)
 *
 *  URL: /search/result?q=...
 */
export default function SearchResult() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const initialQ = params.get('q') ?? ''
  const [q, setQ] = useState(initialQ)
  const [counselors, setCounselors] = useState<PublicCounselor[]>([])
  const [loading, setLoading] = useState(false)
  const [shownCount, setShownCount] = useState(2)

  // URL의 q 가 바뀔 때마다 백엔드 검색 호출.
  // 좋아요는 CounselorCard 내부 LikeContext 가 처리 → 응답 그대로 표시.
  useEffect(() => {
    const term = (params.get('q') ?? '').trim()
    setShownCount(2)
    if (!term) {
      setCounselors([])
      return
    }
    let alive = true
    setLoading(true)
    counselorsApi.search(term, 30).then(
      (r) => {
        if (!alive) return
        setCounselors(r?.items ?? [])
        setLoading(false)
      },
      () => {
        if (!alive) return
        setCounselors([])
        setLoading(false)
      },
    )
    return () => {
      alive = false
    }
  }, [params])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const term = q.trim()
    if (!term) return
    // replace 로 같은 페이지의 query 만 갈아치움 — 검색을 여러 번 해도
    // 백키 history 가 쌓이지 않게.
    navigate(`/search/result?q=${encodeURIComponent(term)}`, { replace: true })
  }

  const visible = counselors.slice(0, shownCount)
  const canShowMore = shownCount < counselors.length

  return (
    <div className="mobile-frame flex flex-col pb-[100px]">
      {/* 헤더 — Figma 163:22101 (hd9) — padding 0/16, gap 12, blur 7 */}
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-7 h-7" />
        </button>
        <form onSubmit={onSubmit} className="flex-1 relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="상담사, 상담분야, 해시태그 검색"
            className="w-full h-10 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] px-4 pr-10 py-1 text-[15px] leading-[150%] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none focus:border-[#ec4899] focus:bg-white transition"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              aria-label="입력 지우기"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#4A5565] hover:bg-[#1E2939] transition flex items-center justify-center"
            >
              <svg viewBox="0 0 10 10" className="w-2.5 h-2.5">
                <path d="M2 2L8 8M8 2L2 8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </form>
        <button
          type="button"
          aria-label="검색"
          onClick={() => onSubmit({ preventDefault: () => {} } as FormEvent)}
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_search.svg" alt="" className="w-7 h-7" />
        </button>
      </header>

      <main className="flex-1">
        {loading ? (
          <div className="pt-20 flex justify-center">
            <div className="w-6 h-6 border-2 border-[#E5E7EB] border-t-[#ec4899] rounded-full animate-spin" />
          </div>
        ) : counselors.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="px-4 py-3 flex flex-col gap-3">
              {visible.map((c) => (
                <CounselorCard key={c.id} counselor={mapPublicCounselorToCard(c)} />
              ))}
            </div>
            {canShowMore && (
              <div className="flex justify-center pt-2 pb-4">
                <button
                  type="button"
                  onClick={() => setShownCount((n) => n + 2)}
                  className="inline-flex items-center gap-1 h-10 px-5 rounded-full border border-[#E5E7EB] bg-white text-[14px] text-[#364153] font-medium hover:bg-[#F9FAFB] transition"
                >
                  검색결과 더보기
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="#364153" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 6L8 10L12 6" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="pt-20 flex flex-col items-center text-center px-4">
      <img src="/img/nodata_search.png" alt="" className="w-20 h-20 mb-4 opacity-90" />
      <p className="text-[15px] leading-relaxed text-[#4A5565]">
        검색된 결과가 없습니다.
        <br />
        다른 키워드로 다시 검색해보세요.
      </p>
    </div>
  )
}
