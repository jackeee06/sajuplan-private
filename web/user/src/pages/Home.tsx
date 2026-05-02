import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import CounselorCard, { Counselor } from '../components/CounselorCard'

const BANNER_SLIDES = [
  { src: '/img/banner_sample.jpg', to: '/today-fortune' },
  { src: '/img/banner_sample.jpg', to: '/today-fortune' },
]

type MainTab = 'all' | 'popular' | 'chat' | 'review'
type ChipTab = '전체' | '사주' | '타로' | '신점'

// 더미 데이터 — 백엔드 연동 시 API 결과로 교체
const MOCK_COUNSELORS: Counselor[] = [
  {
    id: 1,
    name: '강타로',
    code: '335912',
    badge: '타로',
    tagline: '상대방의 진심이 궁금하다면?',
    pricePerSec: 1200,
    phoneState: 'available',
    chatState: 'available',
    hashtags: ['연애궁합운', '재회'],
    rating: 4.9,
    reviewCount: 326,
    liked: false,
    imgUrl: '/img/sample_img01.jpg',
  },
  {
    id: 2,
    name: '김선녀',
    code: '224587',
    badge: '신점',
    tagline: '마음을 읽는 신점',
    pricePerSec: 1500,
    phoneState: 'available',
    chatState: 'busy',
    hashtags: ['삼재상담', '연애운'],
    rating: 4.8,
    reviewCount: 218,
    liked: false,
    imgUrl: '/img/sample_img02.jpg',
  },
  {
    id: 3,
    name: '사주선녀',
    code: '165791',
    badge: '사주',
    tagline: '속 시원하게 풀어드립니다',
    pricePerSec: 1000,
    phoneState: 'available',
    chatState: 'busy',
    hashtags: ['신년운세', '금전운'],
    rating: 4.7,
    reviewCount: 106,
    liked: false,
    imgUrl: '/img/sample_img03.jpg',
  },
  {
    id: 4,
    name: '신비',
    code: '063143',
    badge: '타로',
    tagline: '깊고 정확한 타로 상담',
    pricePerSec: 1500,
    phoneState: 'offline',
    chatState: 'offline',
    hashtags: ['타로', '연애운'],
    rating: 4.6,
    reviewCount: 78,
    liked: false,
    imgUrl: '/img/sample_img04.jpg',
  },
]

const CHIPS: ChipTab[] = ['전체', '사주', '타로', '신점']

/**
 * 홈(메인) — Figma 1:1269 (02홈_메인)
 * 첫 진입 페이지. URL: /
 *
 * 구조:
 *  - 헤더 (로고 + 검색/알림)
 *  - 배너 (오늘의 운세, 1/10 페이지네이션)
 *  - 통계 카드 2개 (최근 상담 건수 / 현재 접속중인 상담사)
 *  - 큰 탭 (전체/인기/채팅/후기)
 *  - 칩 탭 (전체/사주/타로/신점)
 *  - 상담사 카드 리스트
 *  - 푸터 (사업자 정보)
 *  - BottomNav
 */
