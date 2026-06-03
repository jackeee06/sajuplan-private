import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import UploadedImage from './UploadedImage'
import AlertModal from './AlertModal'
import { useConsultModal } from '../lib/consult-context'
import { useLikeAction } from '../lib/like-context'
import { ApiError, counselorsApi } from '../lib/api'

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
  /** 부재 상태 (ABSE/RESV) — 카드 버튼 영역을 "상담요청하기" 로 대체 (2026-05-22) */
  isOffline?: boolean
  /** 24시간 내 "상담요청하기" 신청 여부 — 버튼이 "요청됨 ✓" 으로 보임 */
  isRequested?: boolean
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

/** 뱃지 종류별 배경색 — Figma 1:175(신점=#00BBA7) / 1:177(사주=#FF6467) / 1:183(타로=#ec4899) */
const BADGE_BG: Record<string, string> = {
  타로: '#ec4899',
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
  const { id, name, badge, code, tagline, pricePerSec, phoneState, chatState, hashtags, reviewCount, liked: likedProp, isNew, imgUrl, imgUrlWebp, isOffline, isRequested: isRequestedProp } = counselor
  const badgeBg = (badge && BADGE_BG[badge]) || '#ec4899'
  const { openConsult } = useConsultModal()
  const { toggleLike } = useLikeAction()
  const navigate = useNavigate()

  // 카드 내부에서 토글 즉시 반영(optimistic), prop 으로 들어오는 새 값에도 동기화.
  const [liked, setLiked] = useState<boolean>(!!likedProp)
  const [likeBusy, setLikeBusy] = useState(false)
  // busy 버튼 클릭 시 안내 모달 (Phase 1차 — 알림 등록 시스템은 Phase 2 별도)
  const [busyAlertOpen, setBusyAlertOpen] = useState(false)
  // 부재 상담사 "상담요청하기" 상태 (2026-05-22)
  const [isRequested, setIsRequested] = useState<boolean>(!!isRequestedProp)
  const [requestBusy, setRequestBusy] = useState(false)
  const [requestAlert, setRequestAlert] = useState<{ open: boolean; title: string; message: string }>(
    { open: false, title: '', message: '' },
  )
  useEffect(() => {
    setLiked(!!likedProp)
  }, [likedProp])
  useEffect(() => {
    setIsRequested(!!isRequestedProp)
  }, [isRequestedProp])

  const handleRequestConsult = async () => {
    if (requestBusy || isRequested) return
    setRequestBusy(true)
    try {
      const r = await counselorsApi.requestConsult(id)
      setIsRequested(true)
      setRequestAlert({
        open: true,
        title: r.already ? '이미 요청됨' : '상담 요청을 보냈어요',
        message: r.already
          ? `${name} 상담사님에게 24시간 내 이미 요청을 보냈어요.\n상담사가 접속하면 알림이 갈 거예요.`
          : `${name} 상담사님에게 알림이 전송됐어요.\n접속하시면 다시 안내드릴게요.`,
      })
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        navigate('/login')
        return
      }
      setRequestAlert({
        open: true,
        title: '요청 실패',
        message: e instanceof Error ? e.message : '잠시 후 다시 시도해주세요.',
      })
    } finally {
      setRequestBusy(false)
    }
  }

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
                {/* 2026-05-25: ARS 단축번호(dtmfno) 노출 제거 — 앱 안에서 사용 안 함, 회원에게 의미 없음 */}
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
          {/* Frame 433 — 가격 */}
          <div className="flex items-baseline gap-1">
            <span className="text-[14px] leading-[110%] text-[#99A1AF]">30초당</span>
            <span className="text-[16px] leading-[110%] font-semibold text-[#ec4899]">
              {pricePerSec.toLocaleString()}원
            </span>
          </div>
        </div>
      </div>

      {/* 상담 버튼 — 부재(ABSE/RESV) 면 "상담요청하기" 한 줄 풀폭, 아니면 전화/채팅 두 버튼 */}
      {isOffline ? (
        <button
          type="button"
          onClick={handleRequestConsult}
          disabled={requestBusy || isRequested}
          className={
            'w-full h-10 rounded-full text-[14px] font-medium flex items-center justify-center gap-1.5 transition ' +
            (isRequested
              ? 'bg-[#F3F4F6] text-[#9CA3AF] cursor-not-allowed'
              : 'bg-[#F9FAFB] border border-[#E5E7EB] text-[#6A7282] hover:bg-[#F3F4F6] disabled:opacity-60')
          }
        >
          {isRequested ? (
            <>
              <span aria-hidden>✓</span>
              <span>요청됨</span>
            </>
          ) : (
            <>
              <img src="/img/ic_bell_g.svg" alt="" className="w-4 h-4" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              <span>상담요청하기</span>
            </>
          )}
        </button>
      ) : (
        <div className={hideChat ? 'flex' : 'grid grid-cols-2 gap-2'}>
          <ContactButton
            state={phoneState}
            kind="phone"
            fullWidth={hideChat}
            onClick={() => onContact('phone')}
            onBusyClick={() => setBusyAlertOpen(true)}
          />
          {!hideChat && (
            <ContactButton
              state={chatState}
              kind="chat"
              onClick={() => onContact('chat')}
              onBusyClick={() => setBusyAlertOpen(true)}
            />
          )}
        </div>
      )}

      {/* 해시태그 + 후기 수 */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
          {hashtags.map((tag) => (
            <span key={tag} className="text-[14px] leading-[110%] text-[#374151]">
              #{tag}
            </span>
          ))}
        </div>
        {reviewCount > 0 && (
          <Link
            to={`/counselors/${id}/reviews`}
            className="flex items-center gap-0.5 text-[13px] text-[#6A7282] leading-none shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <span>⭐</span>
            <span>후기({reviewCount})</span>
          </Link>
        )}
      </div>

      {/* busy 클릭 시 안내 모달 — Phase 2 에서 접속알림 등록 기능으로 교체 예정 */}
      <AlertModal
        open={busyAlertOpen}
        title="현재 상담 중입니다"
        message={`${name} 상담사님은 다른 분과 상담 중이에요.\n잠시 후 다시 확인해주세요.`}
        confirmLabel="확인"
        onClose={() => setBusyAlertOpen(false)}
      />

      {/* 상담요청하기 결과 안내 모달 (2026-05-22) */}
      <AlertModal
        open={requestAlert.open}
        title={requestAlert.title}
        message={requestAlert.message}
        confirmLabel="확인"
        onClose={() => setRequestAlert((s) => ({ ...s, open: false }))}
      />
    </article>
  )
}

