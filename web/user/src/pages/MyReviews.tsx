import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import ConfirmModal from '../components/ConfirmModal'
import UploadedImage from '../components/UploadedImage'
import { ApiError, reviewsApi, settingsApi, type MyReviewItem } from '../lib/api'

const PAGE_SIZE = 10

const BADGE_BG: Record<MyReviewItem['counselor_badge'], string> = {
  타로: '#ec4899',
  신점: '#00BBA7',
  사주: '#FF6467',
  기타: '#6A7282',
}

/**
 * 나의 상담후기 — Figma 147:12682, 백엔드 연동.
 *  - GET /user/reviews/mine (페이지네이션 + photoOnly 필터)
 *  - 카드별 ⋮ 드롭다운 → 수정 / 삭제 (물리삭제)
 */
export default function MyReviews() {
  const navigate = useNavigate()
  const [photoOnly, setPhotoOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<MyReviewItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MyReviewItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  /** 관리자 설정값 — 후기 포인트 지급 정책 안내 */
  const [payout, setPayout] = useState<{ enabled: boolean; amount: number; minUsed: number }>({
    enabled: true,
    amount: 500,
    minUsed: 0,
  })

  useEffect(() => {
    let mounted = true
    settingsApi
      .public()
      .then((s) => {
        if (!mounted) return
        setPayout({
          enabled: s['review.payout_enabled'] === '1',
          amount: Math.max(0, Number(s['review.payout_amount'] ?? '0') || 0),
          minUsed: Math.max(0, Number(s['review.payout_min_used'] ?? '0') || 0),
        })
      })
      .catch(() => { /* 기본값 유지 */ })
    return () => { mounted = false }
  }, [])

  // ⋮ 외부 클릭 시 메뉴 닫기
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (openMenuId == null) return
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpenMenuId(null)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenMenuId(null)
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [openMenuId])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    reviewsApi
      .mine({ page, limit: PAGE_SIZE, photoOnly })
      .then((r) => {
        if (!mounted) return
        setItems(r.items)
        setTotal(r.total)
      })
      .catch((e) => {
        if (!mounted) return
        if (e instanceof ApiError && e.status === 401) {
          navigate('/login', { replace: true, state: { from: '/mypage/my-reviews' } })
          return
        }
        setError(e instanceof Error ? e.message : '후기를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [page, photoOnly, reload, navigate])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await reviewsApi.remove(deleteTarget.id)
      setDeleteTarget(null)
      setToast('후기가 삭제되었습니다.')
      setReload((x) => x + 1)
    } catch (e) {
      setToast(e instanceof Error ? e.message : '삭제 실패')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div ref={containerRef} className="mobile-frame flex flex-col pb-[100px]">
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
          나의 상담 후기
        </h1>
      </header>

      {toast && (
        <div className="fixed top-[68px] left-1/2 -translate-x-1/2 z-50 max-w-[400px] w-[calc(100%-32px)] mx-auto pointer-events-none">
          <div className="mx-auto inline-block bg-[#1E2939] text-white text-[14px] leading-[140%] px-4 py-2.5 rounded-[10px] shadow-[0_4px_12px_rgba(0,0,0,0.18)]">
            {toast}
          </div>
        </div>
      )}

      {payout.enabled && payout.amount > 0 && (
        <div className="px-4 pt-2">
          <div className="rounded-[12px] bg-[#F9FAFB] px-4 py-4">
            <div className="flex items-center gap-3">
              <img src="/img/review_visual_img.png" alt="" className="w-[46px] h-[28px] shrink-0" />
              <p className="text-[15px] font-bold text-[#ec4899]">
                후기 작성 시 {payout.amount.toLocaleString()} 코인 지급!
              </p>
            </div>
            <p className="mt-2 text-[13px] leading-[150%] text-[#4A5565]">
              {payout.minUsed > 0 ? (
                <>
                  <span className="font-semibold text-[#1E2939]">
                    {payout.minUsed.toLocaleString()} 코인 이상
                  </span>
                  {' '}사용하신 상담에 한하여 후기 작성 시 코인이 지급됩니다.
                </>
              ) : (
                '후기를 작성하신 모든 고객님께 코인이 지급됩니다.'
              )}
            </p>
            <Link
              to="/mypage/notices"
              className="mt-2 inline-flex items-center gap-0.5 text-[13px] text-[#6A7282]"
            >
              상담후기 운영정책
              <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" aria-hidden>
                <path d="M6 3.5L10.5 8L6 12.5" stroke="#6A7282" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      )}

      <div className="px-4 py-3 flex items-center justify-between border-b border-[#F3F4F6]">
        <span className="text-[14px] text-[#4A5565]">
          전체 <span className="text-[#ec4899] font-medium">{total.toLocaleString()}</span>건
        </span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={photoOnly}
            onChange={(e) => {
              setPhotoOnly(e.target.checked)
              setPage(1)
            }}
            className="form-check-input"
          />
          <span className="text-[13px] text-[#4A5565]">사진 후기만 보기</span>
        </label>
      </div>

      <main className="flex-1 px-4">
        {loading && (
          <p className="py-20 text-center text-[14px] text-[#99A1AF]">불러오는 중…</p>
        )}
        {!loading && error && (
          <p className="py-20 text-center text-[14px] text-[#FB2C36]">{error}</p>
        )}
        {!loading && !error && items.length === 0 && (
          <p className="py-20 text-center text-[14px] text-[#99A1AF]">
            아직 작성한 후기가 없습니다.
          </p>
        )}

        {items.map((r) => (
          <article key={r.id} className="py-4 border-b border-[#F3F4F6] relative">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-[#F3F4F6] overflow-hidden shrink-0">
                {r.counselor_avatar && (
                  <UploadedImage src={r.counselor_avatar} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <span
                className="px-2 h-[22px] inline-flex items-center text-[12px] font-medium text-white rounded"
                style={{ background: BADGE_BG[r.counselor_badge] }}
              >
                {r.counselor_badge}
              </span>
              <span className="text-[15px] font-bold text-[#030712] truncate">{r.counselor_name}</span>
              {r.counselor_code && (
                <span className="text-[14px] font-medium text-[#ec4899] shrink-0">{r.counselor_code}</span>
              )}

              <div className="ml-auto relative">
                <button
                  type="button"
                  aria-label="더보기"
                  onClick={(e) => {
                    e.preventDefault()
                    setOpenMenuId((v) => (v === r.id ? null : r.id))
                  }}
                  className="w-7 h-7 flex items-center justify-center text-[#9CA3AF]"
                >
                  ⋮
                </button>
                {openMenuId === r.id && (
                  <div
                    role="menu"
                    className="absolute top-full right-0 mt-1 z-30 min-w-[100px] bg-white rounded-[10px] border border-[#E5E7EB] shadow-[0_8px_20px_rgba(16,24,40,0.10)] py-1"
                  >
                    {/* 수정 기능 제거 (2026-05-15) — 후기는 한 번 작성 후 수정 불가. 변경 필요 시 삭제 후 재작성 */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpenMenuId(null)
                        setDeleteTarget(r)
                      }}
                      className="w-full px-4 py-2 text-left text-[14px] text-[#FB2C36] hover:bg-[#FEEBEE]"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            </div>

            <p className="mt-1 text-[12px] text-[#99A1AF]">
              {[r.consult_type, r.consult_date, r.consult_duration].filter(Boolean).join(' · ')}
            </p>

            <Link to={`/mypage/my-reviews/${r.id}`} className="mt-3 flex gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[#6A7282] mb-1">{r.customer_name}</p>
                <p className="text-[14px] leading-[150%] text-[#030712] whitespace-pre-line line-clamp-3">
                  {r.title}
                </p>
                <p className="mt-1 text-[13px] leading-[150%] text-[#6A7282] whitespace-pre-line line-clamp-2">
                  {r.content}
                </p>
              </div>
              {r.photo_url && (
                <UploadedImage
                  src={r.photo_url}
                  srcWebp={r.photo_url_webp}
                  alt=""
                  className="w-[60px] h-[60px] rounded-[8px] object-cover shrink-0"
                />
              )}
            </Link>
          </article>
        ))}

        {!loading && total > 0 && (
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </main>

      <FloatingActions bottomOffset={24} />

      <ConfirmModal
        open={!!deleteTarget && !deleting}
        message={'후기를 삭제하시겠습니까?'}
        subMessage={'삭제 후 복구할 수 없습니다.'}
        actionLabel="삭제"
        tone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
      <BottomNav />
      </div>
  )
}
