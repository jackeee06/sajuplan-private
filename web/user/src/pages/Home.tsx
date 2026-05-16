import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus'
import BottomNav from '../components/BottomNav'
import CounselorCard from '../components/CounselorCard'
import ReviewCardMain from '../components/ReviewCardMain'
import UploadedImage from '../components/UploadedImage'
import { FILE_BASE } from '../lib/runtime-env'
import {
  authApi,
  bannersApi,
  PublicBanner,
  statsApi,
  settingsApi,
  PublicSettings,
  counselorsApi,
  PublicCounselor,
  reviewsApi,
  PublicRecentReview,
  eventCounselorsApi,
  PublicEventCounselor,
} from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { mapPublicCounselorToCard } from '../lib/counselor-mapper'
import { openExternalUrl } from '../lib/native-bridge'

type MainTab = 'all' | 'popular' | 'new' | 'chat' | 'review'
type ChipTab = '전체' | '사주' | '타로' | '신점'

const CHIPS: ChipTab[] = ['전체', '사주', '타로', '신점']

// 카드 매핑 + state 도출은 src/lib/counselor-mapper.ts 에 통합. 모든 리스트 페이지가 같은 헬퍼 사용.

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
  const { isLoggedIn, member } = useAuth()
  const [tab, setTab] = useState<MainTab>('all')
  const [chip, setChip] = useState<ChipTab>('전체')
  const [counselors, setCounselors] = useState<PublicCounselor[]>([])
  const [reviews, setReviews] = useState<PublicRecentReview[]>([])
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  // 메인 통계 — 어드민 dashboard 와 같은 데이터 소스 (consultation, member)
  const [stats, setStats] = useState<{ recent: number; online: number }>({
    recent: 0,
    online: 0,
  })
  // 홈탭 재클릭/포커스 복귀 시 fetch useEffect 들을 재실행하기 위한 카운터.
  // useRefreshOnFocus 가 호출되면 +1 → stats/list/banner 등 모든 fetch 가 갱신됨.
  const [refreshKey, setRefreshKey] = useState(0)
  useRefreshOnFocus(() => setRefreshKey((k) => k + 1))

  // 메인페이지 진입 시(앱 켤 때마다) 사주문 → m2net 잔액 동기화.
  // 일반 회원만 대상. 백엔드가 role 검증해서 상담사면 ok=false 로 무시.
  useEffect(() => {
    if (!isLoggedIn || member?.role !== 'user') return
    void authApi.syncM2netBalance().catch(() => {
      /* 동기화 실패는 회원에게 노출 안 함 — 운영 로그에만 남김 */
    })
  }, [isLoggedIn, member?.role])

  useEffect(() => {
    let alive = true
    statsApi.main().then(
      (r) => {
        if (alive) {
          setStats({
            recent: r.recent_consultations,
            online: r.online_counselors,
          })
        }
      },
      () => {
        // 실패 시 0 유지
      },
    )
    return () => {
      alive = false
    }
  }, [refreshKey])

  // 탭/칩 변경 시 백엔드 재호출 — review 탭은 후기 API, 그 외는 상담사 API
  useEffect(() => {
    let alive = true
    setLoading(true)
    setListError(null)
    const category = chip === '전체' ? undefined : chip

    if (tab === 'review') {
      reviewsApi
        .recent({ category, limit: 13 })
        .then((r) => {
          if (alive) {
            setReviews(r.items)
            setCounselors([])
          }
        })
        .catch((e) => {
          if (alive) setListError(e instanceof Error ? e.message : '후기를 불러오지 못했습니다.')
        })
        .finally(() => {
          if (alive) setLoading(false)
        })
    } else {
      counselorsApi
        .list({ tab, category, limit: 13 })
        .then((r) => {
          if (alive) {
            setCounselors(r.items)
            setReviews([])
          }
        })
        .catch((e) => {
          if (alive) setListError(e instanceof Error ? e.message : '상담사를 불러오지 못했습니다.')
        })
        .finally(() => {
          if (alive) setLoading(false)
        })
    }
    return () => {
      alive = false
    }
  }, [tab, chip, refreshKey])

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

        {/* 통계 카드 — 한 줄 압축형: 아이콘+라벨(좌) / 값(우) */}
        <section className="px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon="/img/main_icon01.svg"
              label="최근 상담 건수"
              value={stats.recent.toLocaleString()}
              suffix="건"
            />
            <StatCard
              icon="/img/main_icon02.svg"
              label="현재 접속중인 상담사"
              value={stats.online.toLocaleString()}
              suffix="명"
            />
          </div>
        </section>

        {/* 1단 큰 탭 — Figma main_tab01 (gap 24, padding 16 16 12, 20/600 Inter) */}
        <section className="sticky top-[60px] bg-white z-10">
          <div className="flex gap-6 pt-4 px-4 pb-3">
            <TabBtn active={tab === 'all'} onClick={() => setTab('all')}>전체</TabBtn>
            <TabBtn active={tab === 'popular'} onClick={() => setTab('popular')}>인기</TabBtn>
            <TabBtn active={tab === 'new'} onClick={() => setTab('new')}>신규</TabBtn>
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

        {/* 카드 리스트 — 탭에 따라 상담사 / 후기 분기 */}
        <section className={tab === 'review' ? 'flex flex-col' : 'px-4 py-3 flex flex-col gap-3'}>
          {loading && <ListSkeleton kind={tab === 'review' ? 'review' : 'counselor'} />}
          {!loading && listError && (
            <p className="text-center text-[13px] text-[#FF6467] py-10">{listError}</p>
          )}
          {!loading && !listError && tab === 'review' && (
            reviews.length > 0 ? (
              reviews.map((r) => <ReviewCardMain key={r.id} review={r} />)
            ) : (
              <p className="text-center text-[13px] text-[#99A1AF] py-10">
                아직 등록된 후기가 없습니다.
              </p>
            )
          )}
          {!loading && !listError && tab !== 'review' && (
            counselors.length > 0 ? (
              counselors.map((c) => (
                <CounselorCard key={c.id} counselor={mapPublicCounselorToCard(c)} />
              ))
            ) : (
              <p className="text-center text-[13px] text-[#99A1AF] py-10">
                해당 카테고리의 상담사가 없습니다.
              </p>
            )
          )}
        </section>

        {/* 더보기 — 탭별 이동 (후기는 /reviews, 그 외는 /counselors) */}
        {!loading && (
          <div className="flex justify-center pt-2 pb-4">
            <Link
              to={tab === 'review' ? '/reviews' : '/counselors'}
              className="inline-flex items-center gap-1 h-10 px-5 rounded-full border border-[#E5E7EB] bg-white text-[14px] text-[#364153] font-medium"
            >
              {tab === 'review' ? '후기 더보기' : '상담사 더보기'}
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-[#364153]">
                <path d="M5.7 3.3a1 1 0 0 0 0 1.4L9 8l-3.3 3.3a1 1 0 0 0 1.4 1.4l4-4a1 1 0 0 0 0-1.4l-4-4a1 1 0 0 0-1.4 0z" />
              </svg>
            </Link>
          </div>
        )}

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
/** 이벤트 상담사 자동 카드 슬라이드 (배너 이미지 없을 때).
 *  와이드 사진 우선 사용 (CounselorDetail hero 와 동일 톤). 와이드 없으면 프로필 사진 fallback.
 *  운영자가 wide_headline/wide_subcaption 입력했으면 그 캡션을 우선 노출, 없으면 nickname + 단가 자동 카피.
 */
/** API 에서 받은 상대 경로 (/uploads/...) 를 절대 URL 로 변환. 절대 URL/외부 URL 은 그대로 통과. */
function resolveEventImg(u: string | null): string | null {
  if (!u) return null
  if (/^https?:\/\//.test(u)) return u
  if (u.startsWith('/')) return `${FILE_BASE}${u}`
  return u
}

function EventCounselorSlide({ c, onClick }: { c: PublicEventCounselor; onClick: () => void }) {
  const img = resolveEventImg(c.hero_image ?? c.profile_image)
  const imgWebp = resolveEventImg(c.hero_image_webp ?? c.profile_image_webp)
  const headline = c.wide_headline?.trim() || c.nickname
  const subcaption =
    c.wide_subcaption?.trim() ||
    (c.unit_cost ? `${c.unit_seconds ?? 30}초당 ${c.unit_cost.toLocaleString()}원` : '')
  return (
    <div
      className="w-full h-full shrink-0 relative cursor-pointer select-none"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-label={`이벤트 상담사 ${c.nickname}`}
    >
      {img ? (
        <picture className="absolute inset-0">
          {imgWebp && <source srcSet={imgWebp} type="image/webp" />}
          <img src={img} alt="" className="w-full h-full object-cover object-center" draggable={false} />
        </picture>
      ) : (
        <div className="absolute inset-0 bg-[#3D2078]" />
      )}
      {/* 좌측 가독성 그라데이션 */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
      {/* 하단 텍스트 가독성 그라데이션 */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-black/70" />
      {/* 이벤트 뱃지 */}
      <div className="absolute top-4 left-4 px-2 py-1 rounded-full bg-[#9B7AF7] text-white text-[11px] font-semibold leading-none">
        이벤트 상담사
      </div>
      {/* 헤드라인 — 세로 중앙·가로 좌측, 글자 2배(40px) */}
      <p className="absolute left-4 right-4 top-1/2 -translate-y-1/2 text-white text-[40px] font-bold leading-tight drop-shadow line-clamp-1">{headline}</p>
      {/* 서브카피 — 세로 75% (중앙↔하단의 중간)·가로 좌측, 글자 2배(26px) */}
      {subcaption && (
        <p className="absolute left-4 right-4 top-[75%] -translate-y-1/2 text-white/85 text-[26px] leading-tight line-clamp-1">{subcaption}</p>
      )}
    </div>
  )
}

type SlideItem =
  | { kind: 'banner'; data: PublicBanner }
  | { kind: 'event'; data: PublicEventCounselor }

function BannerSlider() {
  const navigate = useNavigate()
  const [banners, setBanners] = useState<PublicBanner[]>([])
  const [eventCounselors, setEventCounselors] = useState<PublicEventCounselor[]>([])
  const slides: SlideItem[] = [
    ...banners.map((b): SlideItem => ({ kind: 'banner', data: b })),
    ...eventCounselors.map((c): SlideItem => ({ kind: 'event', data: c })),
  ]
  const [idx, setIdx] = useState(0)
  const total = slides.length
  const startXRef = useRef<number | null>(null)
  const draggingRef = useRef(false)
  const SWIPE_THRESHOLD = 40

  // 어드민에 등록된 '메인-상단배너' 위치의 활성 배너 가져오기
  useEffect(() => {
    let alive = true
    bannersApi.listByPosition('메인-상단배너').then(
      (r) => { if (alive) setBanners(r.items) },
      () => {},
    )
    return () => { alive = false }
  }, [])

  // 현재 활성 이벤트 상담사 (최대 3명)
  useEffect(() => {
    let alive = true
    eventCounselorsApi.list().then(
      (r) => { if (alive) setEventCounselors(r.items) },
      () => {},
    )
    return () => { alive = false }
  }, [])

  // 자동 슬라이드 — 4초마다 다음 배너 (% total 로 무한 루프 보장)
  useEffect(() => {
    if (total <= 1) return
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % total)
    }, 4000)
    return () => clearInterval(t)
  }, [total])

  // 사용자가 빠르게 슬라이드 한 후엔 idx 가 banners 범위 벗어날 수 있으니 안전하게 클램프
  useEffect(() => {
    if (total > 0 && idx >= total) setIdx(0)
  }, [idx, total])

  // 드래그 — setPointerCapture 안 씀(일부 브라우저에서 release 미보장).
  // 단순 down/move/up 으로 작동.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    startXRef.current = e.clientX
    draggingRef.current = false
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
  }
  // 박스 밖으로 마우스 나가면 드래그 상태 리셋
  const onPointerLeave = () => {
    startXRef.current = null
  }
  const onClickCapture = (e: React.MouseEvent) => {
    if (draggingRef.current) {
      e.preventDefault()
      e.stopPropagation()
      draggingRef.current = false
    }
  }

  // 배너+이벤트 모두 없으면 빈 영역 미노출
  if (total === 0) return null

  return (
    <div
      className="relative rounded-[24px] overflow-hidden aspect-[358/260] bg-[#3D2078] cursor-grab active:cursor-grabbing select-none touch-pan-y"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onPointerLeave={onPointerLeave}
      onClickCapture={onClickCapture}
    >
      <div
        className="flex w-full h-full transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${idx * 100}%)` }}
      >
        {slides.map((slide, i) => {
          if (slide.kind === 'event') {
            const c = slide.data
            // 커스텀 배너 이미지가 있으면 일반 배너처럼 이미지 렌더, 없으면 자동 카드
            if (c.event_banner_image_url) {
              return (
                <Link key={`ev-${c.id}`} to={`/counselors/${c.id}`} className="w-full h-full shrink-0 block" draggable={false}>
                  <UploadedImage src={c.event_banner_image_url} srcWebp={null} alt={c.nickname} className="w-full h-full object-cover pointer-events-none" draggable={false} />
                </Link>
              )
            }
            return <EventCounselorSlide key={`ev-${c.id}`} c={c} onClick={() => navigate(`/counselors/${c.id}`)} />
          }

          const b = slide.data
          const img = (
            <UploadedImage
              src={b.image_url}
              srcWebp={b.image_url_webp}
              alt={b.title ?? ''}
              className="w-full h-full object-cover pointer-events-none"
              draggable={false}
            />
          )
          if (!b.link_url) {
            return (
              <div key={b.id} className="w-full h-full shrink-0 block" aria-label={`배너 ${i + 1}`}>
                {img}
              </div>
            )
          }
          if (/^https?:\/\//.test(b.link_url)) {
            return (
              <a key={b.id} href={b.link_url} target="_blank" rel="noopener noreferrer" className="w-full h-full shrink-0 block" aria-label={`배너 ${i + 1}`} draggable={false}>
                {img}
              </a>
            )
          }
          return (
            <Link key={b.id} to={b.link_url} className="w-full h-full shrink-0 block" aria-label={`배너 ${i + 1}`} draggable={false}>
              {img}
            </Link>
          )
        })}
      </div>
      {/* 페이지네이션 — 배너 2개 이상일 때만 노출 */}
      {total > 1 && (
        <div className="absolute bottom-[17px] right-[12px] flex items-center gap-1 bg-black/60 rounded-full px-2 py-[5px] pointer-events-none">
          <span className="text-[12px] leading-[1.1] text-white font-medium">{idx + 1}</span>
          <span className="text-[12px] leading-[1.1] text-white font-medium">/</span>
          <span className="text-[12px] leading-[1.1] text-white font-medium">{total}</span>
        </div>
      )}
    </div>
  )
}

