import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import Pagination from '../components/Pagination'

/**
 * 전체 후기 리스트 — Figma 76:3667 (03전체리스트_전체 후기 리스트)
 *
 * 구조:
 *  - 헤더(hd2): ← + "상담 후기" + (검색·알림 우측 클러스터)
 *  - 안내 카드 (포인트 지급): bg #F9FAFB, radius 12, padding 16, gap 8
 *  - 후기 작성하기 버튼: outline-primary, h40 pill, w-full
 *  - 정렬/필터 행: "전체 9,999건" 좌 + "사진 후기만 보기" 체크 우, border-b
 *  - 후기 카드 리스트 (8개) — 아바타 48원형 / 상담사 메타 / 작성자명 / 제목+이미지 / 답글
 *  - 페이지네이션 1-5
 */

type ReviewType = '전화상담' | '채팅상담'
type Badge = '타로' | '신점' | '사주'

interface Reply {
  name: string
  text: string
}

export interface Review {
  id: number
  badge: Badge
  counselorName: string
  counselorCode: string
  reviewType: ReviewType
  date: string
  duration: string
  rating: number
  reviewCount: number
  /** 30초당 가격 */
  price: number
  /** 한줄소개 */
  tagline: string
  hashtags: [string, string]
  customerName: string
  reviewTitle: string
  reviewContent: string
  imgUrl?: string
  showLock?: boolean
  reply?: Reply
  profileImg: string
}

const BADGE_BG: Record<Badge, string> = {
  타로: '#ec4899',
  신점: '#00BBA7',
  사주: '#FF6467',
}

export const MOCK_REVIEWS: Review[] = [
  {
    id: 1, badge: '타로', counselorName: '강타로', counselorCode: '335912',
    reviewType: '채팅상담', date: '2026.04.23', duration: '00시간17분20초',
    rating: 4.9, reviewCount: 326, price: 1200, tagline: '상대방의 진심이 궁금하다면?',
    hashtags: ['#연애궁합운', '#재회'],
    customerName: '김*객',
    reviewTitle: '정말 많은 도움 되었습니다.',
    reviewContent: '선생님께서 정말 친절하고 자세하게 봐주십니다. 돈이 아깝지 않은 상담이었어요. 감사합니다.',
    imgUrl: '/img/sample_img01.jpg',
    profileImg: '/img/sample_img01.jpg',
  },
  {
    id: 2, badge: '신점', counselorName: '김선녀', counselorCode: '224587',
    reviewType: '전화상담', date: '2026.04.23', duration: '00시간17분20초',
    rating: 4.8, reviewCount: 92, price: 1500, tagline: '마음을 읽는 신점',
    hashtags: ['#삼재상담', '#연애운'],
    customerName: '콩*물',
    reviewTitle: '너무 용하셔서 신기합니다.',
    reviewContent: '제가 말씀드리지 않은 것까지 맞추셔서 너무 신기했습니다.\n다음에 또 이용하고 싶네요.',
    imgUrl: '/img/sample_img02.jpg',
    reply: {
      name: '김선녀',
      text: '안녕하세요. 상담이 만족스러우셨다니 다행입니다. 더 궁금한 점이 있으시면 언제든지 상담해주세요. 정성스러운 후기 감사합니다. :)',
    },
    profileImg: '/img/sample_img02.jpg',
  },
  {
    id: 3, badge: '사주', counselorName: '사주선녀', counselorCode: '165791',
    reviewType: '전화상담', date: '2026.04.23', duration: '00시간17분20초',
    rating: 4.7, reviewCount: 106, price: 1000, tagline: '속 시원하게 풀어드립니다',
    hashtags: ['#신년운세', '#금전운'],
    customerName: '옥*수',
    reviewTitle: '올해는 조심해야겠어요',
    reviewContent: '걱정많고 고민도 많았는데 어느정도 안심이 되네요. 정말 감사합니다.',
    profileImg: '/img/sample_img03.jpg',
  },
  {
    id: 4, badge: '타로', counselorName: '신비', counselorCode: '863143',
    reviewType: '전화상담', date: '2026.04.23', duration: '00시간17분20초',
    rating: 4.8, reviewCount: 237, price: 1400, tagline: '카드가 들려주는 이야기',
    hashtags: ['#오늘의운세', '#가족운'],
    customerName: '김*객',
    reviewTitle: '비밀 후기글입니다.',
    reviewContent: '비밀 후기글입니다.',
    showLock: true,
    profileImg: '/img/sample_img04.jpg',
  },
  {
    id: 5, badge: '타로', counselorName: '강타로', counselorCode: '335912',
    reviewType: '전화상담', date: '2026.04.23', duration: '00시간17분20초',
    rating: 4.9, reviewCount: 326, price: 1200, tagline: '상대방의 진심이 궁금하다면?',
    hashtags: ['#연애궁합운', '#재회'],
    customerName: '김*객',
    reviewTitle: '정말 많은 도움 되었습니다.',
    reviewContent: '선생님께서 정말 친절하고 자세하게 봐주십니다. 돈이 아깝지 않은 상담이었어요. 감사합니다.',
    profileImg: '/img/sample_img01.jpg',
  },
  {
    id: 6, badge: '신점', counselorName: '김선녀', counselorCode: '224587',
    reviewType: '전화상담', date: '2026.04.23', duration: '00시간17분20초',
    rating: 4.8, reviewCount: 92, price: 1500, tagline: '마음을 읽는 신점',
    hashtags: ['#삼재상담', '#연애운'],
    customerName: '김*객',
    reviewTitle: '정말 많은 도움 되었습니다.',
    reviewContent: '선생님께서 정말 친절하고 자세하게 봐주십니다. 돈이 아깝지 않은 상담이었어요. 감사합니다.',
    profileImg: '/img/sample_img02.jpg',
  },
  {
    id: 7, badge: '사주', counselorName: '사주선녀', counselorCode: '165791',
    reviewType: '전화상담', date: '2026.04.23', duration: '00시간17분20초',
    rating: 4.7, reviewCount: 106, price: 1000, tagline: '속 시원하게 풀어드립니다',
    hashtags: ['#신년운세', '#금전운'],
    customerName: '김*객',
    reviewTitle: '정말 많은 도움 되었습니다.',
    reviewContent: '선생님께서 정말 친절하고 자세하게 봐주십니다. 돈이 아깝지 않은 상담이었어요. 감사합니다.',
    profileImg: '/img/sample_img03.jpg',
  },
  {
    id: 8, badge: '타로', counselorName: '신비', counselorCode: '863143',
    reviewType: '전화상담', date: '2026.04.23', duration: '00시간17분20초',
    rating: 4.8, reviewCount: 237, price: 1400, tagline: '카드가 들려주는 이야기',
    hashtags: ['#오늘의운세', '#가족운'],
    customerName: '김*객',
    reviewTitle: '정말 많은 도움 되었습니다.',
    reviewContent: '선생님께서 정말 친절하고 자세하게 봐주십니다. 돈이 아깝지 않은 상담이었어요. 감사합니다.',
    profileImg: '/img/sample_img04.jpg',
  },
]

