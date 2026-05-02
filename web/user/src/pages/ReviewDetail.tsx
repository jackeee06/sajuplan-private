import { Link, useNavigate, useParams } from 'react-router-dom'
import FloatingActions from '../components/FloatingActions'
import { MOCK_REVIEWS, type Review } from './Reviews'

/**
 * 후기 상세 — Figma 76:4380 (답변 없음) / 76:4712 (답변 있음)
 *
 * 핵심: 후기 리스트 카드와 달리 상담사 메타(아바타·뱃지·번호·별점·가격·태그)는 노출하지 않는다.
 *      본문 텍스트와 이미지에 집중하는 미니멀 레이아웃.
 *
 * 구조:
 *  [hd5 헤더: ← + 상담 후기]
 *  [본문 그룹 (gap 16)]
 *    1) 제목 섹션 (padding 16, gap 8)
 *       · 제목 (18px medium #1E2939)
 *       · 본인인증 아이콘 + 고객이름 (14px medium)
 *       · 전화상담 ∙ 날짜 ∙ 상담시간 (14px regular #99A1AF)
 *    2) 본문 섹션 (padding 16, gap 10)
 *       · 본문 텍스트 (14px regular line-height 150% #4A5565)
 *       · 큰 이미지 (full-width)
 *  [답변 섹션 (gap 24)]
 *    · 카운터 "상담사 답변 N건" (15px, N만 #8259F5 medium) + border-b
 *    · 답변 있음: 답변 본문 → 작은 아바타 + 상담사명 · 날짜시간
 *    · 답변 없음: 연보라 원형 + 말풍선 아이콘 + "등록된 답변이 없습니다."
 *  [목록으로 outline-primary 버튼 (좌측 정렬, 120×40)]
 *  [floating: go_top만 (카카오 없음)]
 */

export default function ReviewDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const review = MOCK_REVIEWS.find((r) => String(r.id) === id) ?? MOCK_REVIEWS[0]

  return (
    <div className="mobile-frame flex flex-col">
      {/* 헤더 — hd5 (Figma 6:2228) */}
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
          상담 후기
        </h1>
      </header>

      <main className="flex-1 flex flex-col pb-10">
        {/* 본문 그룹 (gap 16) */}
        <div className="flex flex-col gap-4">
          <ReviewHeader review={review} />
          <ReviewBody review={review} />
        </div>

        {/* 답변 섹션 */}
        <ReplySection review={review} className="mt-10" />

        {/* 목록으로 — 좌측 정렬, 페이지 하단 */}
        <div className="px-4 mt-10">
          <Link
            to="/reviews"
            className="inline-flex items-center justify-center w-[120px] h-10 px-4 rounded-full bg-white border border-[#9B7AF7] text-[#8259F5] text-[14px] font-medium"
          >
            목록으로
          </Link>
        </div>
      </main>

      <FloatingActions bottomOffset={16} showKakao={false} />
    </div>
  )
}

/* ───────────── 제목·고객·메타 섹션 ───────────── */

function ReviewHeader({ review }: { review: Review }) {
  const { reviewTitle, customerNameFull, reviewType, date, duration, showLock } = review
  return (
    <section className="px-4 pt-4 flex flex-col gap-2">
      {/* 제목 */}
      <div className="flex items-center gap-1">
        {showLock && <LockIcon />}
        <h2 className="text-[18px] leading-[130%] font-medium text-[#1E2939]">
          {reviewTitle}
        </h2>
      </div>

      {/* 본인인증 아이콘 + 고객이름 (풀 이름 노출) */}
      <div className="flex items-center gap-1">
        <img src="/img/ic_reviewer.svg" alt="" className="w-4 h-4 shrink-0" />
        <span className="text-[14px] leading-[130%] font-medium text-[#1E2939]">
          {customerNameFull}
        </span>
      </div>

      {/* 전화상담 ∙ 날짜 ∙ 상담시간 */}
      <div className="flex items-center gap-1 text-[14px] leading-[130%] text-[#99A1AF]">
        <span>{reviewType}</span>
        <span aria-hidden>∙</span>
        <span>{date}</span>
        <span aria-hidden>∙</span>
        <span>{duration}</span>
      </div>
    </section>
  )
}

/* ───────────── 본문 텍스트 + 큰 이미지 ───────────── */

function ReviewBody({ review }: { review: Review }) {
  const { reviewContent, imgUrl } = review
  return (
    <section className="px-4 pb-4 flex flex-col gap-2.5">
      <p className="text-[14px] leading-[150%] text-[#4A5565] whitespace-pre-line">
        {reviewContent}
      </p>
      {imgUrl && (
        <img
          src={imgUrl}
          alt=""
          className="w-full rounded-none object-cover"
          style={{ aspectRatio: '358 / 483' }}
        />
      )}
    </section>
  )
}

/* ───────────── 답변 섹션 ───────────── */

function ReplySection({ review, className = '' }: { review: Review; className?: string }) {
  const hasReply = !!review.reply

  return (
    <section className={`flex flex-col gap-6 ${className}`}>
      {/* 카운터 — "상담사 답변 N건" */}
      <div className="px-4 pb-3 flex items-center border-b border-[#F3F4F6]">
        <p className="text-[15px] leading-[130%] text-[#364153]">
          상담사 답변{' '}
          <span className="font-medium text-[#8259F5]">{hasReply ? 1 : 0}</span>건
        </p>
      </div>

      {hasReply ? (
        <article className="px-4 flex flex-col gap-3">
          {/* 답변 본문 — 먼저 노출 */}
          <p className="text-[14px] leading-[150%] text-[#4A5565] whitespace-pre-line">
            {review.reply!.text}
          </p>
          {/* 작은 아바타 + 상담사명 ∙ 날짜 시간 */}
          <div className="flex items-center gap-2">
            <img
              src={review.profileImg}
              alt=""
              className="w-7 h-7 rounded-full object-cover border border-[#F9FAFB] shrink-0"
            />
            <div className="flex items-center gap-1 text-[13px] leading-[130%] text-[#6A7282]">
              <span className="font-medium text-[#1E2939]">{review.counselorName}</span>
              <span aria-hidden>∙</span>
              <span>{review.date} 20:10</span>
            </div>
          </div>
        </article>
      ) : (
        <div className="h-[230px] flex flex-col items-center justify-center gap-3 px-4">
          {/* 연보라 원형 + 말풍선 아이콘 */}
          <div className="w-[60px] h-[60px] rounded-full bg-[#F3EEFE] flex items-center justify-center">
            <SpeechBubbleIcon />
          </div>
          <p className="text-[14px] leading-[130%] text-[#99A1AF]">
            등록된 답변이 없습니다.
          </p>
        </div>
      )}
    </section>
  )
}

/* ───────────── 인라인 아이콘 ───────────── */

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4 shrink-0" fill="none" aria-hidden>
      <rect x="3" y="7" width="10" height="6.5" rx="1.3" stroke="#1E2939" strokeWidth="1.4" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="#1E2939" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

/** 말풍선 아이콘 — Figma 답변 없음 빈 상태. 둥근 사각형 말풍선 + 점 3개. */
function SpeechBubbleIcon() {
  return (
    <svg viewBox="0 0 28 28" className="w-7 h-7" fill="none" aria-hidden>
      <path
        d="M5 8c0-1.66 1.34-3 3-3h12c1.66 0 3 1.34 3 3v8c0 1.66-1.34 3-3 3h-6l-4.5 4v-4H8c-1.66 0-3-1.34-3-3V8z"
        stroke="#9B7AF7"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