/**
 * 통계 카드 — 한 줄 압축형: 아이콘+라벨(좌) / 값(우) 한 줄 배치
 *  border #8259F5 1px, radius 16, padding 12
 *  icon 20×20 + label 13/400 #1E2939, value 18/700 #8259F5
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
    <div className="rounded-2xl border border-[#8259F5] px-3 py-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <img src={icon} alt="" className="w-5 h-5 shrink-0" />
        <p className="text-[13px] leading-[130%] text-[#1E2939] truncate">{label}</p>
      </div>
      <p className="text-[18px] leading-[120%] font-bold text-[#8259F5] shrink-0">
        {value}
        {suffix && <span className="text-[12px] font-semibold ml-0.5">{suffix}</span>}
      </p>
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
  const [s, setS] = useState<PublicSettings>({})

  useEffect(() => {
    let alive = true
    settingsApi.public().then(
      (r) => {
        if (alive) setS(r)
      },
      () => {
        // 실패 시 빈 값 — 푸터 비어 보임
      },
    )
    return () => {
      alive = false
    }
  }, [])

  // [라벨, 값] — 값이 빈 문자열이면 행 생략
  const items: [string, string][] = (
    [
      ['상호명', s['footer.business_name'] ?? ''],
      ['대표', s['footer.ceo'] ?? ''],
      ['주소', s['footer.address'] ?? ''],
      ['사업자등록번호', s['footer.business_no'] ?? ''],
      ['통신판매업신고번호', s['footer.ecommerce_no'] ?? ''],
      ['대표전화', s['footer.phone'] ?? ''],
      ['팩스', s['footer.fax'] ?? ''],
      ['이메일', s['footer.email'] ?? ''],
      ['운영시간', s['footer.business_hours'] ?? ''],
      ['개인정보보호책임자', s['footer.privacy_officer'] ?? ''],
    ] as [string, string][]
  ).filter(([, v]) => v.trim() !== '')

  const companyName = s['footer.company_name'] || '사주문'
  const copyright =
    s['footer.copyright'] || `Copyrightⓒ ${companyName}. All Rights Reserved.`
  const kakaoUrl = s['site.kakao_channel_url'] || ''
  const extraInfo = s['footer.extra_info'] || ''

  return (
    <footer className="border-t border-[#F3F4F6] pt-7 px-4 pb-14 flex flex-col gap-5">
      <div className="flex flex-col gap-3 pb-5 border-b border-[#F3F4F6]">
        <button type="button" className="flex items-center gap-1 text-[15px] font-semibold text-[#364153] leading-[110%]">
          {companyName} 사업자 정보
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
        {extraInfo && (
          <p className="text-[13px] text-[#99A1AF] leading-[150%] whitespace-pre-line mt-1">
            {extraInfo}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <a href="#" className="text-[14px] font-medium text-[#364153] leading-[110%]">
            이용약관
          </a>
          <a href="#" className="text-[14px] font-medium text-[#364153] leading-[110%]">
            개인정보취급방침
          </a>
          {kakaoUrl && (
            <a
              href={kakaoUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                // 네이티브 앱에선 외부 브라우저/카카오 앱으로 위임,
                // 일반 웹은 새 탭. WebView 안에서 그냥 open 하면 카카오가
                // 내부 네비로 열려 사용자가 앱 밖으로 나가지 못함.
                e.preventDefault()
                openExternalUrl(kakaoUrl)
              }}
              className="text-[14px] font-medium text-[#FEE500] bg-[#3C1E1E] px-3 py-1 rounded-full leading-[110%] cursor-pointer"
            >
              카카오 1:1 상담
            </a>
          )}
        </div>
        <p className="text-[14px] text-[#6A7282] leading-[110%]">{copyright}</p>
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
  const [kakaoUrl, setKakaoUrl] = useState<string>('')
  const onGoTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  // 어드민 site.kakao_channel_url 동적 로드 (운영팀이 어드민에서 변경 가능)
  useEffect(() => {
    let alive = true
    settingsApi.public().then(
      (r) => {
        if (alive) setKakaoUrl(r['site.kakao_channel_url'] || '')
      },
      () => {
        // 실패 시 기본 URL fallback (sample 라이브 채널)
        if (alive) setKakaoUrl('https://pf.kakao.com/_gLTVX')
      },
    )
    return () => {
      alive = false
    }
  }, [])

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
      {kakaoUrl && (
        <a
          href={kakaoUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="카카오톡 문의"
          onClick={(e) => {
            e.preventDefault()
            openExternalUrl(kakaoUrl)
          }}
          className="w-[50px] h-[50px] rounded-full bg-[#8259F5] flex items-center justify-center cursor-pointer"
          style={{ boxShadow: '0 4px 6px -2px rgba(130,89,245,0.1), 0 10px 15px -3px rgba(130,89,245,0.15)' }}
        >
          <svg viewBox="0 0 20 20" className="w-5 h-5 fill-white">
            <path d="M10 2C5.6 2 2 4.8 2 8.2c0 2.2 1.5 4.1 3.7 5.2-.2.6-.7 2.4-.8 2.8 0 .1 0 .2.1.3.1 0 .2 0 .3 0 .2-.1 2.4-1.6 2.9-1.9.6.1 1.2.2 1.8.2 4.4 0 8-2.8 8-6.2C18 4.8 14.4 2 10 2z" />
          </svg>
        </a>
      )}
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

/**
 * 리스트 로딩 스켈레톤 — 카드 자리 3개를 회색 박스로 노출.
 * counselor: 100×100 이미지 + 우측 텍스트 라인 — 카드 1개 = 약 200px 높이
 * review: 48 원형 + 텍스트 라인 — 카드 1개 = 약 130px 높이
 */
