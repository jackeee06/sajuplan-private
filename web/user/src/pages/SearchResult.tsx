import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import CounselorCard, { Counselor } from '../components/CounselorCard'

// 더미 결과 — 백엔드 연동 전 퍼블리싱 검증용. 검색 API 붙으면 제거.
const MOCK_DB: Counselor[] = [
  {
    id: 1, name: '김선녀', code: '224587', badge: '신점',
    tagline: '마음을 읽는 신점', pricePerSec: 1500,
    phoneState: 'available', chatState: 'available',
    hashtags: ['삼재상담', '연애운'], rating: 4.8, reviewCount: 92,
    liked: false, imgUrl: '/img/sample_img02.jpg',
  },
  {
    id: 2, name: '사주선녀', code: '165791', badge: '사주',
    tagline: '속 시원하게 풀어드립니다', pricePerSec: 1000,
    phoneState: 'busy', chatState: 'busy',
    hashtags: ['신년운세', '금전운'], rating: 4.7, reviewCount: 106,
    liked: false, imgUrl: '/img/sample_img03.jpg',
  },
  {
    id: 3, name: '달빛도사', code: '331204', badge: '타로',
    tagline: '재회·궁합 전문 12년 경력', pricePerSec: 1200,
    phoneState: 'available', chatState: 'available',
    hashtags: ['재회', '궁합', '타로'], rating: 4.9, reviewCount: 248,
    liked: false, imgUrl: '/img/sample_img04.jpg',
  },
  {
    id: 4, name: '하늘선녀', code: '402915', badge: '신점',
    tagline: '솔직하고 시원한 답변', pricePerSec: 1800,
    phoneState: 'busy', chatState: 'available',
    hashtags: ['재회', '직장운', '신점'], rating: 4.6, reviewCount: 53,
    liked: false, imgUrl: '/img/sample_img01.jpg',
  },
  {
    id: 5, name: '운명도사', code: '518273', badge: '사주',
    tagline: '인연의 흐름을 읽어드립니다', pricePerSec: 900,
    phoneState: 'offline', chatState: 'offline',
    hashtags: ['궁합', '재회', '연애운'], rating: 4.5, reviewCount: 71,
    liked: false, imgUrl: '/img/sample_img02.jpg',
  },
]

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
  const [counselors, setCounselors] = useState<Counselor[]>([])
  const [shownCount, setShownCount] = useState(2)

  useEffect(() => {
    // TODO: 검색 API 연동 시 교체.
    // 퍼블 검증용 임시 로직: term이 비어있으면 빈 결과(no-data 화면 확인용),
    // 그 외엔 이름·태그라인·해시태그 부분 매칭. 매칭이 하나도 없으면 전체 노출(시안 확인용).
    const term = (params.get('q') ?? '').trim().toLowerCase()
    if (!term) {
      setCounselors([])
      return
    }
    const matched = MOCK_DB.filter((c) =>
      c.name.toLowerCase().includes(term) ||
      c.tagline.toLowerCase().includes(term) ||
      c.hashtags.some((t) => t.toLowerCase().includes(term)),
    )
    setCounselors(matched.length > 0 ? matched : MOCK_DB)
  }, [params])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const term = q.trim()
    if (!term) return
    navigate(`/search/result?q=${encodeURIComponent(term)}`)
  }

  const onLikeToggle = (id: Counselor['id']) =>
    setCounselors((prev) => prev.map((c) => (c.id === id ? { ...c, liked: !c.liked } : c)))

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
            className="w-full h-10 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] px-4 pr-10 py-1 text-[15px] leading-[150%] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none focus:border-[#8259F5] focus:bg-white transition"
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
        {counselors.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="px-4 py-3 flex flex-col gap-3">
              {visible.map((c) => (
                <CounselorCard key={c.id} counselor={c} onLikeToggle={onLikeToggle} />
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
