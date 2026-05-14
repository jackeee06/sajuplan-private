import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import { counselorsApi } from '../lib/api'

interface PopularKeyword {
  rank: number
  keyword: string
  isNew?: boolean
}

// 첫 로드 전엔 빈 리스트(스켈레톤). API 실패 시 정적 fallback 으로 빈 화면 회피.
const FALLBACK_POPULAR: PopularKeyword[] = [
  { rank: 1, keyword: '사주' },
  { rank: 2, keyword: '타로' },
  { rank: 3, keyword: '신점' },
  { rank: 4, keyword: '연애운' },
  { rank: 5, keyword: '재물운' },
  { rank: 6, keyword: '궁합' },
]

/**
 * 검색 — Figma 163:21616 (02홈_검색)
 *
 * 헤더: 60×390, padding 0/16, gap 12 (← + input(h40, radius 1000) + 🔍)
 * 본문: y=80, width 358, column gap 20 (제목 + 리스트)
 *  - 제목 "인기 검색어" 18/600/120% #101828
 *  - 리스트: column gap 20, 각 항목 row gap 16 items center
 *    - 순위 16/700/120% #8259F5
 *    - 검색어 16/400/120% #1E2939 (flex-1)
 *    - NEW 16/500/120% #FF6467 (옵션)
 */
export default function Search() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [popular, setPopular] = useState<PopularKeyword[]>([])

  // 인기 검색어 = 활성 상담사들의 해시태그 빈도 상위 (백엔드 v1).
  // API 실패 시 정적 fallback 으로 화면이 비지 않도록.
  useEffect(() => {
    let alive = true
    counselorsApi.popularKeywords(6).then(
      (r) => {
        if (!alive) return
        const items = (r?.items ?? []).map((it) => ({
          rank: it.rank,
          keyword: it.keyword,
          isNew: it.isNew,
        }))
        setPopular(items.length > 0 ? items : FALLBACK_POPULAR)
      },
      () => {
        if (!alive) return
        setPopular(FALLBACK_POPULAR)
      },
    )
    return () => {
      alive = false
    }
  }, [])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const term = q.trim()
    if (!term) return
    navigate(`/search/result?q=${encodeURIComponent(term)}`)
  }

  return (
    <div className="mobile-frame flex flex-col pb-[100px]">
      {/* 헤더 — Figma 163:22101 (hd9) */}
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-7 h-7" />
        </button>
        <form onSubmit={onSubmit} className="flex-1">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            placeholder="상담사, 상담분야, 해시태그 검색"
            className="w-full h-10 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] px-4 py-1 text-[15px] leading-[150%] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none focus:border-[#8259F5] focus:bg-white transition"
          />
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

      <main className="flex-1 px-4 pt-5">
        <section className="flex flex-col gap-5">
          <h2 className="text-[18px] font-semibold leading-[120%] text-[#101828]">
            인기 검색어
          </h2>
          <ul className="flex flex-col gap-5">
            {popular.map((item) => (
              <li key={item.rank}>
                <button
                  type="button"
                  onClick={() => navigate(`/search/result?q=${encodeURIComponent(item.keyword)}`)}
                  className="w-full flex items-center gap-4 text-left"
                >
                  <span className="text-[16px] font-bold leading-[120%] text-[#8259F5] tabular-nums">
                    {item.rank}
                  </span>
                  <span className="flex-1 text-[16px] font-normal leading-[120%] text-[#1E2939]">
                    {item.keyword}
                  </span>
                  {item.isNew && (
                    <span className="text-[16px] font-medium leading-[120%] text-[#FF6467]">
                      NEW
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <BottomNav />
    </div>
  )
}
