import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import {
  ApiError,
  counselorMyReviewsApi,
  reviewsApi,
  type CounselorReviewListItem,
} from '../lib/api'

const BEST_LIMIT = 5

const PAGE_SIZE = 10

/**
 * 08마이페이지_상담사_후기 관리
 * Figma node-id: 153:10169
 *
 * - 상단 보라 배너: "후기에 답변을 달아주세요!" + 체크박스 "답변 없는 후기만 보기"
 * - 카운터 + 우측 체크박스 "사진 후기만 보기"
 * - 카드: 보라체크 작성자 + ⋮ + (썸네일) / 제목 / 본문 / 메타 / [답변 카드 or 답변 작성하기 버튼]
 * - 비밀 후기는 자물쇠 + 제목 마스킹
 */
export default function CounselorMyReviews() {
  const navigate = useNavigate()
  const [unansweredOnly, setUnansweredOnly] = useState(false)
  const [photoOnly, setPhotoOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<CounselorReviewListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    counselorMyReviewsApi
      .list({ page, limit: PAGE_SIZE, unansweredOnly, photoOnly })
      .then((res) => {
        if (cancelled) return
        setItems(res.items)
        setTotal(res.total)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message =
          err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
            ? String((err as { message: string }).message)
            : '후기를 불러오지 못했습니다.'
        setError(message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page, unansweredOnly, photoOnly])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  // 현재 페이지 기준 베스트 카운트 — 다른 페이지에 베스트가 있을 수 있으므로 참고용
  const bestOnPage = items.filter((i) => i.is_best).length

  /** 베스트 토글 — 5개 초과 시 백엔드가 409 반환 → 알림 후 변경 안 함 */
  const onToggleBest = async (id: number, current: boolean) => {
    try {
      const res = await reviewsApi.toggleBest(id, !current)
      setItems((arr) =>
        arr.map((it) =>
          it.id === id ? { ...it, is_best: res.is_best, best_at: res.best_at } : it,
        ),
      )
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : '베스트 후기 변경에 실패했습니다.'
      alert(msg)
    }
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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">후기 관리</h1>
      </header>

      <main className="flex-1">
        {/* 상단 보라 배너 */}
        <section className="px-4 pt-3">
          <div className="rounded-[12px] bg-[#F3EEFE] px-4 py-3">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 20 20" className="w-5 h-5 shrink-0" fill="none" aria-hidden>
                <circle cx="10" cy="10" r="8" stroke="#8259F5" strokeWidth="1.4" />
                <path d="M7 10L9 12L13 8" stroke="#8259F5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-[14px] font-semibold text-[#8259F5]">후기에 답변을 달아주세요!</p>
            </div>
            <label className="mt-2 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={unansweredOnly}
                onChange={(e) => {
                  setUnansweredOnly(e.target.checked)
                  setPage(1)
                }}
                className="w-4 h-4 accent-[#9B7AF7]"
              />
              <span className="text-[13px] text-[#4A5565]">답변 없는 후기만 보기</span>
            </label>
          </div>
        </section>

        <section className="px-4 pt-3 pb-2 flex items-center justify-between">
          <p className="text-[13px] leading-[140%] text-[#6A7282]">
            전체 <span className="text-[#8259F5] font-medium">{total.toLocaleString()}</span>건
            <span className="ml-2 text-[#6A7282]">·</span>
            <span className="ml-2 text-[#4A5565]">⭐ 베스트 {bestOnPage}/{BEST_LIMIT}</span>
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={photoOnly}
              onChange={(e) => {
                setPhotoOnly(e.target.checked)
                setPage(1)
              }}
              className="w-4 h-4 accent-[#9B7AF7]"
            />
            <span className="text-[13px] text-[#4A5565]">사진 후기만 보기</span>
          </label>
        </section>

        {loading ? (
          <p className="px-4 py-12 text-center text-[14px] text-[#6A7282]">불러오는 중...</p>
        ) : error ? (
          <p className="px-4 py-12 text-center text-[14px] text-[#FF6467]">{error}</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-12 text-center text-[14px] text-[#6A7282]">표시할 후기가 없습니다.</p>
        ) : (
          <ul className="flex flex-col">
            {items.map((r) => (
              <li key={r.id} className="border-b border-[#F3F4F6]">
                <div className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
                      <circle cx="8" cy="8" r="7" stroke="#9B7AF7" strokeWidth="1.4" />
                      <path d="M5 8L7 10L11 6" stroke="#9B7AF7" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="flex-1 text-[14px] font-medium text-[#1E2939]">{r.customer_name}</span>
                    {/* 베스트 토글 (2026-05-15) — 활성 시 노란별, 비활성 시 회색 외곽 */}
                    <button
                      type="button"
                      onClick={() => onToggleBest(r.id, r.is_best)}
                      aria-pressed={r.is_best}
                      aria-label={r.is_best ? '베스트 후기 해제' : '베스트 후기 선정'}
                      title={r.is_best ? '베스트 후기 해제' : `베스트 후기 선정 (최대 ${BEST_LIMIT}개)`}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#F9FAFB] transition"
                    >
                      {r.is_best ? (
                        <svg viewBox="0 0 20 20" className="w-5 h-5" fill="#F59E0B" aria-hidden>
                          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.2 1 5.9L10 15l-5.2 2.7 1-5.9L1.5 7.6l5.9-.9L10 1.5z" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="#99A1AF" strokeWidth="1.4" aria-hidden>
                          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.2 1 5.9L10 15l-5.2 2.7 1-5.9L1.5 7.6l5.9-.9L10 1.5z" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <button type="button" aria-label="더보기" className="w-5 h-5">
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" aria-hidden>
                        <circle cx="12" cy="6" r="1.4" fill="#6A7282" />
                        <circle cx="12" cy="12" r="1.4" fill="#6A7282" />
                        <circle cx="12" cy="18" r="1.4" fill="#6A7282" />
                      </svg>
                    </button>
                  </div>

                  <Link to={`/counselor/mypage/reviews/${r.id}`} className="mt-2 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {r.is_private && (
                          <svg viewBox="0 0 16 16" className="w-4 h-4 shrink-0" fill="none" aria-hidden>
                            <rect x="3.5" y="7.5" width="9" height="6" rx="1" stroke="#1E2939" strokeWidth="1.4" />
                            <path d="M5 7.5V5C5 3.34 6.34 2 8 2C9.66 2 11 3.34 11 5V7.5" stroke="#1E2939" strokeWidth="1.4" strokeLinecap="round" />
                          </svg>
                        )}
                        <p className="text-[16px] font-bold text-[#030712] truncate">{r.title}</p>
                      </div>
                      <p className="mt-1 text-[14px] leading-[140%] text-[#4A5565] line-clamp-2 break-keep">
                        {r.content}
                      </p>
                      <p className="mt-2 text-[13px] leading-[140%] text-[#99A1AF]">
                        {[r.consult_type, r.date, r.duration].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {r.img_url && (
                      <img
                        src={r.img_url}
                        alt=""
                        className="w-[60px] h-[60px] rounded-[8px] object-cover shrink-0"
                      />
                    )}
                  </Link>

                  {r.reply ? (
                    <div className="mt-3 rounded-[12px] bg-[#F9FAFB] px-4 py-3">
                      <p className="text-[14px] font-semibold text-[#1E2939]">{r.reply.author}</p>
                      <p className="mt-1 text-[14px] leading-[140%] text-[#4A5565] line-clamp-2 break-keep">
                        {r.reply.text}
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate(`/counselor/mypage/reviews/${r.id}`)}
                      className="mt-3 w-full h-[44px] rounded-full bg-[#9B7AF7] text-white text-[14px] font-semibold"
                    >
                      답변 작성하기
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav myHref="/counselor/mypage" />
    </div>
  )
}
