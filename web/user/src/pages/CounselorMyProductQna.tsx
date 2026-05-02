import { useParams } from 'react-router-dom'
import CounselorMyProductDetailLayout from '../components/CounselorMyProductDetailLayout'
import { MOCK_PRODUCT_QNAS, MOCK_SERVICE_PRODUCTS } from '../data/counselorMyPage'

/**
 * 08마이페이지_상담사_서비스 상품_상세_문의
 * Figma node-id: 170:14846
 *
 * 회색 안내 박스 + 문의 작성하기 + 문의 카드 + "상담 문의 더보기"
 */
export default function CounselorMyProductQna() {
  const { id = '2' } = useParams<{ id: string }>()
  const product = MOCK_SERVICE_PRODUCTS.find((p) => p.id === Number(id)) ?? MOCK_SERVICE_PRODUCTS[0]
  const list = MOCK_PRODUCT_QNAS

  return (
    <CounselorMyProductDetailLayout product={product} activeTab="qna">
      <div className="rounded-[12px] bg-[#F9FAFB] px-4 py-3">
        <p className="text-[13px] leading-[150%] text-[#4A5565]">
          문의 시 전화번호, SNS 등의 개인정보를 남기시면 이용이 제한될 수 있습니다.
        </p>
        <button type="button" className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-[#1E2939]">
          상담문의 운영정책
          <ChevronRight />
        </button>
      </div>

      <button
        type="button"
        className="mt-3 w-full h-[44px] rounded-full border border-[#9B7AF7] flex items-center justify-center gap-1 text-[14px] font-medium text-[#8259F5]"
      >
        <PencilIcon />
        문의 작성하기
      </button>

      <div className="mt-4">
        <p className="text-[13px] leading-[140%] text-[#6A7282]">
          전체 <span className="text-[#8259F5] font-medium">9,999</span>건
        </p>
      </div>

      <ul className="mt-3 flex flex-col">
        {list.map((q) => (
          <li key={q.id} className="border-b border-[#F3F4F6] py-3">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center h-[22px] px-2 rounded-full text-[12px] leading-none font-medium ${
                  q.status === '답변완료'
                    ? 'bg-[#F3EEFE] text-[#8259F5]'
                    : 'bg-[#F3F4F6] text-[#6A7282]'
                }`}
              >
                {q.status}
              </span>
              {q.isPrivate && <LockIcon />}
              <span className="flex-1 text-[15px] font-semibold text-[#030712] truncate">
                {q.title}
              </span>
              <button type="button" aria-label="더보기" className="w-5 h-5">
                <MoreIcon />
              </button>
            </div>
            <p className="mt-1 text-[14px] leading-[140%] text-[#4A5565] line-clamp-2 break-keep">
              {q.content}
            </p>
            <p className="mt-1 text-[13px] text-[#99A1AF]">
              {q.authorName} · {q.date}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          className="h-9 px-4 rounded-full border border-[#E5E7EB] flex items-center gap-1 text-[13px] text-[#4A5565]"
        >
          상담 문의 더보기 <ChevronDown />
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
function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4 shrink-0" fill="none" aria-hidden>
      <rect x="3.5" y="7.5" width="9" height="6" rx="1" stroke="#1E2939" strokeWidth="1.4" />
      <path d="M5 7.5V5C5 3.34 6.34 2 8 2C9.66 2 11 3.34 11 5V7.5" stroke="#1E2939" strokeWidth="1.4" strokeLinecap="round" />
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
