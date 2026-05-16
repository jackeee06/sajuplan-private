import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import CounselorDetailLayout from '../components/CounselorDetailLayout'
import ReviewReportModal from '../components/ReviewReportModal'
import type { Badge, CounselorDetailData } from '../data/counselorDetails'
import {
  ApiError,
  counselorsApi,
  type PublicCounselorDetail,
  type PublicCounselorReview,
} from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { FILE_BASE } from '../lib/runtime-env'

function resolveImageUrl(u: string | null): string {
  if (!u) return '/img/sample_img01.jpg'
  if (/^https?:\/\//.test(u)) return u
  if (u.startsWith('/')) return `${FILE_BASE}${u}`
  return u
}

/** 백엔드 응답 → CounselorDetailLayout 이 받는 CounselorDetailData 어댑터 (CounselorDetail.tsx 와 동일) */
function mapDetail(r: PublicCounselorDetail, total: number): CounselorDetailData {
  const badge: Badge = (r.category === '기타' ? '사주' : r.category) as Badge
  return {
    id: r.id,
    badge,
    name: r.nickname || r.name,
    code: r.dtmfno ?? r.csrid ?? String(r.id).padStart(6, '0'),
    tagline: r.headline ?? '',
    hashtags: r.hashtags,
    pricePerHalfMin: r.unit_cost ?? 0,
    likeCount: r.fan_count > 999 ? '999+' : String(r.fan_count),
    liked: r.is_liked,
    heroImg: resolveImageUrl(r.hero_image),
    heroImgWebp: r.hero_image_webp ? resolveImageUrl(r.hero_image_webp) : null,
    fields: r.fields.length > 0 ? r.fields : ['전문 상담'],
    styles: r.traits.length > 0 ? r.traits : ['친절한'],
    career: r.career.length > 0 ? r.career : ['상담사 약력 준비 중입니다.'],
    noticeDate: formatDate(r.notice_date),
    noticeContent: r.notice_content ?? '아직 등록된 공지가 없습니다.',
    introText: r.intro ?? '상담사 소개가 준비 중입니다.',
    liveViewers: r.live_viewers,
    reviewTotal: total.toLocaleString(),
    qnaTotal: '0',
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

/**
 * 상담사 상세 — 후기 탭 (Figma 84:4721)
 * 라우트: /counselors/:id/reviews
 *
 * 백엔드 연동:
 *   GET /user/counselors/:id        → 상담사 정보
 *   GET /user/counselors/:id/reviews → 후기 목록 + 총 건수
 */
export default function CounselorReviews() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { member } = useAuth()
  const [data, setData] = useState<CounselorDetailData | null>(null)
  const [reviews, setReviews] = useState<PublicCounselorReview[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // 후기 작성은 회원만. 상담사는 후기를 "받는" 쪽이라 작성 진입 노출 X.
  const canWriteReview = !member || member.role !== 'counselor'

  useEffect(() => {
    if (!id) {
      setError('상담사 ID가 없습니다.')
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    setError(null)

    Promise.all([counselorsApi.detail(id), counselorsApi.reviews(id, { limit: 20 })])
      .then(([detail, rv]) => {
        if (!alive) return
        setData(mapDetail(detail, rv.total))
        setReviews(rv.items)
      })
      .catch((e) => {
        if (!alive) return
        if (e instanceof ApiError && e.status === 404) {
          setError('해당 상담사를 찾을 수 없습니다.')
        } else {
          setError(e instanceof Error ? e.message : '상담사 정보를 불러오지 못했습니다.')
        }
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [id])

  if (loading) {
    return (
      <div className="mobile-frame flex flex-col">
        <div className="w-full h-[192px] bg-[#F3F4F6] animate-pulse" />
        <div className="px-4 py-6 flex flex-col gap-4">
          <div className="h-5 w-1/2 bg-[#F3F4F6] animate-pulse rounded" />
          <div className="h-4 w-2/3 bg-[#F3F4F6] animate-pulse rounded" />
          <div className="h-4 w-1/3 bg-[#F3F4F6] animate-pulse rounded" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mobile-frame flex flex-col items-center justify-center min-h-screen px-6 text-center gap-4">
        <p className="text-[15px] text-[#4A5565]">{error ?? '상담사 정보를 불러올 수 없습니다.'}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="h-10 px-5 rounded-full border border-[#E5E7EB] text-[14px] text-[#364153]"
        >
          뒤로 가기
        </button>
      </div>
    )
  }

  return (
    <CounselorDetailLayout data={data} activeTab="reviews">
      <div className="flex flex-col gap-3">
        {/* 안내 카드 — Figma Frame 544 */}
        <article className="bg-[#F9FAFB] rounded-[12px] p-4 flex flex-col gap-2">
          <img src="/img/review_visual_img.png" alt="" className="w-[46px] h-auto" />
          <h2 className="text-[18px] leading-[130%] font-semibold text-[#8259F5]">
            후기 작성 시 포인트 지급!
          </h2>
          <p className="text-[14px] leading-[130%] text-[#4A5565]">
            본인인증 완료 및 5분 이상 상담을 진행하신 고객님에 한하여 후기 작성이 가능합니다.
          </p>
          <a
            href="#"
            className="inline-flex items-center gap-1 text-[14px] leading-[130%] font-medium text-[#4A5565]"
          >
            상담후기 운영정책
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
              <path d="M6 4L10 8L6 12" stroke="#4A5565" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </article>

        {/* 후기 작성하기 — 회원에게만 노출. 상담사 본인은 후기를 받는 쪽이라 숨김.
            통합 상담내역에서 진입하면 consultation_id 도 함께 와서 특정 상담에 1:1 매핑된 후기로 저장된다. */}
        {canWriteReview && (
          <Link
            to={`/mypage/my-reviews/new?counselor_id=${id}`}
            className="h-10 rounded-full bg-white border border-[#9B7AF7] text-[#8259F5] text-[14px] font-medium flex items-center justify-center gap-1 transition hover:bg-[#F3EEFE]"
          >
            <PencilLineIcon />
            후기 작성하기
          </Link>
        )}
      </div>

      {/* 카운터 + 사진 후기만 */}
      <CounterRow total={data.reviewTotal} />

      {/* 베스트 후기 영역 — 옅은 황색 배경으로 영역 명확화 (2026-05-15) */}
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

      {/* 후기 카드 리스트 (전체 — 베스트도 포함, 정렬상 베스트가 위에 옴) */}
      <section className="flex flex-col -mt-2">
        {reviews.length === 0 ? (
          <p className="text-center text-[14px] text-[#99A1AF] py-10">아직 후기가 없습니다.</p>
        ) : (
          reviews.filter((r) => !r.is_best).map((r) => <ReviewCard key={r.id} review={r} isLoggedIn={!!member} />)
        )}
      </section>

      {/* 더보기 — outline-gray, hug width */}
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
    </CounselorDetailLayout>
  )
}

/* ───────────── 카운터 행 ───────────── */

function CounterRow({ total }: { total: string }) {
  return (
    <div className="px-0 pb-3 flex items-center justify-between border-b border-[#F3F4F6]">
      <p className="text-[15px] leading-[130%] text-[#4A5565]">
        전체 <span className="font-medium text-[#8259F5]">{total}</span>건
      </p>
      <label className="flex items-center gap-1 cursor-pointer select-none">
        <input type="checkbox" className="w-[22px] h-[22px]" />
        <span className="text-[15px] leading-[120%] text-[#364153]">사진 후기만 보기</span>
      </label>
    </div>
  )
}

/* ───────────── 후기 카드 (백엔드 연동) ───────────── */

function ReviewCard({ review, isLoggedIn }: { review: PublicCounselorReview; isLoggedIn: boolean }) {
  const { id, title, content, is_secret, reviewer_name, created_at } = review
  const dateText = formatDate(created_at)
  const navigate = useNavigate()
  const [reportOpen, setReportOpen] = useState(false)

  const onReportClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isLoggedIn) {
      alert('신고하려면 로그인이 필요합니다.')
      navigate('/login')
      return
    }
    setReportOpen(true)
  }

  return (
    <>
      <Link
        to={`/reviews/${id}`}
        className="block px-0 py-4 flex flex-col gap-2 border-b border-[#F3F4F6] hover:bg-[#F9FAFB]/40 transition"
      >
        {/* 1) 작성자 + 신고 버튼 */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-1 min-w-0">
            <img src="/img/ic_reviewer.svg" alt="" className="w-4 h-4 shrink-0" />
            <span className="text-[14px] leading-[130%] font-medium text-[#1E2939] truncate">
              {reviewer_name}
            </span>
          </div>
          {/* 신고 버튼 (2026-05-15 신설) — Link 클릭 전파 차단 */}
          <button
            type="button"
            onClick={onReportClick}
            className="shrink-0 text-[12px] text-[#99A1AF] hover:text-[#FB2C36] underline-offset-2 hover:underline"
            aria-label="이 후기 신고"
          >
            신고
          </button>
        </div>

        {/* 2) 제목 */}
        <div className="flex items-center gap-1">
          {is_secret && <LockIcon />}
          <h3 className="text-[14px] leading-[130%] font-medium text-[#1E2939]">{title}</h3>
        </div>

        {/* 3) 본문 */}
        <p className="text-[14px] leading-[130%] text-[#4A5565] whitespace-pre-line line-clamp-3">
          {is_secret ? '비밀 후기입니다' : content}
        </p>

        {/* 4) 날짜 */}
        <div className="flex items-center gap-1 text-[14px] leading-[130%] text-[#99A1AF]">
          <span>{dateText}</span>
        </div>
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
      <path d="M11.5 2.5l2 2-7 7H4.5v-2l7-7z" stroke="#8259F5" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M2.5 14h11" stroke="#8259F5" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
