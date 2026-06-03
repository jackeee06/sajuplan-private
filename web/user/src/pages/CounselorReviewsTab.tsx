import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ReviewReportModal from '../components/ReviewReportModal'
import { counselorsApi, type PublicCounselorReview } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { FILE_BASE } from '../lib/runtime-env'

function resolveImageUrl(u: string | null): string {
  if (!u) return '/img/sample_img01.jpg'
  if (/^https?:\/\//.test(u)) return u
  if (u.startsWith('/')) return `${FILE_BASE}${u}`
  return u
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

/** 상담사 상세 — 후기 탭 내용 (레이아웃 없이 content만) */
export default function CounselorReviewsTab({ counselorId }: { counselorId: string }) {
  const { member } = useAuth()
  const [reviews, setReviews] = useState<PublicCounselorReview[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const canWriteReview = !member || member.role !== 'counselor'

  useEffect(() => {
    if (!counselorId) return
    let alive = true
    setLoading(true)
    counselorsApi.reviews(counselorId, { limit: 20 })
      .then((rv) => {
        if (!alive) return
        setReviews(rv.items)
        setTotal(rv.total)
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [counselorId])

  if (loading) {
    return (
      <div className="flex flex-col gap-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-[#F3F4F6] rounded-[8px]" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 안내 카드 */}
      <article className="bg-[#F9FAFB] rounded-[12px] p-4 flex flex-col gap-2">
        <img src="/img/review_visual_img.png" alt="" className="w-[46px] h-auto" />
        <h2 className="text-[18px] leading-[130%] font-semibold text-[#ec4899]">
          후기 작성 시 포인트 지급!
        </h2>
        <p className="text-[14px] leading-[130%] text-[#4A5565]">
          본인인증 완료 및 5분 이상 상담을 진행하신 고객님에 한하여 후기 작성이 가능합니다.
        </p>
        <a href="#" className="inline-flex items-center gap-1 text-[14px] leading-[130%] font-medium text-[#4A5565]">
          상담후기 운영정책
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
            <path d="M6 4L10 8L6 12" stroke="#4A5565" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </article>

      {canWriteReview && (
        <Link
          to={`/mypage/my-reviews/new?counselor_id=${counselorId}`}
          className="h-10 rounded-full bg-white border border-[#f472b6] text-[#ec4899] text-[14px] font-medium flex items-center justify-center gap-1 transition hover:bg-[#fdf2f8]"
        >
          <PencilLineIcon />
          후기 작성하기
        </Link>
      )}

      {/* 카운터 */}
      <div className="px-0 pb-3 flex items-center justify-between border-b border-[#F3F4F6]">
        <p className="text-[15px] leading-[130%] text-[#4A5565]">
          전체 <span className="font-medium text-[#ec4899]">{total.toLocaleString()}</span>건
        </p>
      </div>

      {/* 베스트 후기 */}
      {(() => {
        const bestList = reviews.filter((r) => r.is_best).slice(0, 5)
        if (bestList.length === 0) return null
        return (
          <section className="-mx-4 px-4 bg-[#FFFBEB] border-y border-[#FDE68A]">
            <div className="pt-4 pb-2 flex items-center gap-1.5">
              <span aria-hidden>⭐</span>
              <h2 className="text-[15px] font-bold text-[#1E2939]">베스트 후기</h2>
              <span className="text-[12px] text-[#92400E]">상담사가 직접 선정한 후기 {bestList.length}건</span>
            </div>
            <div className="flex flex-col pb-2">
              {bestList.map((r) => (
                <ReviewCard key={`best-${r.id}`} review={r} isLoggedIn={!!member} />
              ))}
            </div>
          </section>
        )
      })()}

      {/* 후기 전체 */}
      <section className="flex flex-col -mt-2">
        {reviews.length === 0 ? (
          <p className="text-center text-[14px] text-[#99A1AF] py-10">아직 후기가 없습니다.</p>
        ) : (
          reviews.filter((r) => !r.is_best).map((r) => (
            <ReviewCard key={r.id} review={r} isLoggedIn={!!member} />
          ))
        )}
      </section>

      <div className="flex justify-center">
        <Link
          to="/reviews"
          className="inline-flex items-center justify-center h-10 px-4 rounded-full bg-white border border-[#D1D5DC] text-[#6A7282] text-[14px] font-medium gap-1"
        >
          상담 후기 더보기
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
            <path d="M6 4L10 8L6 12" stroke="#6A7282" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </div>
  )
}

function ReviewCard({ review, isLoggedIn }: { review: PublicCounselorReview; isLoggedIn: boolean }) {
  const { id, title, content, is_secret, reviewer_name, created_at } = review
  const navigate = useNavigate()
  const [reportOpen, setReportOpen] = useState(false)

  const onReportClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isLoggedIn) { alert('신고하려면 로그인이 필요합니다.'); navigate('/login'); return }
    setReportOpen(true)
  }

  return (
    <>
      <Link to={`/reviews/${id}`} className="block px-0 py-4 flex flex-col gap-2 border-b border-[#F3F4F6] hover:bg-[#F9FAFB]/40 transition">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-1 min-w-0">
            <img src="/img/ic_reviewer.svg" alt="" className="w-4 h-4 shrink-0" />
            <span className="text-[14px] leading-[130%] font-medium text-[#1E2939] truncate">{reviewer_name}</span>
          </div>
          <button type="button" onClick={onReportClick} className="shrink-0 text-[12px] text-[#99A1AF] hover:text-[#FB2C36]" aria-label="이 후기 신고">신고</button>
        </div>
        <div className="flex items-center gap-1">
          {is_secret && <LockIcon />}
          <h3 className="text-[14px] leading-[130%] font-medium text-[#1E2939]">{title}</h3>
        </div>
        <p className="text-[14px] leading-[130%] text-[#4A5565] whitespace-pre-line line-clamp-3">
          {is_secret ? '비밀 후기입니다' : content}
        </p>
        <span className="text-[14px] leading-[130%] text-[#99A1AF]">{formatDate(created_at)}</span>
      </Link>
      <ReviewReportModal reviewId={id} open={reportOpen} onClose={() => setReportOpen(false)} />
    </>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4 shrink-0" fill="none" aria-hidden>
      <rect x="3" y="7" width="10" height="6.5" rx="1.3" stroke="#1E2939" strokeWidth="1.4" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="#1E2939" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function PencilLineIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
      <path d="M11.5 2.5l2 2-7 7H4.5v-2l7-7z" stroke="#ec4899" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M2.5 14h11" stroke="#ec4899" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
