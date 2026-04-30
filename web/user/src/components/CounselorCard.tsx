import { Link } from 'react-router-dom'

export interface Counselor {
  id: number | string
  name: string
  badge?: '신점' | '사주' | '타로' | string
  /** 4자리 ~ 6자리 ID */
  code: string
  tagline: string
  pricePerSec: number
  /** 'available' | 'busy' | 'offline' */
  phoneState: 'available' | 'busy' | 'offline'
  chatState: 'available' | 'busy' | 'offline'
  hashtags: string[]
  rating: number
  reviewCount: number
  liked?: boolean
  imgUrl: string
}

interface Props {
  counselor: Counselor
  onLikeToggle?: (id: Counselor['id']) => void
  /** 채팅 버튼을 숨기고 전화 버튼만 풀폭으로 노출 — Figma 카드 prop `btn2:false` 대응 */
  hideChat?: boolean
}

/** 뱃지 종류별 배경색 — Figma 1:175(신점=#00BBA7) / 1:177(사주=#FF6467) / 1:183(타로=#8259F5) */
const BADGE_BG: Record<string, string> = {
  타로: '#8259F5',
  신점: '#00BBA7',
  사주: '#FF6467',
}

/**
 * 상담사 카드 — Figma 1:195 (type=상담사)
 *
 *  레이아웃 (16px 패딩, white 배경, rounded-16, 하단 1px 구분선):
 *   ┌──────────────────────────────────┐
 *   │ [100×100 img]  이름 코드      ♡ │
 *   │  [뱃지]        tagline           │
 *   │                30초당 X,XXX원   │
 *   │                                  │
 *   │ [전화 상담하기] [채팅 상담하기] │
 *   │                                  │
 *   │ #해시태그          ★4.9  💬326  │
 *   └──────────────────────────────────┘
 */
export default function CounselorCard({ counselor, onLikeToggle, hideChat }: Props) {
  const { id, name, badge, code, tagline, pricePerSec, phoneState, chatState, hashtags, rating, reviewCount, liked, imgUrl } = counselor
  const badgeBg = (badge && BADGE_BG[badge]) || '#8259F5'

  return (
    <article className="bg-white border-b border-[#F3F4F6] p-4 flex flex-col gap-3">
      <div className="flex gap-3">
        {/* 이미지 + 뱃지 */}
        <div className="relative w-[100px] h-[100px] shrink-0">
          <Link to={`/counselors/${id}`}>
            <img src={imgUrl} alt={name} className="w-[100px] h-[100px] rounded-2xl object-cover" />
          </Link>
          {badge && (
            <span
              className="absolute top-2 left-2 text-white text-[12px] font-medium leading-[110%] px-[5px] py-[3px] rounded-full inline-flex items-center justify-center"
              style={{ backgroundColor: badgeBg }}
            >
              {badge}
            </span>
          )}
        </div>

        {/* 우측 정보 — Figma Frame 505 (column gap 12, padding 4 0 0) */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 pt-1">
          {/* Frame 459 — 이름줄 + 한줄소개 (column gap 4) */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Link to={`/counselors/${id}`} className="flex items-baseline gap-2 min-w-0 flex-1">
                <span className="text-[16px] leading-[130%] font-semibold text-[#030712] truncate">
                  {name}
                </span>
                <span className="text-[16px] leading-[130%] font-semibold text-[#8259F5]">
                  {code}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => onLikeToggle?.(id)}
                aria-label={liked ? '단골 해제' : '단골 추가'}
                className="w-5 h-5 flex items-center justify-center shrink-0"
              >
                <img
                  src={liked ? '/img/like_btn_icon_on.svg' : '/img/like_btn_icon_off.svg'}
                  alt=""
                  className="w-5 h-5"
                />
              </button>
            </div>
            <p className="text-[15px] leading-[140%] text-[#6A7282] line-clamp-1">{tagline}</p>
          </div>
          {/* Frame 433 — 가격 (row gap 4, items center) */}
          <div className="flex items-baseline gap-1">
            <span className="text-[14px] leading-[110%] text-[#99A1AF]">30초당</span>
            <span className="text-[16px] leading-[110%] font-semibold text-[#8259F5]">
              {pricePerSec.toLocaleString()}원
            </span>
          </div>
        </div>
      </div>

      {/* 상담 버튼 — Figma Frame 524 (row, gap 8). hideChat 일 때 전화 버튼만 풀폭 */}
      <div className={hideChat ? 'flex' : 'grid grid-cols-2 gap-2'}>
        <ContactButton state={phoneState} kind="phone" fullWidth={hideChat} />
        {!hideChat && <ContactButton state={chatState} kind="chat" />}
      </div>

      {/* 해시태그 + 평점·후기 — Figma Frame 514 (row, justify-between, gap-내부 10) */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
          {hashtags.map((tag) => (
            <span key={tag} className="text-[14px] leading-[110%] text-[#8259F5]">
              #{tag}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2.5 shrink-0 ml-2.5">
          <span className="flex items-center gap-0.5">
            <img src="/img/ic_review.svg" alt="" className="w-4 h-4" />
            <span className="text-[14px] leading-[110%] text-[#6A7282]">{rating.toFixed(1)}</span>
          </span>
          <span className="flex items-center gap-0.5">
            <img src="/img/ic_message_g.svg" alt="" className="w-4 h-4" />
            <span className="text-[14px] leading-[110%] text-[#6A7282]">{reviewCount}</span>
          </span>
        </div>
      </div>
    </article>
  )
}

interface ContactButtonProps {
  state: 'available' | 'busy' | 'offline'
  kind: 'phone' | 'chat'
  fullWidth?: boolean
}

function ContactButton({ state, kind, fullWidth }: ContactButtonProps) {
  const baseLabel = '상담하기'
  const label = state === 'available' ? baseLabel : state === 'busy' ? '상담중' : '오프라인'
  const disabled = state !== 'available'
  const iconSrc =
    kind === 'phone'
      ? state === 'available' ? '/img/ic_phone_p.svg' : '/img/ic_phone_call_g.svg'
      : state === 'available' ? '/img/ic_message_p.svg' : '/img/ic_message_g.svg'

  return (
    <button
      type="button"
      disabled={disabled}
      className={[
        fullWidth ? 'w-full' : '',
        disabled
          ? 'h-10 rounded-full bg-[#E5E7EB] text-[#99A1AF] text-[14px] font-medium flex items-center justify-center gap-1 cursor-not-allowed border border-[#E5E7EB]'
          : 'h-10 rounded-full bg-white border border-[#9B7AF7] text-[#8259F5] text-[14px] font-medium flex items-center justify-center gap-1 hover:bg-[#F3EEFE] transition',
      ].join(' ')}
    >
      <img src={iconSrc} alt="" className="w-4 h-4" />
      {label}
    </button>
  )
}