export default function Home() {
  const [tab, setTab] = useState<MainTab>('all')
  const [chip, setChip] = useState<ChipTab>('전체')
  const [counselors, setCounselors] = useState(MOCK_COUNSELORS)

  const onLikeToggle = (id: Counselor['id']) =>
    setCounselors((prev) =>
      prev.map((c) => (c.id === id ? { ...c, liked: !c.liked } : c)),
    )

  const filtered =
    chip === '전체' ? counselors : counselors.filter((c) => c.badge === chip)

  return (
    <div className="mobile-frame flex flex-col pb-[100px]">
      {/* 헤더 — Figma 1:460 (390×60, padding 0 16, blur 7px) */}
      <header className="h-[60px] px-4 flex items-center justify-between sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <Link to="/" aria-label="사주문 홈" className="flex items-center">
          <img src="/img/logo_b.svg" alt="사주문" className="h-9 w-auto" />
        </Link>
        {/* 검색/알림 — 컨테이너 40×40 + 아이콘 28px, gap 12px */}
        <div className="flex items-center gap-3">
          <Link to="/search" aria-label="검색" className="w-10 h-10 flex items-center justify-center">
            <img src="/img/ic_hd_search.svg" alt="" className="w-7 h-7" />
          </Link>
          <Link to="/notifications" aria-label="알림" className="w-10 h-10 flex items-center justify-center">
            <img src="/img/ic_hd_push.svg" alt="" className="w-7 h-7" />
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* 배너 — Figma 1:1270 (358×260, radius 24, IMAGE) — 슬라이드 캐러셀 */}
        <section className="px-4 pt-2">
          <BannerSlider />
        </section>

        {/* 통계 카드 — Figma 1:1272 Frame 504 (358 width, padding 16 0, gap 12) */}
        <section className="px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon="/img/main_icon01.svg"
              label="최근 상담 건수"
              value="2,570,923"
              suffix="건"
            />
            <StatCard
              icon="/img/main_icon02.svg"
              label="현재 접속중인 상담사"
              value="241"
              suffix="명"
            />
          </div>
        </section>

        {/* 1단 큰 탭 — Figma main_tab01 (gap 24, padding 16 16 12, 20/600 Inter) */}
        <section className="sticky top-[60px] bg-white z-10">
          <div className="flex gap-6 pt-4 px-4 pb-3">
            <TabBtn active={tab === 'all'} onClick={() => setTab('all')}>전체</TabBtn>
            <TabBtn active={tab === 'popular'} onClick={() => setTab('popular')}>인기</TabBtn>
            <TabBtn active={tab === 'chat'} onClick={() => setTab('chat')}>채팅</TabBtn>
            <TabBtn active={tab === 'review'} onClick={() => setTab('review')}>후기</TabBtn>
          </div>
        </section>

        {/* 2단 칩 탭 — Figma main_tab02 (bg #F9FAFB, padding 8 16, gap 8) */}
        <section className="bg-[#F9FAFB] px-4 py-2">
          <div className="flex gap-2">
            {CHIPS.map((c) => (
              <ChipBtn key={c} active={chip === c} onClick={() => setChip(c)}>
                {c}
              </ChipBtn>
            ))}
          </div>
        </section>

        {/* 카드 리스트 */}
        <section className="px-4 py-3 flex flex-col gap-3">
          {filtered.map((c) => (
            <CounselorCard key={c.id} counselor={c} onLikeToggle={onLikeToggle} />
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-[13px] text-[#99A1AF] py-10">
              해당 카테고리의 상담사가 없습니다.
            </p>
          )}
        </section>

        {/* 상담사 더보기 */}
        <div className="flex justify-center pt-2 pb-4">
          <Link
            to="/counselors"
            className="inline-flex items-center gap-1 h-10 px-5 rounded-full border border-[#E5E7EB] bg-white text-[14px] text-[#364153] font-medium"
          >
            상담사 더보기
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-[#364153]">
              <path d="M5.7 3.3a1 1 0 0 0 0 1.4L9 8l-3.3 3.3a1 1 0 0 0 1.4 1.4l4-4a1 1 0 0 0 0-1.4l-4-4a1 1 0 0 0-1.4 0z" />
            </svg>
          </Link>
        </div>

        {/* 푸터 — Figma 118:7126 (사업자 정보=열림) */}
        <Footer />
      </main>

      {/* Floating 버튼 (84:6769): 위로가기 + 카카오 채팅 */}
      <FloatingButtons />

      <BottomNav />
    </div>
  )
}

/* ───────────── 서브 컴포넌트 ───────────── */

/**
 * 배너 슬라이더 — Figma 1:1270 (358×260, radius 24)
 *  - 자동 슬라이드 4초
 *  - 터치 스와이프 지원
 *  - 우하단 페이지네이션 "current / total"
 */
function BannerSlider() {
  const [idx, setIdx] = useState(0)
  const total = BANNER_SLIDES.length
  const startXRef = useRef<number | null>(null)
  const draggingRef = useRef(false)
  const pausedRef = useRef(false)
  const SWIPE_THRESHOLD = 40

  useEffect(() => {
    const t = setInterval(() => {
      if (!pausedRef.current) setIdx((i) => (i + 1) % total)
    }, 4000)
    return () => clearInterval(t)
  }, [total])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    startXRef.current = e.clientX
    draggingRef.current = false
    pausedRef.current = true
    ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (startXRef.current == null) return
    if (Math.abs(e.clientX - startXRef.current) > 6) draggingRef.current = true
  }
  const finishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (startXRef.current == null) return
    const dx = e.clientX - startXRef.current
    if (dx > SWIPE_THRESHOLD) setIdx((i) => (i - 1 + total) % total)
    else if (dx < -SWIPE_THRESHOLD) setIdx((i) => (i + 1) % total)
    startXRef.current = null
    pausedRef.current = false
  }
  const onClickCapture = (e: React.MouseEvent) => {
    if (draggingRef.current) {
      e.preventDefault()
      e.stopPropagation()
      draggingRef.current = false
    }
  }

  return (
    <div
      className="relative rounded-[24px] overflow-hidden aspect-[358/260] bg-[#3D2078] cursor-grab active:cursor-grabbing select-none touch-pan-y"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onClickCapture={onClickCapture}
    >
      <div
        className="flex w-full h-full transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${idx * 100}%)` }}
      >
        {BANNER_SLIDES.map((s, i) => (
          <Link
            key={i}
            to={s.to}
            className="w-full h-full shrink-0 block"
            aria-label={`배너 ${i + 1}`}
            draggable={false}
          >
            <img
              src={s.src}
              alt=""
              className="w-full h-full object-cover pointer-events-none"
              draggable={false}
            />
          </Link>
        ))}
      </div>
      {/* 페이지네이션 — Figma 1:706 (px 8 py 5, bg rgba(0,0,0,0.6), 12/500 white) */}
      <div className="absolute bottom-[17px] right-[12px] flex items-center gap-1 bg-black/60 rounded-full px-2 py-[5px] pointer-events-none">
        <span className="text-[12px] leading-[1.1] text-white font-medium">{idx + 1}</span>
        <span className="text-[12px] leading-[1.1] text-white font-medium">/</span>
        <span className="text-[12px] leading-[1.1] text-white font-medium">{total}</span>
      </div>
    </div>
  )
}

