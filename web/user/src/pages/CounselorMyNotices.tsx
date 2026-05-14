import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FilterDropdown from '../components/FilterDropdown'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import { noticesApi, type PublicNoticeListItem } from '../lib/api'
import { useDebouncedValue } from '../lib/use-debounced-value'

const PAGE_SIZE = 10

/**
 * 08마이페이지_상담사_상담사 공지사항 — 백엔드 연동.
 *
 * 회원 공지사항과 동일한 `post_notice` 테이블/API 사용. 추후 상담사 전용 카테고리/필터
 * 분리가 필요하면 백엔드 service 에 role 파라미터 또는 별도 카테고리 추가.
 */
export default function CounselorMyNotices() {
  const navigate = useNavigate()
  const [category, setCategory] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  // 키 입력 폭주 방지 — 350ms 멈춘 뒤에만 API 호출
  const debouncedKeyword = useDebouncedValue(keyword, 350)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<PublicNoticeListItem[]>([])
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    noticesApi.categories().then(
      (r) => {
        if (alive) setCategories(r.items)
      },
      () => {},
    )
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    noticesApi
      .list({
        page,
        limit: PAGE_SIZE,
        category: category && category !== '전체' ? category : undefined,
        q: debouncedKeyword.trim() || undefined,
      })
      .then((r) => {
        if (!alive) return
        setItems(r.items)
        setTotal(r.total)
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : '공지를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [page, category, debouncedKeyword])

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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">상담사 공지사항</h1>
      </header>

      <main className="flex-1">
        <section className="px-4 pt-4 pb-3 flex items-center gap-2">
          <FilterDropdown
            label="전체"
            options={categories}
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

        <section className="px-4 pb-2">
          <p className="text-[13px] leading-[140%] text-[#6A7282]">
            전체 <span className="text-[#8259F5] font-medium">{total.toLocaleString()}</span>건{' '}
            <span className="text-[#8259F5] font-medium">{page}</span>페이지
          </p>
        </section>

        {loading ? (
          <ul className="flex flex-col">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="border-b border-[#F3F4F6] px-4 py-3">
                <div className="h-4 w-2/3 bg-[#F3F4F6] animate-pulse rounded" />
                <div className="mt-2 h-3 w-1/3 bg-[#F3F4F6] animate-pulse rounded" />
              </li>
            ))}
          </ul>
        ) : error ? (
          <p className="px-4 py-10 text-center text-[14px] text-[#FF6467]">{error}</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-10 text-center text-[14px] text-[#99A1AF]">
            등록된 공지사항이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col">
            {items.map((n) => (
              <li
                key={n.id}
                className={
                  n.is_pinned
                    ? 'border-b border-[#F3F4F6] bg-[#F3EEFE]'
                    : 'border-b border-[#F3F4F6] bg-white'
                }
              >
                <Link to={`/counselor/mypage/notices/${n.id}`} className="block px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span className="flex-1 text-[15px] leading-[140%] font-semibold text-[#030712]">
                      {n.title}
                    </span>
                    {n.is_new && (
                      <span className="shrink-0 inline-flex items-center h-[22px] px-2 rounded-full bg-[#FF6467] text-[12px] leading-none font-medium text-white">
                        New
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {n.is_pinned && (
                      <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-white border border-[#9B7AF7] text-[12px] leading-none font-medium text-[#8259F5]">
                        공지
                      </span>
                    )}
                    {n.category && !n.is_pinned && (
                      <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-[#F9FAFB] text-[12px] leading-none font-medium text-[#6A7282]">
                        {n.category}
                      </span>
                    )}
                    <span className="text-[13px] leading-[140%] text-[#99A1AF]">
                      {formatDate(n.created_at)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {!loading && totalPages > 1 && (
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
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}
