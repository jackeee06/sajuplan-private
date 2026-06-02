import { Link } from 'react-router-dom'
import UploadedImage from './UploadedImage'
import type { PublicRecentReview } from '../lib/api'

const BADGE_BG: Record<string, string> = {
  타로: '#ec4899',
  신점: '#00BBA7',
  사주: '#FF6467',
}

interface Props {
  review: PublicRecentReview
}

/**
 * 메인 페이지 후기 탭 카드 — sample tab06 단순화 버전.
 * Reviews.tsx 의 ReviewCard 와 같은 톤이지만 "더보기/답글/사진" 등 부가 요소는 제외.
 *
 * 노출:
 *   상단: 상담사 프로필(원형) + 뱃지 + 닉네임/코드 + 작성일 (YYYY.MM.DD)
 *   본문: 작성자명 + 후기 제목 + 본문 한 줄 (line-clamp)
 *   비밀글: 본문 자리에 "🔒 비밀 후기입니다"
 */
export default function ReviewCardMain({ review }: Props) {
  const {
    counselor_id,
    counselor_nickname,
    counselor_code,
    counselor_profile_image,
    counselor_profile_image_webp,
    category,
    reviewer_name,
    title,
    content,
    created_at,
  } = review

  const badge = category === '기타' ? null : category
  const badgeBg = badge ? BADGE_BG[badge] : '#ec4899'
  const isSecret = !content
  const dateText = formatDate(created_at)

  return (
    <article className="px-4 py-4 flex flex-col gap-3 border-b border-[#F3F4F6]">
      {/* 상단: 상담사 프로필 + 메타 */}
      <div className="flex gap-2 items-center">
        <Link
          to={`/counselors/${counselor_id}`}
          className="flex-1 flex items-center gap-2 min-w-0"
        >
          {counselor_profile_image ? (
            <UploadedImage
              src={counselor_profile_image}
              srcWebp={counselor_profile_image_webp}
              alt=""
              className="w-12 h-12 rounded-full object-cover border border-[#F9FAFB] shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#F3F4F6] shrink-0" aria-hidden />
          )}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
            <div className="flex items-center gap-1 flex-wrap">
              {badge && (
                <span
                  className="text-white text-[12px] font-medium leading-[110%] px-[5px] py-[3px] rounded-full inline-flex items-center justify-center"
                  style={{ backgroundColor: badgeBg }}
                >
                  {badge}
                </span>
              )}
              <span className="text-[16px] leading-[120%] font-semibold text-[#030712] truncate">
                {counselor_nickname}
              </span>
              {counselor_code && (
                <span className="text-[16px] leading-[120%] font-semibold text-[#ec4899]">
                  {counselor_code}
                </span>
              )}
            </div>
            <span className="text-[14px] leading-[130%] text-[#99A1AF]">{dateText}</span>
          </div>
        </Link>
      </div>

      {/* 작성자 + 후기 본문 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1">
          <ReviewerIcon />
          <span className="flex-1 text-[14px] leading-[130%] font-medium text-[#1E2939]">
            {reviewer_name}
          </span>
        </div>
        <h3 className="text-[14px] leading-[130%] font-medium text-[#1E2939] line-clamp-1">
          {title}
        </h3>
        {isSecret ? (
          <p className="text-[14px] leading-[130%] text-[#99A1AF] flex items-center gap-1">
            <LockIcon />
            비밀 후기입니다
          </p>
        ) : (
          <p className="text-[14px] leading-[130%] text-[#4A5565] line-clamp-2 whitespace-pre-line">
            {content}
          </p>
        )}
      </div>
    </article>
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

function ReviewerIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
      <circle cx="8" cy="6" r="3" stroke="#99A1AF" strokeWidth="1.4" />
      <path
        d="M2.5 13.5C3.5 11 5.5 10 8 10s4.5 1 5.5 3.5"
        stroke="#99A1AF"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
      <rect x="3" y="7" width="10" height="6.5" rx="1.5" stroke="#99A1AF" strokeWidth="1.4" />
      <path d="M5.5 7V4.5a2.5 2.5 0 0 1 5 0V7" stroke="#99A1AF" strokeWidth="1.4" />
    </svg>
  )
}
