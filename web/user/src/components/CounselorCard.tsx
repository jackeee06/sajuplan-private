import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import UploadedImage from './UploadedImage'
import { useConsultModal } from '../lib/consult-context'
import { useLikeAction } from '../lib/like-context'

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
  /** 신규 상담사 — 가입 후 90일 이내 (2026-05-15). 카드 우측 상단에 NEW 뱃지 노출 */
  isNew?: boolean
  imgUrl: string
  /** WebP 변환본 — 있으면 <picture> source 로 우선 사용 (선택) */
  imgUrlWebp?: string | null
}

interface Props {
  counselor: Counselor
  /**
   * 부모가 좋아요 변경에 반응하고 싶을 때 — 카드 자체는 통합 LikeContext 로 API 호출까지 끝낸 뒤
   * 이 콜백으로 결과(id, nextLiked)를 알려준다. (예: 단골 페이지가 목록에서 카드 제거)
   */
  onLikeToggle?: (id: Counselor['id'], nextLiked: boolean) => void
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
  // rating 은 데이터 미정착으로 UI 노출 제거 (2026-05-15) — 매퍼에서는 계속 받음, destructure 만 생략
  const { id, name, badge, code, tagline, pricePerSec, phoneState, chatState, hashtags, reviewCount, liked: likedProp, isNew, imgUrl, imgUrlWebp } = counselor
  const badgeBg = (badge && BADGE_BG[badge]) || '#8259F5'
  const { openConsult } = useConsultModal()
  const { toggleLike } = useLikeAction()

  // 카드 내부에서 토글 즉시 반영(optimistic), prop 으로 들어오는 새 값에도 동기화.
  const [liked, setLiked] = useState<boolean>(!!likedProp)
  const [likeBusy, setLikeBusy] = useState(false)
  useEffect(() => {
    setLiked(!!likedProp)
  }, [likedProp])

  const handleLikeClick = async () => {
    if (likeBusy) return
    const next = !liked
    setLikeBusy(true)
    setLiked(next) // optimistic
    const res = await toggleLike(id, next)
    if (res === null) {
      // 실패/비로그인 — 원복
      setLiked(!next)
    } else {
      // 부모에게 결과 통지 (예: Favorites 페이지에서 unlike 시 목록에서 제거)
      onLikeToggle?.(id, res.is_liked)
    }
    setLikeBusy(false)
  }

  const onContact = (kind: 'phone' | 'chat') => {
    openConsult(
      {
        id,
        name,
        badge,
        code,
        pricePerHalfMin: pricePerSec,
        avatarUrl: imgUrl,
        avatarUrlWebp: imgUrlWebp ?? null,
      },
      kind,
    )
  }

  return (
    <article className="bg-white border-b border-[#F3F4F6] p-4 flex flex-col gap-3">
      <div className="flex gap-3">
        {/* 이미지 + 뱃지 */}
        <div className="relative w-[100px] h-[100px] shrink-0">
          <Link to={`/counselors/${id}`}>
            <UploadedImage
              src={imgUrl}
              srcWebp={imgUrlWebp}
              alt={name}
              className="w-[100px] h-[100px] rounded-2xl object-cover"
            />
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
                {isNew && (
                  <span
                    className="text-[10px] leading-none font-bold text-white px-1.5 py-0.5 rounded-full bg-[#FF6467] shrink-0"
                    aria-label="신규 상담사"
                  >
                    NEW
                  </span>
                )}
              </Link>
              <button
                type="button"
                onClick={handleLikeClick}
                disabled={likeBusy}
                aria-label={liked ? '단골 해제' : '단골 추가'}
                className="w-5 h-5 flex items-center justify-center shrink-0 bg-transparent border-0 outline-none focus:outline-none disabled:opacity-60"
                style={{ WebkitTapHighlightColor: 'transparent' }}
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
        <ContactButton state={phoneState} kind="phone" fullWidth={hideChat} onClick={() => onContact('phone')} />
        {!hideChat && <ContactButton state={chatState} kind="chat" onClick={() => onContact('chat')} />}
      </div>

      {/* 해시태그 + 후기 수 — 별점은 데이터 미정착으로 노출 제거 (2026-05-15) */}
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
  onClick?: () => void
}

function ContactButton({ state, kind, fullWidth, onClick }: ContactButtonProps) {
  const baseLabel = kind === 'phone' ? '전화상담' : '채팅상담'
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
      onClick={disabled ? undefined : onClick}
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
