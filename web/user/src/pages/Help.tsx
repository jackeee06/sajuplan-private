import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import {
  faqsApi,
  settingsApi,
  type PublicFaqCategory,
  type PublicFaqItem,
} from '../lib/api'
import { openExternalUrl } from '../lib/native-bridge'

const PAGE_SIZE = 5
const ALL_LABEL = '전체'

/**
 * 이용안내 — Figma 06마이페이지(비회원) > 이용안내 (+ 빈 상태)
 *
 * 데이터 소스:
 *  - 카테고리: GET /user/faqs/categories
 *  - 항목:    GET /user/faqs (선택 시 ?category_id=N)
 *  - 카카오 채널: site.kakao_channel_url (어드민 사이트설정)
 *
 * 1:1 문의는 카카오 1:1 채널로 위임 (외부 URL).
 * SSR 호환: window/document 직접 사용 금지 — 모든 fetch 는 useEffect 내부.
 */
export default function Help() {
  const navigate = useNavigate()

  // 카테고리: '전체' + 서버에서 받은 활성 카테고리 (faq 가 1개 이상인 것만)
  const [categories, setCategories] = useState<PublicFaqCategory[]>([])
  const [faqs, setFaqs] = useState<PublicFaqItem[]>([])
  const [kakaoUrl, setKakaoUrl] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const [category, setCategory] = useState<string>(ALL_LABEL)
  const [catOpen, setCatOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([
      faqsApi.categories(),
      faqsApi.list(),
      settingsApi.public().catch(() => ({}) as Record<string, string>),
    ])
      .then(([cats, items, settings]) => {
        if (!alive) return
        const visibleCats = cats.items.filter((c) => c.faq_count > 0)
        setCategories(visibleCats)
        setFaqs(items.items)
        setOpenId(items.items[0]?.id ?? null)
        setKakaoUrl(settings['site.kakao_channel_url'] ?? '')
        setError(null)
      })
      .catch(() => {
        if (!alive) return
        setError('FAQ를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const filtered = useMemo(() => {
    if (category === ALL_LABEL) return faqs
    return faqs.filter((f) => f.category_title === category)
  }, [category, faqs])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const isEmpty = !loading && filtered.length === 0

  const handleInquiry = () => {
    if (kakaoUrl) {
      openExternalUrl(kakaoUrl)
      return
    }
    // 어드민에 채널 URL 미등록 — 사주플랜 채널로 폴백
    openExternalUrl('https://pf.kakao.com/_IhVbX/chat')
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
          이용안내
        </h1>
      </header>

      <main className="flex-1 px-4 pt-2">
        <section className="rounded-[16px] bg-[#F9FAFB] p-5">
          <div className="flex items-center gap-3">
            <img src="/img/ic_my_phone.svg" alt="" className="w-10 h-10" />
            <div className="flex flex-col">
              <span className="text-[18px] leading-[140%] font-bold text-[#ec4899]">
                고객센터
              </span>
              <span className="text-[13px] leading-[140%] text-[#4A5565]">
                운영시간: 9시~18시 (주말 및 공휴일 휴무)
              </span>
              <span className="text-[13px] leading-[140%] text-[#4A5565]">
                점심시간: 12시~13시
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleInquiry}
            className="mt-4 w-full h-[44px] rounded-full border border-[#f472b6] bg-white flex items-center justify-center gap-1.5 text-[15px] font-medium text-[#ec4899]"
          >
            <img src="/img/ic_write_p.svg" alt="" className="w-5 h-5" />
            카카오 1:1 문의
          </button>
        </section>

        <section className="mt-6">
          <h2 className="text-[18px] leading-[140%] font-bold text-[#030712] mb-2">
            자주 묻는 질문
          </h2>

          <div className="relative">
            <button
              type="button"
              onClick={() => setCatOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={catOpen}
              className="w-full h-[48px] px-4 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] flex items-center justify-between text-[15px] text-[#1E2939]"
            >
              <span className={category === ALL_LABEL ? 'text-[#99A1AF]' : 'text-[#1E2939]'}>
                {category === ALL_LABEL ? '카테고리 선택' : category}
              </span>
              <svg
                viewBox="0 0 16 16"
                className={`w-4 h-4 transition-transform ${catOpen ? 'rotate-180' : ''}`}
                fill="none"
                aria-hidden
              >
                <path
                  d="M4 6L8 10L12 6"
                  stroke="#6A7282"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {catOpen && (
              <ul
                role="listbox"
                aria-label="카테고리"
                className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 max-h-[260px] overflow-y-auto bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_8px_20px_rgba(16,24,40,0.08)] py-1"
              >
                {[ALL_LABEL, ...categories.map((c) => c.title)].map((c) => {
                  const selected = c === category
                  return (
                    <li key={c}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          setCategory(c)
                          setCatOpen(false)
                          setPage(1)
                          setOpenId(null)
                        }}
                        className={`w-full px-4 py-2.5 text-left text-[15px] leading-5 ${
                          selected
                            ? 'text-[#ec4899] font-medium bg-[#fdf2f8]'
                            : 'text-[#1E2939] hover:bg-[#F9FAFB]'
                        }`}
                      >
                        {c}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        {loading ? (
          <section className="pt-[64px] flex flex-col items-center">
            <p className="text-[15px] text-[#6A7282]">불러오는 중…</p>
          </section>
        ) : error ? (
          <section className="pt-[64px] flex flex-col items-center">
            <p className="text-[15px] text-[#FF6467]">{error}</p>
          </section>
        ) : isEmpty ? (
          <section className="pt-[64px] flex flex-col items-center">
            <div className="w-[80px] h-[80px] rounded-full bg-[#fdf2f8] flex items-center justify-center">
              <img src="/img/ic_message_p.svg?v=v2" alt="" className="w-9 h-9" />
            </div>
            <p className="mt-4 text-[18px] leading-[140%] font-bold text-[#030712]">
              등록된 질문이 없습니다.
            </p>
            <p className="mt-2 text-[15px] leading-[150%] text-[#6A7282] text-center">
              궁금하신 부분이 있다면<br />1:1문의를 통해 문의 해주세요
            </p>
          </section>
        ) : (
          <ul className="mt-2 flex flex-col">
            {pageItems.map((f) => {
              const open = openId === f.id
              return (
                <li key={f.id} className="border-b border-[#F3F4F6]">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : f.id)}
                    aria-expanded={open}
                    className="w-full py-4 flex items-center gap-3 text-left"
                  >
                    <span className="w-7 h-7 rounded-full bg-[#f472b6] text-white text-[14px] font-bold flex items-center justify-center shrink-0">
                      Q
                    </span>
                    <span className="flex-1 text-[15px] leading-[140%] font-semibold text-[#030712]">
                      {f.question}
                    </span>
                    <svg
                      viewBox="0 0 16 16"
                      className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M4 6L8 10L12 6"
                        stroke="#6A7282"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  {open && (
                    <div className="pb-4">
                      <p className="text-[14px] leading-[160%] text-[#4A5565] whitespace-pre-line">
                        {f.answer}
                      </p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {!loading && !error && !isEmpty && (
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav />
    </div>
  )
}
