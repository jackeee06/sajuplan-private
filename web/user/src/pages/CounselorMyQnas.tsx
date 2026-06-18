import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import { COUNSELOR_MY_QNA_CATEGORIES, type CounselorMyQnaCategory } from '../data/counselorMyPage'
import { counselorInquiryApi, type CounselorInquiryListItem } from '../lib/api'

const PAGE_SIZE = 10

type Tab = '전체' | CounselorMyQnaCategory

/**
 * 08마이페이지_상담사_문의하기 (상담사 → 운영자 1:1 고객센터 문의 목록)
 * Figma node-id: 179:15834
 *
 * 상단 배너 + 검색 + 메인 탭 5종 + 실데이터 카드 리스트.
 */
export default function CounselorMyQnas() {
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [tab, setTab] = useState<Tab>('전체')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<CounselorInquiryListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // 내 문의 삭제 — 본인 문의만(소프트 삭제). 답변 완료 여부와 무관하게 가능.
  //   삭제 후 목록 GET 은 2초 캐시라 즉시 재조회하면 옛 목록이 올 수 있어, 화면에서 낙관적으로 바로 제거.
  const handleDelete = (id: number) => {
    if (deletingId != null) return
    if (!window.confirm('이 문의를 삭제할까요? 삭제하면 목록에서 사라집니다.')) return
    setDeletingId(id)
    counselorInquiryApi
      .remove(id)
      .then(() => {
        if (items.length === 1 && page > 1) {
          setPage((p) => p - 1) // 마지막 1건이었으면 이전 페이지로 (다른 경로라 캐시 안 탐)
        } else {
          setItems((prev) => prev.filter((it) => it.id !== id))
          setTotal((t) => Math.max(0, t - 1))
        }
      })
      .catch((e) => alert(e instanceof Error ? e.message : '삭제에 실패했어요.'))
      .finally(() => setDeletingId(null))
  }

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    const t = setTimeout(() => {
      counselorInquiryApi
        .list({
          category: tab === '전체' ? null : tab,
          keyword: keyword.trim() || undefined,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        })
        .then((res) => {
          if (!alive) return
          setItems(res.items)
          setTotal(res.total)
        })
        .catch((e) => {
          if (!alive) return
          setError(e instanceof Error ? e.message : '문의 내역을 불러오지 못했어요.')
          setItems([])
          setTotal(0)
        })
        .finally(() => alive && setLoading(false))
    }, keyword ? 250 : 0)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [tab, page, keyword])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">문의하기</h1>
      </header>

      <main className="flex-1">
        {/* 상단 강조 배너 */}
        <section className="px-4 pt-2">
          <p className="text-[18px] font-bold leading-[140%] text-[#8259F5]">
            궁금하신 점이 있으신가요?
          </p>
          <p className="mt-1 text-[14px] leading-[140%] text-[#6A7282]">
            자주하는 질문에서 빠르게 확인이 가능합니다!
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => navigate('/counselor/mypage/tips')}
              className="h-11 rounded-full border border-[#8259F5] text-[14px] font-medium text-[#8259F5]"
            >
              자주하는 질문
            </button>
            <button
              type="button"
              onClick={() => navigate('/counselor/mypage/qnas/new')}
              className="h-11 rounded-full bg-[#8259F5] text-[14px] font-semibold text-white"
            >
              문의하기
            </button>
          </div>
        </section>

        {/* 검색 */}
        <section className="px-4 pt-4 pb-3">
          <div className="relative">
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

        {/* 메인 탭 */}
        <div className="px-4 border-b border-[#F3F4F6]">
          <div className="flex">
            {(['전체', ...COUNSELOR_MY_QNA_CATEGORIES] as Tab[]).map((t) => {
              const on = tab === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTab(t)
                    setPage(1)
                  }}
                  className={`relative h-11 flex-1 px-2 text-[14px] ${
                    on ? 'text-[#8259F5] font-bold' : 'text-[#6A7282]'
                  }`}
                >
                  {t}
                  {on && <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-[#8259F5]" />}
                </button>
              )
            })}
          </div>
        </div>

        {loading ? (
          <p className="px-4 py-10 text-center text-[14px] text-[#99A1AF]">불러오는 중…</p>
        ) : error ? (
          <p className="px-4 py-10 text-center text-[14px] text-[#FF6467]">{error}</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-10 text-center text-[14px] text-[#99A1AF]">등록된 문의가 없습니다.</p>
        ) : (
          <ul className="flex flex-col">
            {items.map((q) => (
              <li key={q.id} className="relative border-b border-[#F3F4F6]">
                <button
                  type="button"
                  onClick={() => navigate(`/counselor/mypage/qnas/${q.id}`)}
                  className="block w-full text-left px-4 py-3 pr-14"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center h-[22px] px-2 rounded-full text-[12px] leading-none font-medium ${
                        q.status === 'answered'
                          ? 'bg-[#f3f0ff] text-[#8259F5]'
                          : 'bg-[#F3F4F6] text-[#6A7282]'
                      }`}
                    >
                      {q.status === 'answered' ? '답변완료' : '답변대기'}
                    </span>
                    <span className="text-[14px] font-medium text-[#8259F5]">{q.category}</span>
                    <span className="text-[15px] font-semibold text-[#030712] break-keep">
                      {q.title}
                    </span>
                  </div>
                  <p className="mt-1 text-[14px] leading-[140%] text-[#6A7282] line-clamp-2">
                    {q.content}
                  </p>
                  <p className="mt-1 text-[13px] leading-[140%] text-[#99A1AF]">{formatDate(q.created_at)}</p>
                </button>
                {/* 본인 문의 삭제 (소프트 삭제) — 2026-06-15 상담사 요청 */}
                <button
                  type="button"
                  onClick={() => handleDelete(q.id)}
                  disabled={deletingId === q.id}
                  aria-label="문의 삭제"
                  className="absolute top-2.5 right-2 w-8 h-8 flex items-center justify-center text-[#C0C4CC] hover:text-[#FF6467] disabled:opacity-40"
                >
                  {deletingId === q.id ? (
                    <span className="text-[11px]">…</span>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {!loading && !error && items.length > 0 && (
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav myHref="/counselor/mypage" />
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}