function ListSkeleton({ kind }: { kind: 'counselor' | 'review' }) {
  const items = [0, 1, 2]
  if (kind === 'review') {
    return (
      <>
        {items.map((i) => (
          <div key={i} className="px-4 py-4 flex flex-col gap-3 border-b border-[#F3F4F6]">
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-[#F3F4F6] animate-pulse" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="h-4 w-1/2 rounded bg-[#F3F4F6] animate-pulse" />
                <div className="h-3 w-1/3 rounded bg-[#F3F4F6] animate-pulse" />
              </div>
            </div>
            <div className="h-4 w-2/3 rounded bg-[#F3F4F6] animate-pulse" />
            <div className="h-3 w-full rounded bg-[#F3F4F6] animate-pulse" />
          </div>
        ))}
      </>
    )
  }
  return (
    <>
      {items.map((i) => (
        <div key={i} className="bg-white border-b border-[#F3F4F6] p-4 flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="w-[100px] h-[100px] rounded-2xl bg-[#F3F4F6] animate-pulse shrink-0" />
            <div className="flex-1 flex flex-col gap-2 pt-1">
              <div className="h-4 w-1/2 rounded bg-[#F3F4F6] animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-[#F3F4F6] animate-pulse" />
              <div className="h-3 w-1/3 rounded bg-[#F3F4F6] animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-10 rounded-full bg-[#F3F4F6] animate-pulse" />
            <div className="h-10 rounded-full bg-[#F3F4F6] animate-pulse" />
          </div>
        </div>
      ))}
    </>
  )
}

