import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import FloatingActions from './FloatingActions'
import ShareBottomSheet from './ShareBottomSheet'
import { BADGE_BG, type CounselorDetailData } from '../data/counselorDetails'
import { useConsultModal } from '../lib/consult-context'
import { useLikeAction } from '../lib/like-context'

/**
 * 상담사 상세 공통 레이아웃 — Figma 76:4852 / 84:4721 / 92:4694 공유 골격
 *
 * 3개 탭(소개·후기·문의)이 같은 페이지의 본문 영역만 다르므로 헤더·프로필·탭·하단 CTA를
 * 한 컴포넌트에 묶고 children으로 본문만 주입한다.
 *
 * 구조:
 *  - 히어로 이미지(390×192) + hd4 헤더 오버레이 (← / 홈)
 *  - 라이브뷰어 pill (히어로 하단 침범)
 *  - 프로필 카드: 뱃지/이름/번호/하트 / 한줄소개 / 태그 / 가격
 *  - 전문분야 / 스타일
 *  - 상담사 약력 (보라 원형 아이콘 + 불릿)
 *  - 상담사 공지사항
 *  - 회색 8px 구분
 *  - line_tab (소개·후기·문의)
 *  - {children} ← 탭별 본문
 *  - bottom_fixed_btn (하트·전화·채팅)
 *  - FloatingActions (go_top만)
 */

interface Props {
  data: CounselorDetailData
  activeTab: 'intro' | 'reviews' | 'qna'
  children: ReactNode
}