interface ContactButtonProps {
  state: 'available' | 'busy' | 'offline'
  kind: 'phone' | 'chat'
  fullWidth?: boolean
  onClick?: () => void
  /** busy 상태에서 클릭 시 호출 (안내 모달 띄움) */
  onBusyClick?: () => void
}

/**
 * 상담 버튼 — 상태별 디자인 (2026-05-21, 사장님 정책).
 *
 *  - available : 흰 바탕 + 핑크 테두리 + 핑크 텍스트/아이콘 (outline 스타일, 원래 디자인 유지)
 *  - busy      : 분홍 filled (#ec4899) + 흰 텍스트/아이콘 → 회색 X, 활기참 (이번 변경 핵심)
 *                클릭 시 안내 모달 (Phase 2 에서 접속알림 등록으로 교체 예정)
 *  - offline   : 회색 (#E5E7EB) + 회색 텍스트/아이콘 → 실제 응답 불가 명확히
 *
 * 핵심: busy 만 분홍 filled. available 은 원래 outline 그대로.
 *  → 시각 위계: available (외곽선) ≠ busy (강조) — 둘이 다르다는 게 명확.
 */
function ContactButton({ state, kind, fullWidth, onClick, onBusyClick }: ContactButtonProps) {
  const baseLabel = kind === 'phone' ? '전화상담' : '채팅상담'
  const label = state === 'available' ? baseLabel : state === 'busy' ? '상담중' : '오프라인'

  // 아이콘 — 상태별로 색이 다름
  const iconSrc =
    state === 'available'
      ? (kind === 'phone' ? '/img/ic_phone_p.svg?v=v2' : '/img/ic_message_p.svg?v=v2')
      : state === 'busy'
        ? (kind === 'phone' ? '/img/ic_phone_solid_w.svg' : '/img/ic_message_solid_w.svg')
        : (kind === 'phone' ? '/img/ic_phone_call_g.svg' : '/img/ic_message_g.svg')

  const handleClick =
    state === 'available' ? onClick
    : state === 'busy'    ? onBusyClick
    : undefined  // offline = 완전 비활성

  const cls = [
    fullWidth ? 'w-full' : '',
    'h-10 rounded-full text-[14px] font-medium flex items-center justify-center gap-1 transition',
    state === 'available'
      ? 'bg-white border border-[#f472b6] text-[#ec4899] hover:bg-[#fdf2f8]'
      : state === 'busy'
        ? 'bg-[#ec4899] text-white border border-[#ec4899] hover:opacity-90 active:opacity-80'
        : 'bg-[#E5E7EB] text-[#99A1AF] border border-[#E5E7EB] cursor-not-allowed',
  ].join(' ')

  return (
    <button
      type="button"
      disabled={state === 'offline'}
      onClick={handleClick}
      className={cls}
    >
      <img src={iconSrc} alt="" className="w-4 h-4" />
      {label}
    </button>
  )
}
