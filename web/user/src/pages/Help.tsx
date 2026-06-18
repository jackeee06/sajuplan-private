import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import {
  faqsApi,
  settingsApi,
  type PublicFaqCategory,
  type PublicFaqItem,
} from '../lib/api'
import { openExternalUrl } from '../lib/native-bridge'

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
          자주 묻는 질문
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
          {/* 문의는 마이 > 고객센터 문의 타일이 메인. 여기선 보조 진입만 작게 */}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/mypage/support-inquiries/new')}
              className="h-9 px-4 rounded-full border border-[#f472b6] bg-white text-[#ec4899] flex items-center justify-center text-[13px] font-medium"
            >
              1:1 문의하기
            </button>
            <button
              type="button"
              onClick={handleInquiry}
              className="h-9 px-3 rounded-full bg-white flex items-center justify-center gap-1.5 text-[13px] text-[#6A7282]"
            >
              <img src="/img/ic_write_p.svg" alt="" className="w-4 h-4" />
              카카오톡 채널
            </button>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-[18px] leading-[140%] font-bold text-[#030712] mb-2">
            자주 묻는 질문
          </h2>

          {/* 카테고리 탭 — 가로 스크롤 pill (전부 보임, 1탭 선택) */}
          <div className="-mx-4 px-4 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
            <div className="flex gap-2 w-max pb-0.5">
              {[ALL_LABEL, ...categories.map((c) => c.title)].map((c) => {
                const selected = c === category
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setCategory(c)
                      setOpenId(null)
                    }}
                    className={`shrink-0 h-9 px-4 rounded-full text-[14px] font-medium whitespace-nowrap transition-colors ${
                      selected
                        ? 'bg-[#f472b6] text-white'
                        : 'bg-[#F9FAFB] text-[#6A7282] border border-[#F3F4F6]'
                    }`}
                  >
                    {c}
                  </button>
                )
              })}
            </div>
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
            {filtered.map((f) => {
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
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav />
    </div>
  )
}
