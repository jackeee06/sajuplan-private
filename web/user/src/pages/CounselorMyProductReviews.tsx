import { useState } from 'react'
import { useParams } from 'react-router-dom'
import CounselorMyProductDetailLayout from '../components/CounselorMyProductDetailLayout'
import { MOCK_PRODUCT_REVIEWS, MOCK_SERVICE_PRODUCTS } from '../data/counselorMyPage'

/**
 * 08마이페이지_상담사_서비스 상품_상세_후기
 * Figma node-id: 170:13862
 *
 * 보라 안내 배너 + 후기 작성하기 버튼 + 후기 카드 + "상담 후기 더보기" 버튼
 */
export default function CounselorMyProductReviews() {
  const { id = '2' } = useParams<{ id: string }>()
  const product = MOCK_SERVICE_PRODUCTS.find((p) => p.id === Number(id)) ?? MOCK_SERVICE_PRODUCTS[0]
  const [photoOnly, setPhotoOnly] = useState(false)

  const list = photoOnly ? MOCK_PRODUCT_REVIEWS.filter((r) => r.imgUrl) : MOCK_PRODUCT_REVIEWS

  return (
    <CounselorMyProductDetailLayout product={product} activeTab="reviews">
      {/* 안내 카드 — Reviews/CounselorReviews/MyReviews와 동일 패턴 (날개 동전 이미지 + 베이지 배경) */}
      <article className="bg-[#F9FAFB] rounded-[12px] p-4 flex flex-col gap-2">
        <img src="/img/review_visual_img.png" alt="" className="w-[46px] h-auto" />
        <h2 className="text-[18px] leading-[130%] font-semibold text-[#8259F5]">
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
          <ChevronRight />
        </a>
      </article>

      <button
        type="button"
        className="mt-3 w-full h-[44px] rounded-full border border-[#9B7AF7] flex items-center justify-center gap-1 text-[14px] font-medium text-[#8259F5]"
      >
        <PencilIcon />
        후기 작성하기
      </button>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-[13px] leading-[140%] text-[#6A7282]">
          전체 <span className="text-[#8259F5] font-medium">9,999</span>건
        </p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={photoOnly}
            onChange={(e) => setPhotoOnly(e.target.checked)}
            className="w-4 h-4 accent-[#9B7AF7]"
          />
          <span className="text-[13px] text-[#4A5565]">사진 후기만 보기</span>
        </label>
      </div>

      <ul className="mt-3 flex flex-col">
        {list.map((r) => (
          <li key={r.id} className="border-b border-[#F3F4F6] py-4">
            <div className="flex items-center gap-1.5">
              <CheckCircle />
              <span className="flex-1 text-[14px] font-medium text-[#1E2939]">{r.customerName}</span>
              <button type="button" aria-label="더보기" className="w-5 h-5">
                <MoreIcon />
              </button>
            </div>
            <div className="mt-2 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {r.isPrivate && <LockIcon />}
                  <p className="text-[16px] font-bold text-[#030712] truncate">{r.title}</p>
                </div>
                <p className="mt-1 text-[14px] leading-[140%] text-[#4A5565] line-clamp-2 break-keep">
                  {r.content}
                </p>
                <p className="mt-2 text-[13px] leading-[140%] text-[#99A1AF]">
                  {r.consultType} · {r.date} · {r.duration}
                </p>
              </div>
              {r.imgUrl && (
                <img src={r.imgUrl} alt="" className="w-[60px] h-[60px] rounded-[8px] object-cover shrink-0" />
              )}
            </div>
            {r.reply && (
              <div className="mt-3 rounded-[12px] bg-[#F9FAFB] px-4 py-3">
                <p className="text-[14px] font-semibold text-[#1E2939]">{r.reply.author}</p>
                <p className="mt-1 text-[14px] leading-[140%] text-[#4A5565] line-clamp-2 break-keep">
                  {r.reply.text}
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          className="h-9 px-4 rounded-full border border-[#E5E7EB] flex items-center gap-1 text-[13px] text-[#4A5565]"
        >
          상담 후기 더보기 <ChevronDown />
        </button>
      </div>
    </CounselorMyProductDetailLayout>
  )
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" aria-hidden>
      <path d="M6 4L10 8L6 12" stroke="#1E2939" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ChevronDown() {
  return (
    <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" aria-hidden>
      <path d="M4 6L8 10L12 6" stroke="#4A5565" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
      <path d="M11 2L14 5L5 14H2V11L11 2Z" stroke="#8259F5" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function CheckCircle() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="7" stroke="#9B7AF7" strokeWidth="1.4" />
      <path d="M5 8L7 10L11 6" stroke="#9B7AF7" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" aria-hidden>
      <circle cx="12" cy="6" r="1.4" fill="#6A7282" />
      <circle cx="12" cy="12" r="1.4" fill="#6A7282" />
      <circle cx="12" cy="18" r="1.4" fill="#6A7282" />
    </svg>
  )
}
function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4 shrink-0" fill="none" aria-hidden>
      <rect x="3.5" y="7.5" width="9" height="6" rx="1" stroke="#1E2939" strokeWidth="1.4" />
      <path d="M5 7.5V5C5 3.34 6.34 2 8 2C9.66 2 11 3.34 11 5V7.5" stroke="#1E2939" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