/**
 * 통계 카드 — Figma 1:1273/1:1276 (Frame 427/428)
 *  layout column, gap 8, padding 16, border #8259F5 1px, radius 16
 *  icon 24×24 + (label 15/400 #1E2939, value 18/600 #8259F5, gap 4)
 */
function StatCard({
  icon,
  label,
  value,
  suffix,
}: {
  icon: string
  label: string
  value: string
  suffix?: string
}) {
  return (
    <div className="rounded-2xl border border-[#8259F5] p-4 flex flex-col gap-2">
      <img src={icon} alt="" className="w-6 h-6" />
      <div className="flex flex-col gap-1">
        <p className="text-[15px] leading-[130%] text-[#1E2939]">{label}</p>
        <p className="text-[18px] leading-[130%] font-semibold text-[#8259F5]">
          {value}
          {suffix && <span>{suffix}</span>}
        </p>
      </div>
    </div>
  )
}

/** 큰 탭 — Figma main_tab01 (20/600/120% Inter, 활성 #8259F5 + 밑줄, 비활성 #6A7282) */
function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative pb-3 text-[20px] leading-[120%] font-semibold transition ${
        active ? 'text-[#8259F5]' : 'text-[#6A7282]'
      }`}
    >
      {children}
      {active && <span className="absolute left-0 right-0 -bottom-[1px] h-[2px] bg-[#8259F5] rounded-full" />}
    </button>
  )
}

/**
 * 푸터 — Figma 118:7126 (사업자 정보=열림)
 *  padding 28 16 56, gap 20 column, top border 1px #F3F4F6
 *  - 헤더: "사주문 사업자 정보" 15/600 #364153 + 화살표 ▲
 *  - 항목: row gap 16 (라벨 14/500 #6A7282, 값 14/400 #6A7282)
 *  - 하단: 이용약관·개인정보취급방침(14/500 #364153) + Copyright(14/400 #6A7282)
 */
function Footer() {
  const items: [string, string][] = [
    ['대표', '홍루연'],
    ['주소', '서울특별시 강남구 언주로87길 6 mh빌딩 503호'],
    ['사업자등록번호', '816-87-03567'],
    ['대표전화', '010-8702-9996'],
    ['이메일', 'Originhouse9@gmail.com'],
    ['제휴 및 상담사 채용 문의', 'Originhouse9@gmail.com'],
  ]
  return (
    <footer className="border-t border-[#F3F4F6] pt-7 px-4 pb-14 flex flex-col gap-5">
      <div className="flex flex-col gap-3 pb-5 border-b border-[#F3F4F6]">
        <button type="button" className="flex items-center gap-1 text-[15px] font-semibold text-[#364153] leading-[110%]">
          사주문 사업자 정보
          <svg viewBox="0 0 20 20" className="w-5 h-5 fill-[#364153]">
            <path d="M5 12.5L10 7.5L15 12.5L14 13.5L10 9.5L6 13.5Z" />
          </svg>
        </button>
        <div className="flex flex-col gap-2">
          {items.map(([k, v]) => (
            <div key={k} className="flex items-start gap-4">
              <span className="text-[14px] font-semibold text-[#1F2937] leading-[120%] shrink-0 min-w-[110px]">
                {k}
              </span>
              <span className="text-[14px] font-normal text-[#6A7282] leading-[120%] flex-1 break-keep">
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <a href="#" className="text-[14px] font-medium text-[#364153] leading-[110%]">
            이용약관
          </a>
          <a href="#" className="text-[14px] font-medium text-[#364153] leading-[110%]">
            개인정보취급방침
          </a>
        </div>
        <p className="text-[14px] text-[#6A7282] leading-[110%]">
          Copyrightⓒ 사주문. All Rights Reserved.
        </p>
      </div>
    </footer>
  )
}

/**
 * Floating 버튼 — Figma 84:6769 (Frame 1410129514, w 50, gap 8)
 *  - go_top_btn: 50×50, bg rgba(243,244,246,0.8), border #F9FAFB, blur 6, ↑(검정)
 *  - kakao_btn: 50×50, bg #8259F5, 보라 그림자, 카카오 아이콘(흰)
 *  화면 우측 하단(BottomNav 위)에 floating
 */
function FloatingButtons() {
  const onGoTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })
  return (
    <div className="fixed right-4 bottom-[100px] flex flex-col gap-2 z-40">
      <button
        type="button"
        onClick={onGoTop}
        aria-label="위로 가기"
        className="w-[50px] h-[50px] rounded-full border border-[#F9FAFB] backdrop-blur-[6px] flex items-center justify-center"
        style={{ background: 'rgba(243, 244, 246, 0.8)' }}
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#030712" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19V5" />
          <path d="M5 12l7-7 7 7" />
        </svg>
      </button>
      <a
        href="https://pf.kakao.com/"
        target="_blank"
        rel="noreferrer"
        aria-label="카카오톡 문의"
        className="w-[50px] h-[50px] rounded-full bg-[#8259F5] flex items-center justify-center"
        style={{ boxShadow: '0 4px 6px -2px rgba(130,89,245,0.1), 0 10px 15px -3px rgba(130,89,245,0.15)' }}
      >
        <svg viewBox="0 0 20 20" className="w-5 h-5 fill-white">
          <path d="M10 2C5.6 2 2 4.8 2 8.2c0 2.2 1.5 4.1 3.7 5.2-.2.6-.7 2.4-.8 2.8 0 .1 0 .2.1.3.1 0 .2 0 .3 0 .2-.1 2.4-1.6 2.9-1.9.6.1 1.2.2 1.8.2 4.4 0 8-2.8 8-6.2C18 4.8 14.4 2 10 2z" />
        </svg>
      </a>
    </div>
  )
}

/** 칩 탭 — Figma main_tab02 (padding 10 16, radius 9999, 14/500/lh20 Inter)
 *  활성: bg #F3EEFE / text #8259F5  ·  비활성: bg 투명 / text #99A1AF */
function ChipBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-[10px] rounded-full text-[14px] leading-5 font-medium transition ${
        active
          ? 'bg-[#F3EEFE] text-[#8259F5]'
          : 'bg-transparent text-[#99A1AF] hover:bg-white/60'
      }`}
    >
      {children}
    </button>
  )
}

