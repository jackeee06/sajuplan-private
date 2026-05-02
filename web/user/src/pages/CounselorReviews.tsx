import { Link, useParams } from 'react-router-dom'
import CounselorDetailLayout from '../components/CounselorDetailLayout'
import { MOCK_DETAILS, MOCK_COUNSELOR_REVIEWS, type CounselorReview } from '../data/counselorDetails'

/**
 * 상담사 상세 — 후기 탭 (Figma 84:4721)
 * 라우트: /counselors/:id/reviews
 *
 * 본문 구조:
 *  1) 안내 카드 (포인트 지급 안내, bg #F9FAFB radius 12)
 *  2) "후기 작성하기" outline-primary 버튼 (full-width, h40)
 *  3) "전체 N건" + "사진 후기만 보기" 체크 (border-b)
 *  4) 후기 카드 리스트 (이 상담사의 후기만)
 *  5) "상담 후기 더보기" outline-gray 버튼 (centered)
 */
export default function CounselorReviews() {
  const { id = '3' } = useParams<{ id: string }>()
  const data = MOCK_DETAILS[id] ?? MOCK_DETAILS['3']
  const reviews = MOCK_COUNSELOR_REVIEWS[id] ?? []

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

        {/* 후기 작성하기 — outline-primary, h40, full-width */}
        <Link
          to={`/counselors/${id}/reviews/new`}
          className="h-10 rounded-full bg-white border border-[#9B7AF7] text-[#8259F5] text-[14px] font-medium flex items-center justify-center gap-1 transition hover:bg-[#F3EEFE]"
        >
          <PencilLineIcon />
          후기 작성하기
        </Link>
      </div>

      {/* 카운터 + 사진 후기만 */}
      <CounterRow total={data.reviewTotal} />

      {/* 후기 카드 리스트 */}
      <section className="flex flex-col -mt-2">
        {reviews.length === 0 ? (
          <p className="text-center text-[14px] text-[#99A1AF] py-10">아직 후기가 없습니다.</p>
        ) : (
          reviews.map((r) => <ReviewCard key={r.id} review={r} />)
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

/* ───────────── 후기 카드 (상담사 상세용 — 후기 메타에서 상담사 정보는 생략) ───────────── */

/**
 * 상담사 상세 후기 탭의 ReviewCard.
 * Figma 84:6647 (type=후기2)와 동일 — 작성자 프로필 아바타 없음, 메타는 하단.
 *
 * 순서: ✓이름 + ⋮메뉴 → 제목 → 본문+이미지 → 전화상담·날짜·시간
 */
function ReviewCard({ review }: { review: CounselorReview }) {
  const { reviewType, date, duration, customerName, reviewTitle, reviewContent, imgUrl, showLock, reply, id } = review

  return (
    <Link
      to={`/reviews/${id}`}
      className="block px-0 py-4 flex flex-col gap-2 border-b border-[#F3F4F6] hover:bg-[#F9FAFB]/40 transition"
    >
      {/* 1) 작성자 + 메뉴 */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1 min-w-0">
          <img src="/img/ic_reviewer.svg" alt="" className="w-4 h-4 shrink-0" />
          <span className="text-[14px] leading-[130%] font-medium text-[#1E2939] truncate">
            {customerName}
          </span>
        </div>
        <button
          type="button"
          aria-label="더보기"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          className="w-5 h-5 flex items-center justify-center shrink-0"
        >
          <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" aria-hidden>
            <circle cx="10" cy="4.5" r="1.4" fill="#99A1AF" />
            <circle cx="10" cy="10" r="1.4" fill="#99A1AF" />
            <circle cx="10" cy="15.5" r="1.4" fill="#99A1AF" />
          </svg>
        </button>
      </div>

      {/* 2) 제목 */}
      <div className="flex items-center gap-1">
        {showLock && <LockIcon />}
        <h3 className="text-[14px] leading-[130%] font-medium text-[#1E2939]">
          {reviewTitle}
        </h3>
      </div>

      {/* 3) 본문 + 첨부사진(60×60 우측) */}
      <div className="flex gap-4 items-start">
        <p className="flex-1 text-[14px] leading-[130%] text-[#4A5565] whitespace-pre-line">
          {reviewContent}
        </p>
        {imgUrl && (
          <img
            src={imgUrl}
            alt=""
            className="w-[60px] h-[60px] rounded-[12px] object-cover border border-[#F3F4F6] shrink-0"
          />
        )}
      </div>

      {/* 4) 메타 — 하단 */}
      <div className="flex items-center gap-1 text-[14px] leading-[130%] text-[#99A1AF]">
        <span>{reviewType}</span>
        <span aria-hidden>∙</span>
        <span>{date}</span>
        <span aria-hidden>∙</span>
        <span>{duration}</span>
      </div>

      {/* 5) 답변 (있을 때만) */}
      {reply && (
        <div className="rounded-[12px] bg-[#F9FAFB] p-3 flex flex-col gap-1 mt-1">
          <p className="text-[14px] leading-[130%] font-medium text-[#1E2939]">{reply.name}</p>
          <p className="text-[14px] leading-[130%] text-[#6A7282]">{reply.text}</p>
        </div>
      )}
    </Link>
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
