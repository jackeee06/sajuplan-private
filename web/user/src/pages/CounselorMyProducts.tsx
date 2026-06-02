import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import { MOCK_SERVICE_PRODUCTS, type ServiceProduct } from '../data/counselorMyPage'

type Tab = 'mine' | 'orders'

/**
 * 08마이페이지_상담사_서비스 상품
 * Figma node-id: 153:10198 / 173:12946 (나의 상품 탭) / 172:12730 (구매내역 관리 탭)
 *
 * 두 탭:
 *  - 나의 상품: 풀폭 카드 (배너 + 메타 + 가격 + 댓글수)
 *  - 구매내역 관리: 작은 썸네일 가로 카드
 */
export default function CounselorMyProducts() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('mine')
  const items = MOCK_SERVICE_PRODUCTS

  return (
    <div className="mobile-frame flex flex-col pb-[100px]">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">서비스 상품</h1>
      </header>

      <div className="grid grid-cols-2 border-b border-[#F3F4F6]">
        {(['mine', 'orders'] as Tab[]).map((t) => {
          const on = tab === t
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`relative h-[48px] flex items-center justify-center text-[16px] ${
                on ? 'text-[#8259F5] font-bold' : 'text-[#99A1AF] font-semibold'
              }`}
            >
              {t === 'mine' ? '나의 상품' : '구매내역 관리'}
              {on && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#8259F5]" />}
            </button>
          )
        })}
      </div>

      <main className="flex-1 px-4 pt-3">
        {tab === 'mine' ? (
          <ul className="flex flex-col gap-4">
            {items.map((p) => (
              <li key={p.id}>
                <ProductCardLarge product={p} />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="flex flex-col">
            {items.map((p) => (
              <li key={p.id} className="border-b border-[#F3F4F6]">
                <ProductCardSmall product={p} />
              </li>
            ))}
          </ul>
        )}
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav myHref="/counselor/mypage" />
    </div>
  )
}

function ProductCardLarge({ product }: { product: ServiceProduct }) {
  return (
    <Link to={`/counselor/mypage/products/${product.id}/info`} className="block">
      <div className="w-full aspect-[16/10] rounded-[16px] overflow-hidden bg-[#F3F4F6]">
        <img src={product.bannerImg} alt="" className="w-full h-full object-cover" />
      </div>
      <p className="mt-3 text-[14px] text-[#6A7282]">{product.tagline}</p>
      <p className="mt-1 text-[16px] font-bold text-[#030712] break-keep">{product.title}</p>
      <div className="mt-1 flex items-center justify-between">
        <p className="text-[16px] font-bold text-[#8259F5]">{product.price.toLocaleString()}원</p>
        <span className="inline-flex items-center gap-1.5 text-[14px] text-[#99A1AF]">
          <ChatBubble />
          {product.commentBadge}
        </span>
      </div>
    </Link>
  )
}

function ProductCardSmall({ product }: { product: ServiceProduct }) {
  return (
    <Link to={`/counselor/mypage/products/${product.id}/info`} className="flex items-center gap-3 py-3">
      <div className="w-20 h-20 rounded-[12px] overflow-hidden bg-[#F3F4F6] shrink-0">
        <img src={product.bannerImg} alt="" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-[#6A7282] truncate">{product.tagline}</p>
        <p className="text-[15px] font-bold text-[#030712] truncate">{product.title}</p>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-[15px] font-bold text-[#8259F5]">{product.price.toLocaleString()}원</p>
          <span className="inline-flex items-center gap-1 text-[13px] text-[#99A1AF]">
            <ChatBubble />
            {product.commentBadge}
          </span>
        </div>
      </div>
    </Link>
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
