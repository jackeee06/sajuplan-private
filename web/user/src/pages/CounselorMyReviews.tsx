import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import { MOCK_COUNSELOR_REVIEWS } from '../data/counselorMyPage'

const PAGE_SIZE = 10

/**
 * 08마이페이지_상담사_후기 관리
 * Figma node-id: 153:10169
 *
 * - 상단 보라 배너: "후기에 답변을 달아주세요!" + 체크박스 "답변 없는 후기만 보기"
 * - 카운터 + 우측 체크박스 "사진 후기만 보기"
 * - 카드: 보라체크 작성자 + ⋮ + (썸네일) / 제목 / 본문 / 메타 / [답변 카드 or 답변 작성하기 버튼]
 * - 비밀 후기는 자물쇠 + 제목 마스킹
 */
export default function CounselorMyReviews() {
  const navigate = useNavigate()
  const [unansweredOnly, setUnansweredOnly] = useState(false)
  const [photoOnly, setPhotoOnly] = useState(false)
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    return MOCK_COUNSELOR_REVIEWS.filter((r) => {
      if (unansweredOnly && r.reply) return false
      if (photoOnly && !r.imgUrl) return false
      return true
    })
  }, [unansweredOnly, photoOnly])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">후기 관리</h1>
      </header>

      <main className="flex-1">
        {/* 상단 보라 배너 */}
        <section className="px-4 pt-3">
          <div className="rounded-[12px] bg-[#F3EEFE] px-4 py-3">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 20 20" className="w-5 h-5 shrink-0" fill="none" aria-hidden>
                <circle cx="10" cy="10" r="8" stroke="#8259F5" strokeWidth="1.4" />
                <path d="M7 10L9 12L13 8" stroke="#8259F5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-[14px] font-semibold text-[#8259F5]">후기에 답변을 달아주세요!</p>
            </div>
            <label className="mt-2 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={unansweredOnly}
                onChange={(e) => {
                  setUnansweredOnly(e.target.checked)
                  setPage(1)
                }}
                className="w-4 h-4 accent-[#9B7AF7]"
              />
              <span className="text-[13px] text-[#4A5565]">답변 없는 후기만 보기</span>
            </label>
          </div>
        </section>

        <section className="px-4 pt-3 pb-2 flex items-center justify-between">
          <p className="text-[13px] leading-[140%] text-[#6A7282]">
            전체 <span className="text-[#8259F5] font-medium">9,999</span>건
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={photoOnly}
              onChange={(e) => {
                setPhotoOnly(e.target.checked)
                setPage(1)
              }}
              className="w-4 h-4 accent-[#9B7AF7]"
            />
            <span className="text-[13px] text-[#4A5565]">사진 후기만 보기</span>
          </label>
        </section>

        <ul className="flex flex-col">
          {pageItems.map((r) => (
            <li key={r.id} className="border-b border-[#F3F4F6]">
              <div className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
                    <circle cx="8" cy="8" r="7" stroke="#9B7AF7" strokeWidth="1.4" />
                    <path d="M5 8L7 10L11 6" stroke="#9B7AF7" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="flex-1 text-[14px] font-medium text-[#1E2939]">{r.customerName}</span>
                  <button type="button" aria-label="더보기" className="w-5 h-5">
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" aria-hidden>
                      <circle cx="12" cy="6" r="1.4" fill="#6A7282" />
                      <circle cx="12" cy="12" r="1.4" fill="#6A7282" />
                      <circle cx="12" cy="18" r="1.4" fill="#6A7282" />
                    </svg>
                  </button>
                </div>

                <Link to={`/counselor/mypage/reviews/${r.id}`} className="mt-2 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {r.isPrivate && (
                        <svg viewBox="0 0 16 16" className="w-4 h-4 shrink-0" fill="none" aria-hidden>
                          <rect x="3.5" y="7.5" width="9" height="6" rx="1" stroke="#1E2939" strokeWidth="1.4" />
                          <path d="M5 7.5V5C5 3.34 6.34 2 8 2C9.66 2 11 3.34 11 5V7.5" stroke="#1E2939" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                      )}
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
                    <img
                      src={r.imgUrl}
                      alt=""
                      className="w-[60px] h-[60px] rounded-[8px] object-cover shrink-0"
                    />
                  )}
                </Link>

                {r.reply ? (
                  <div className="mt-3 rounded-[12px] bg-[#F9FAFB] px-4 py-3">
                    <p className="text-[14px] font-semibold text-[#1E2939]">{r.reply.author}</p>
                    <p className="mt-1 text-[14px] leading-[140%] text-[#4A5565] line-clamp-2 break-keep">
                      {r.reply.text}
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate(`/counselor/mypage/reviews/${r.id}`)}
                    className="mt-3 w-full h-[44px] rounded-full bg-[#9B7AF7] text-white text-[14px] font-semibold"
                  >
                    답변 작성하기
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav myHref="/counselor/mypage" />
    </div>
  )
}