export default function CounselorDetailLayout({ data, activeTab, children }: Props) {
  const navigate = useNavigate()
  const { openConsult } = useConsultModal()
  const { toggleLike } = useLikeAction()
  const [liked, setLiked] = useState(data.liked)
  const [likeCount, setLikeCount] = useState(data.likeCount)
  const [likeBusy, setLikeBusy] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') setShareUrl(window.location.href)
  }, [])

  const triggerConsult = (variant: 'phone' | 'chat') => {
    openConsult(
      {
        id: data.id,
        name: data.name,
        badge: data.badge,
        code: data.code,
        pricePerHalfMin: data.pricePerHalfMin,
        avatarUrl: data.heroImg,
        avatarUrlWebp: data.heroImgWebp ?? null,
      },
      variant,
    )
  }

  // 통합 LikeContext 사용 — 401 시 자동으로 통합 로그인 안내 모달 노출
  const onLikeToggle = async () => {
    if (likeBusy) return
    const next = !liked
    setLikeBusy(true)
    setLiked(next) // optimistic
    const res = await toggleLike(data.id, next)
    if (res === null) {
      setLiked(!next) // 실패/비로그인 — 원복
    } else {
      setLikeCount(res.fan_count > 999 ? '999+' : String(res.fan_count))
    }
    setLikeBusy(false)
  }

  return (
    <div className="mobile-frame flex flex-col pb-[64px]">
      {/* 히어로 + hd4 헤더 + 라이브뷰어 pill */}
      <div className="relative">
        {/* picture 로 webp 우선 노출 — 미지원 브라우저는 src(jpg/png) 폴백 */}
        <picture>
          {data.heroImgWebp && <source srcSet={data.heroImgWebp} type="image/webp" />}
          <img
            src={data.heroImg}
            alt=""
            className="w-full aspect-[5/4] object-cover object-top block"
            aria-hidden
          />
        </picture>
        <header
          className="absolute inset-x-0 top-0 h-[60px] px-4 flex items-center gap-3 z-10"
          style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 100%)',
          }}
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="뒤로"
            className="w-[30px] h-[30px] flex items-center justify-center"
          >
            <svg viewBox="0 0 28 28" className="w-[28px] h-[28px]" fill="none" aria-hidden>
              <path d="M17 6l-8 8 8 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex-1" />
          <Link to="/" aria-label="홈" className="w-[30px] h-[30px] flex items-center justify-center">
            <img src="/img/ic_hd_home.svg" alt="" className="w-[30px] h-[30px]" />
          </Link>
        </header>

        {/* 라이브뷰어 pill — 의사값이라 숨김 (2026-05-27). 진짜 presence 인프라(WebSocket/Redis) 도입 시 복원. 백엔드 live_viewers 필드는 그대로 유지. */}
      </div>

      {/* 프로필 카드 */}
      <div className="px-4 mt-[24px]">
        <section className="flex flex-col gap-4 pb-6 border-b border-[#F3F4F6]">
          <div className="flex gap-2">
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <span
                  className="text-white text-[12px] font-medium leading-[110%] px-[5px] py-[3px] rounded-full inline-flex items-center justify-center"
                  style={{ backgroundColor: BADGE_BG[data.badge] }}
                >
                  {data.badge}
                </span>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[18px] leading-[130%] font-semibold text-[#030712] truncate">
                    {data.name}
                  </span>
                  <span className="text-[18px] leading-[130%] font-semibold text-[#ec4899]">
                    {data.code}
                  </span>
                </div>
              </div>
              <p className="text-[15px] leading-[140%] text-[#6A7282]">{data.tagline}</p>
              <div className="flex items-center gap-2.5 flex-wrap">
                {data.hashtags.map((tag) => (
                  <span key={tag} className="text-[14px] leading-[110%] text-[#ec4899]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-start gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                aria-label="공유하기"
                className="w-9 h-9 rounded-full border border-[#E5E7EB] flex items-center justify-center bg-white"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="#4A5565" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              </button>
              <button
                type="button"
                onClick={onLikeToggle}
                disabled={likeBusy}
                aria-label={liked ? '좋아요 취소' : '좋아요'}
                className="flex flex-col items-center bg-transparent border-0 outline-none focus:outline-none focus-visible:outline-none disabled:opacity-60"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <img
                  src={liked ? '/img/like_btn_icon_on.svg' : '/img/like_btn_icon_off.svg'}
                  alt=""
                  className="w-5 h-5"
                />
                <span className="text-[14px] leading-[120%] text-[#6A7282] text-center">
                  {likeCount}
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[16px] leading-[110%] font-semibold text-[#030712]">
              {data.pricePerHalfMin.toLocaleString()}원
            </span>
            <span className="text-[14px] leading-[110%] text-[#99A1AF]">30초당</span>
          </div>
        </section>

        <section className="flex flex-col gap-3 py-6 border-b border-[#F3F4F6]">
          <div className="flex items-center justify-between">
            <span className="text-[15px] leading-[110%] font-medium text-[#364153]">전문분야</span>
            <span className="text-[15px] leading-[110%] text-[#6A7282]">
              {data.fields.join(', ')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[15px] leading-[110%] font-medium text-[#364153]">스타일</span>
            <span className="text-[15px] leading-[110%] text-[#6A7282]">
              {data.styles.join(', ')}
            </span>
          </div>
        </section>

        <section className="flex flex-col gap-3 py-6 border-b border-[#F3F4F6]">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-[#fdf2f8] flex items-center justify-center shrink-0">
              <img src="/img/counselor_dt_img01.png" alt="" className="w-9 h-9 object-contain" />
            </div>
            <h3 className="text-[16px] leading-[120%] font-semibold text-[#101828]">상담사 약력</h3>
          </div>
          <ul className="text-[14px] leading-[150%] text-[#4A5565] flex flex-col">
            {data.career.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3 py-6">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-[#fdf2f8] flex items-center justify-center shrink-0">
              <img src="/img/counselor_dt_img02.png" alt="" className="w-9 h-9 object-contain" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-[16px] leading-[120%] font-semibold text-[#101828]">
                상담사 공지사항
              </h3>
              <p className="text-[14px] leading-[120%] text-[#6A7282]">{data.noticeDate}</p>
            </div>
          </div>
          <p className="text-[14px] leading-[150%] text-[#4A5565] whitespace-pre-line">
            {data.noticeContent}
          </p>
        </section>
      </div>

      <div className="h-2 bg-[#F9FAFB]" aria-hidden />

      {/* 탭 sticky + 본문 */}
      <div>
        <div className="sticky top-0 z-20 bg-white px-4 border-b border-[#F3F4F6]">
          <DetailTabs activeTab={activeTab} id={String(data.id)} reviewTotal={data.reviewTotal} qnaTotal={data.qnaTotal} />
        </div>
        <div className="px-4 flex flex-col gap-5 py-5 pb-10">
          {children}
        </div>
      </div>

      {/* 하단 고정 CTA */}
      <BottomFixedBar
        liked={liked}
        onLikeToggle={onLikeToggle}
        onPhoneClick={() => triggerConsult('phone')}
        onChatClick={() => triggerConsult('chat')}
      />

      <FloatingActions bottomOffset={80} showKakao={false} />

      <ShareBottomSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        shareUrl={shareUrl}
        title={`${data.name} 선생님`}
        description={`${data.badge} · ${data.code}번 · ${data.pricePerHalfMin.toLocaleString()}원/30초`}
        imageUrl={data.heroImg}
      />
    </div>
  )
}

/* ───────────── line_tab ───────────── */

function DetailTabs({
  activeTab,
  id,
  reviewTotal,
  qnaTotal,
}: {
  activeTab: 'intro' | 'reviews' | 'qna'
  id: string
  reviewTotal: string
  qnaTotal: string
}) {
  const tabs: { key: 'intro' | 'reviews' | 'qna'; label: string; to: string }[] = [
    { key: 'intro',   label: '상담사 소개', to: `/counselors/${id}` },
    { key: 'reviews', label: `후기(${reviewTotal})`,  to: `/counselors/${id}?tab=reviews` },
    { key: 'qna',     label: `문의(${qnaTotal})`,     to: `/counselors/${id}?tab=qna` },
  ]

  return (
    <div className="flex">
      {tabs.map((t) => {
        const active = t.key === activeTab
        return (
          <Link
            key={t.key}
            to={t.to}
            replace
            className={`flex-1 h-[44px] flex items-center justify-center text-[14px] font-medium ${
              active ? 'text-[#f472b6]' : 'text-[#6A7282] border-b border-[#E5E7EB]'
            }`}
            style={active ? { boxShadow: 'inset 0 -2px 0 0 #f472b6' } : undefined}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}

/* ───────────── 하단 고정 CTA ───────────── */

function BottomFixedBar({
  liked,
  onLikeToggle,
  onPhoneClick,
  onChatClick,
}: {
  liked: boolean
  onLikeToggle: () => void
  onPhoneClick: () => void
  onChatClick: () => void
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 px-4 py-3 backdrop-blur-[7px]"
      style={{
        background: 'rgba(255, 255, 255, 0.8)',
        margin: '0 auto',
        maxWidth: 600,
      }}
    >
      <button
        type="button"
        onClick={onLikeToggle}
        aria-label={liked ? '단골 등록 취소' : '단골 등록'}
        className="w-10 h-10 rounded-full bg-white border border-[#F9FAFB] flex items-center justify-center shrink-0 outline-none focus:outline-none focus-visible:outline-none"
      >
        <img
          src={liked ? '/img/like_btn_icon_on.svg' : '/img/like_btn_icon_off.svg'}
          alt=""
          className="w-5 h-5"
        />
      </button>
      <button
        type="button"
        onClick={onPhoneClick}
        className="flex-1 h-10 rounded-full bg-[#f472b6] flex items-center justify-center gap-1 text-white text-[14px] font-medium"
      >
        <img src="/img/ic_phone_solid_w.svg" alt="" className="w-4 h-4" />
        전화상담
      </button>
      <button
        type="button"
        onClick={onChatClick}
        className="flex-1 h-10 rounded-full bg-[#f472b6] flex items-center justify-center gap-1 text-white text-[14px] font-medium"
      >
        <img src="/img/ic_message_circle_solid_w.svg" alt="" className="w-4 h-4" />
        채팅상담
      </button>
    </div>
  )
}