export default function Reviews() {
  const navigate = useNavigate()
  const [photoOnly, setPhotoOnly] = useState(false)
  const [page, setPage] = useState(1)

  const list = photoOnly ? MOCK_REVIEWS.filter((r) => r.imgUrl) : MOCK_REVIEWS

  return (
    <div className="mobile-frame flex flex-col pb-[100px]">
      {/* 헤더 — hd2 + 우측 검색·알림 */}
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
        <div className="flex items-center gap-3">
          <Link to="/search" aria-label="검색" className="w-[30px] h-[30px] flex items-center justify-center">
            <img src="/img/ic_hd_search.svg" alt="" className="w-7 h-7" />
          </Link>
          <Link to="/notifications" aria-label="알림" className="w-[30px] h-[30px] flex items-center justify-center">
            <img src="/img/ic_hd_push.svg" alt="" className="w-7 h-7" />
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-5 pt-3">
        {/* 안내 카드 + 후기 작성하기 버튼 묶음 (Figma 84:5350, gap 12) */}
        <section className="px-4 flex flex-col gap-3">
          <article className="bg-[#F9FAFB] rounded-[12px] p-4 flex flex-col gap-2">
            <img src="/img/review_visual_img.png" alt="" className="w-[46px] h-auto" />
            <h2 className="text-[18px] leading-[130%] font-semibold text-[#ec4899]">
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

          <button
            type="button"
            className="h-10 rounded-full bg-white border border-[#f472b6] text-[#ec4899] text-[14px] font-medium flex items-center justify-center gap-1 transition hover:bg-[#fdf2f8]"
          >
            <PencilLineIcon />
            후기 작성하기
          </button>
        </section>

        {/* 정렬 / 카운터 행 — border-b */}
        <section className="px-4 pb-3 flex items-center justify-between border-b border-[#F3F4F6]">
          <p className="text-[15px] leading-[130%] text-[#4A5565]">
            전체 <span className="font-medium text-[#ec4899]">9,999</span>건
          </p>
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={photoOnly}
              onChange={(e) => setPhotoOnly(e.target.checked)}
              className="w-[22px] h-[22px]"
            />
            <span className="text-[15px] leading-[120%] text-[#364153]">사진 후기만 보기</span>
          </label>
        </section>

        {/* 후기 카드 리스트 */}
        <section className="flex flex-col -mt-2">
          {list.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
          {list.length === 0 && (
            <p className="text-center text-[14px] text-[#99A1AF] py-10">
              사진 후기가 없습니다.
            </p>
          )}
        </section>

        {/* 페이지네이션 */}
        <Pagination currentPage={page} totalPages={5} onPageChange={setPage} />
      </main>

      <FloatingGoTop />
      <BottomNav />
      </div>
  )
}

/* ───────────── ReviewCard ───────────── */

function ReviewCard({ review }: { review: Review }) {
  const {
    badge, counselorName, counselorCode, reviewType, date, duration,
    customerName, reviewTitle, reviewContent, imgUrl, showLock, reply, profileImg,
  } = review

  return (
    <article className="px-4 py-4 flex flex-col gap-3 border-b border-[#F3F4F6]">
      {/* 상단: 아바타 + 상담사 메타 + 메뉴 */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <img
            src={profileImg}
            alt=""
            className="w-12 h-12 rounded-full object-cover border border-[#F9FAFB] shrink-0"
          />
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              <span
                className="text-white text-[12px] font-medium leading-[110%] px-[5px] py-[3px] rounded-full inline-flex items-center justify-center"
                style={{ backgroundColor: BADGE_BG[badge] }}
              >
                {badge}
              </span>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[16px] leading-[120%] font-semibold text-[#030712] truncate">
                  {counselorName}
                </span>
                <span className="text-[16px] leading-[120%] font-semibold text-[#ec4899]">
                  {counselorCode}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[14px] leading-[130%] text-[#99A1AF]">
              <span>{reviewType}</span>
              <span aria-hidden>∙</span>
              <span>{date}</span>
              <span aria-hidden>∙</span>
              <span>{duration}</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-label="더보기"
          className="w-5 h-5 flex items-center justify-center shrink-0"
        >
          <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" aria-hidden>
            <circle cx="10" cy="4.5" r="1.4" fill="#99A1AF" />
            <circle cx="10" cy="10" r="1.4" fill="#99A1AF" />
            <circle cx="10" cy="15.5" r="1.4" fill="#99A1AF" />
          </svg>
        </button>
      </div>

      {/* 본문 */}
      <div className="flex flex-col gap-3">
        {/* 작성자 이름 row */}
        <div className="flex items-center gap-1">
          <ReviewerIcon />
          <span className="flex-1 text-[14px] leading-[130%] font-medium text-[#1E2939]">
            {customerName}
          </span>
        </div>

        {/* 본문 + 이미지 */}
        <div className="flex gap-4 items-start">
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-1">
              {showLock && <LockIcon />}
              <h3 className="text-[14px] leading-[130%] font-medium text-[#1E2939]">
                {reviewTitle}
              </h3>
            </div>
            <p className="text-[14px] leading-[130%] text-[#4A5565] whitespace-pre-line">
              {reviewContent}
            </p>
          </div>
          {imgUrl && (
            <img
              src={imgUrl}
              alt=""
              className="w-[60px] h-[60px] rounded-[12px] object-cover border border-[#F3F4F6] shrink-0"
            />
          )}
        </div>

        {/* 상담사 답글 */}
        {reply && (
          <div className="rounded-[12px] bg-[#F9FAFB] p-3 flex flex-col gap-1">
            <p className="text-[14px] leading-[130%] font-medium text-[#1E2939]">{reply.name}</p>
            <p className="text-[14px] leading-[130%] text-[#6A7282]">{reply.text}</p>
          </div>
        )}
      </div>
    </article>
  )
}

/** 작성자 표시 아이콘 — Figma type=type27 (16×16). 코멘트 quote 형태로 근사. */
function ReviewerIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4 shrink-0" fill="none" aria-hidden>
      <path
        d="M3 4.5h3.5v3.5c0 1.6-1.2 2.8-2.7 3M9 4.5h3.5v3.5c0 1.6-1.2 2.8-2.7 3"
        stroke="#1E2939"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 잠금 아이콘 — 비밀 후기 표시 (16×16) */
function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4 shrink-0" fill="none" aria-hidden>
      <rect x="3" y="7" width="10" height="6.5" rx="1.3" stroke="#1E2939" strokeWidth="1.4" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="#1E2939" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

/** 펜슬 아이콘 — 후기 작성하기 버튼 (16×16) */
function PencilLineIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
      <path d="M11.5 2.5l2 2-7 7H4.5v-2l7-7z" stroke="#ec4899" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M2.5 14h11" stroke="#ec4899" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function FloatingGoTop() {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="위로 가기"
      className="fixed right-4 bottom-4 z-40 w-[50px] h-[50px] rounded-full border border-[#F9FAFB] backdrop-blur-[6px] flex items-center justify-center"
      style={{ background: 'rgba(243, 244, 246, 0.8)' }}
    >
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#030712" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  )
}
