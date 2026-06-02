import { Link, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import FloatingActions from './FloatingActions'
import type { ServiceProduct } from '../data/counselorMyPage'

/**
 * 08마이페이지_상담사_서비스 상품_상세 공통 레이아웃
 * Figma 노드: 169:13252(정보) / 170:13862(후기) / 170:14846(문의) / 172:12479(안내)
 *
 * 4탭 페이지가 같은 헤더·배너·메타·탭바를 공유하므로 한 컴포넌트에 묶고
 * children으로 본문만 주입.
 *
 * 구조:
 *  - hd2 헤더(← + 상품명 + 우측 홈 아이콘)
 *  - 풀폭 배너 이미지
 *  - 한줄 소개 / 상담사명 / 가격 + 후기·문의 카운트
 *  - 4탭 (정보/후기/문의/안내, line 탭)
 *  - {children}
 *  - 하단 sticky "결제하기" 보라 풀폭
 */

export type ProductTab = 'info' | 'reviews' | 'qna' | 'guide'

interface Props {
  product: ServiceProduct
  activeTab: ProductTab
  children: ReactNode
}

export default function CounselorMyProductDetailLayout({ product, activeTab, children }: Props) {
  const navigate = useNavigate()
  const id = product.id

  return (
    <div className="mobile-frame flex flex-col pb-[88px]">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712] truncate">
          {product.title}
        </h1>
        <Link to="/" aria-label="홈" className="w-[30px] h-[30px] flex items-center justify-center">
          {/* ic_hd_home.svg는 흰색(어두운 히어로용)이라 흰 배경에서 안 보임 — 진회색 인라인 사용 */}
          <svg width="28" height="28" viewBox="0 0 30 30" fill="none" aria-hidden>
            <path
              d="M15.5766 5.40695C15.2309 5.16297 14.7691 5.16297 14.4234 5.40695L5.42338 11.7588C5.15789 11.9461 5 12.2508 5 12.5758V24C5 24.5523 5.44772 25 6 25H24C24.5523 25 25 24.5523 25 24V12.5758C25 12.2508 24.8421 11.9461 24.5766 11.7588L15.5766 5.40695Z"
              stroke="#1E2939"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M11 20H19" stroke="#1E2939" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </header>

      <div className="px-4">
        <div className="w-full aspect-[16/10] rounded-[16px] overflow-hidden bg-[#F3F4F6]">
          <img src={product.bannerImg} alt="" className="w-full h-full object-cover" />
        </div>
        <p className="mt-3 text-[14px] text-[#6A7282]">{product.tagline}</p>
        <p className="mt-1 text-[18px] font-bold text-[#030712]">{product.counselorName}</p>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-[18px] font-bold text-[#ec4899]">{product.price.toLocaleString()}원</p>
          <div className="flex items-center gap-3 text-[14px] text-[#6A7282]">
            <span className="inline-flex items-center gap-1.5">
              <ChatBubble />
              후기 <span className="text-[#1E2939]">{product.reviewCount}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <HelpCircle />
              문의 <span className="text-[#1E2939]">{product.qnaCount}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 border-b border-[#F3F4F6]">
        {(['info', 'reviews', 'qna', 'guide'] as ProductTab[]).map((t) => {
          const on = t === activeTab
          return (
            <Link
              key={t}
              to={`/counselor/mypage/products/${id}/${t}`}
              className={`relative h-[44px] flex items-center justify-center text-[15px] ${
                on ? 'text-[#ec4899] font-bold' : 'text-[#6A7282] font-medium'
              }`}
            >
              {t === 'info' ? '정보' : t === 'reviews' ? '후기' : t === 'qna' ? '문의' : '안내'}
              {on && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#ec4899]" />}
            </Link>
          )
        })}
      </div>

      <main className="flex-1 px-4 pt-4">{children}</main>

      <FloatingActions bottomOffset={88} />

      <div className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-[600px] px-4 pb-4 pt-3 bg-white">
        <button
          type="button"
          className="w-full h-[52px] rounded-full bg-[#f472b6] text-white text-[16px] font-semibold"
        >
          결제하기
        </button>
      </div>
    </div>
  )
}

function ChatBubble() {
  return (
    <svg viewBox="0 0 18 18" className="w-[18px] h-[18px]" fill="none" aria-hidden>
      <path
        d="M2 9C2 6 4 4 7 4H11C14 4 16 6 16 9C16 12 14 14 11 14H10L7 17V14C4.5 13.5 2 11.5 2 9Z"
        fill="#99A1AF"
      />
    </svg>
  )
}
function HelpCircle() {
  return (
    <svg viewBox="0 0 18 18" className="w-[18px] h-[18px]" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="8" stroke="#99A1AF" strokeWidth="1.4" />
      <path d="M6.7 7.3C6.7 6.3 7.4 5.6 9 5.6S11.3 6.3 11.3 7.3C11.3 8.1 10.7 8.5 9.8 9L9 9.5V10.5" stroke="#99A1AF" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="9" cy="12.5" r="0.8" fill="#99A1AF" />
    </svg>
  )
}
