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

const PAGE_SIZE = 20

/** 상담사 상세 — 후기 탭 내용 */
export default function CounselorReviewsTab({ counselorId }: { counselorId: string }) {
  const { member } = useAuth()
  const [reviews, setReviews] = useState<PublicCounselorReview[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [policyOpen, setPolicyOpen] = useState(false)

  const canWriteReview = !member || member.role !== 'counselor'
  const hasMore = reviews.length < total

  useEffect(() => {
    if (!counselorId) return
    let alive = true
    setLoading(true)
    setReviews([])
    counselorsApi.reviews(counselorId, { limit: PAGE_SIZE, offset: 0 })
      .then((rv) => {
        if (!alive) return
        setReviews(rv.items)
        setTotal(rv.total)
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [counselorId])

  const loadMore = async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const rv = await counselorsApi.reviews(counselorId, { limit: PAGE_SIZE, offset: reviews.length })
      setReviews((prev) => [...prev, ...rv.items])
      setTotal(rv.total)
    } catch {
      // silent
    } finally {
      setLoadingMore(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-[#F3F4F6] rounded-[8px]" />
        ))}
      </div>
    )
  }

  const adminBestList = reviews.filter((r) => r.is_admin_best)
  const counselorBestList = reviews.filter((r) => !r.is_admin_best && r.is_best).slice(0, 5)
  const normalList = reviews.filter((r) => !r.is_admin_best && !r.is_best)

  return (
    <div className="flex flex-col gap-3">
      {/* 안내 카드 */}
      <article className="bg-[#F9FAFB] rounded-[12px] p-4 flex flex-col gap-2">
        <img src="/img/review_visual_img.png" alt="" className="w-[46px] h-auto" />
        <h2 className="text-[18px] leading-[130%] font-semibold text-[#ec4899]">
          후기 작성 시 코인 지급!
        </h2>
        <p className="text-[14px] leading-[130%] text-[#4A5565]">
          본인인증 완료 및 5분 이상 상담을 진행하신 고객님에 한하여 후기 작성이 가능합니다.
        </p>
        <button
          type="button"
          onClick={() => setPolicyOpen(true)}
          className="inline-flex items-center gap-1 text-[14px] leading-[130%] font-medium text-[#4A5565]"
        >
          상담후기 운영정책
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
            <path d="M6 4L10 8L6 12" stroke="#4A5565" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
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

      {/* 관리자 선정 후기 — 최상단, 조용한 왼쪽 핑크 줄 표시 */}
      {adminBestList.length > 0 && (
        <section className="flex flex-col">
          {adminBestList.map((r) => (
            <ReviewCard key={`admin-best-${r.id}`} review={r} isLoggedIn={!!member} showAdminMark />
          ))}
        </section>
      )}

      {/* 상담사 선정 후기 (표시 없이 위로만) */}
      {counselorBestList.length > 0 && (
        <section className="flex flex-col">
          {counselorBestList.map((r) => (
            <ReviewCard key={`best-${r.id}`} review={r} isLoggedIn={!!member} />
          ))}
        </section>
      )}

      {/* 일반 후기 */}
      <section className="flex flex-col -mt-2">
        {reviews.length === 0 ? (
          <p className="text-center text-[14px] text-[#99A1AF] py-10">아직 후기가 없습니다.</p>
        ) : (
          normalList.map((r) => (
            <ReviewCard key={r.id} review={r} isLoggedIn={!!member} />
          ))
        )}
      </section>

      {hasMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex items-center justify-center h-10 px-4 rounded-full bg-white border border-[#D1D5DC] text-[#6A7282] text-[14px] font-medium gap-1 disabled:opacity-50"
          >
            {loadingMore ? '불러오는 중…' : '상담 후기 더보기'}
            {!loadingMore && (
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
                <path d="M6 4L10 8L6 12" stroke="#6A7282" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* 운영정책 팝업 */}
      {policyOpen && <ReviewPolicyModal onClose={() => setPolicyOpen(false)} />}
    </div>
  )
}

function ReviewCard({
  review,
  isLoggedIn,
  showAdminMark = false,
}: {
  review: PublicCounselorReview
  isLoggedIn: boolean
  showAdminMark?: boolean
}) {
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
      <Link
        to={`/reviews/${id}`}
        className={`block px-0 py-4 flex flex-col gap-2 border-b border-[#F3F4F6] hover:bg-[#F9FAFB]/40 transition ${showAdminMark ? 'pl-3 border-l-2 border-l-[#f472b6]' : ''}`}
      >
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-1 min-w-0">
            <img src="/img/ic_reviewer.svg" alt="" className="w-4 h-4 shrink-0" />
            <span className="text-[14px] leading-[130%] font-medium text-[#1E2939] truncate">{reviewer_name}</span>
            {showAdminMark && (
              <span className="text-[11px] text-[#99A1AF] font-normal shrink-0">추천</span>
            )}
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

/** 운영정책 팝업 */
function ReviewPolicyModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[600px] bg-white rounded-t-[20px] p-6 pb-10 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-[#030712]">상담후기 운영정책</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="w-8 h-8 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
              <path d="M6 6L18 18M18 6L6 18" stroke="#030712" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* 작성 조건 */}
        <section className="flex flex-col gap-2">
          <h3 className="text-[15px] font-semibold text-[#1E2939]">후기 작성 조건</h3>
          <ul className="flex flex-col gap-1 text-[14px] text-[#4A5565] leading-[150%]">
            <li>• 본인인증 완료 회원만 작성 가능</li>
            <li>• 5분 이상 상담을 진행한 경우에만 작성 가능</li>
            <li>• 상담 종료 후 7일 이내에만 작성 가능</li>
            <li>• 동일 상담에 대해 후기 1건만 가능</li>
          </ul>
        </section>

        {/* 코인 혜택 */}
        <section className="flex flex-col gap-2">
          <h3 className="text-[15px] font-semibold text-[#1E2939]">코인 혜택</h3>
          <div className="bg-[#FDF2F8] rounded-[10px] p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[14px]">
              <span className="text-[#4A5565]">일반 후기 작성</span>
              <span className="font-semibold text-[#ec4899]">500 코인</span>
            </div>
            <div className="flex items-center justify-between text-[14px]">
              <span className="text-[#4A5565]">사진 포함 후기</span>
              <span className="font-semibold text-[#ec4899]">1,000 코인</span>
            </div>
            <div className="flex items-center justify-between text-[14px]">
              <span className="text-[#4A5565]">베스트 후기 선정</span>
              <span className="font-semibold text-[#ec4899]">10,000 코인</span>
            </div>
          </div>
        </section>

        {/* 삭제 규정 */}
        <section className="flex flex-col gap-2">
          <h3 className="text-[15px] font-semibold text-[#1E2939]">후기 수정 · 삭제 기준</h3>
          <ul className="flex flex-col gap-1 text-[14px] text-[#4A5565] leading-[150%]">
            <li>• 작성 후 <span className="font-medium text-[#1E2939]">5분 이내</span>에만 수정 · 삭제 가능</li>
            <li>• 상담사 답변이 달린 후기는 삭제 불가</li>
            <li>• 허위 · 비방 후기는 관리자 검토 후 삭제될 수 있습니다</li>
          </ul>
        </section>
      </div>
    </div>
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
