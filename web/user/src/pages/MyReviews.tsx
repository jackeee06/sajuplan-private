import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import { BADGE_BG } from '../data/counselorDetails'
import { MOCK_MY_REVIEWS } from '../data/myActivities'

/**
 * 나의 상담후기 — Figma 147:12682
 *  - 상단 안내 박스 (메달 아이콘 + 운영정책 링크)
 *  - 정렬/카운터 행: 전체 N건 + "사진 후기만 보기" 체크
 *  - 후기 카드 리스트 + 페이지네이션
 */
export default function MyReviews() {
  const navigate = useNavigate()
  const [photoOnly, setPhotoOnly] = useState(false)
  const [page, setPage] = useState(1)

  const list = useMemo(
    () => (photoOnly ? MOCK_MY_REVIEWS.filter((r) => r.imgUrl) : MOCK_MY_REVIEWS),
    [photoOnly],
  )

  return (
    <div className="mobile-frame flex flex-col pb-[40px]">
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
          나의 상담 후기
        </h1>
      </header>

      <div className="px-4 pt-2">
        <div className="rounded-[12px] bg-[#F9FAFB] px-4 py-4">
          <div className="flex items-center gap-3">
            <img src="/img/review_visual_img.png" alt="" className="w-[46px] h-[28px] shrink-0" />
            <p className="text-[15px] font-bold text-[#8259F5]">후기 작성 시 포인트 지급!</p>
          </div>
          <p className="mt-2 text-[13px] leading-[150%] text-[#4A5565]">
            본인인증 완료 및 5분 이상 상담을 진행하신 고객님에 한하여 후기 작성이 가능합니다.
          </p>
          <Link
            to="/mypage/notices"
            className="mt-2 inline-flex items-center gap-0.5 text-[13px] text-[#6A7282]"
          >
            상담후기 운영정책
            <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" aria-hidden>
              <path d="M6 3.5L10.5 8L6 12.5" stroke="#6A7282" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>

      <div className="px-4 py-3 flex items-center justify-between border-b border-[#F3F4F6]">
        <span className="text-[14px] text-[#4A5565]">
          전체 <span className="text-[#8259F5] font-medium">9,999</span>건
        </span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={photoOnly}
            onChange={(e) => {
              setPhotoOnly(e.target.checked)
              setPage(1)
            }}
            className="form-check-input"
          />
          <span className="text-[13px] text-[#4A5565]">사진 후기만 보기</span>
        </label>
      </div>

      <main className="flex-1 px-4">
        {list.map((r) => (
          <article key={r.id} className="py-4 border-b border-[#F3F4F6]">
            <div className="flex items-center gap-2">
              <img src={r.counselor.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
              <span
                className="px-2 h-[22px] inline-flex items-center text-[12px] font-medium text-white rounded"
                style={{ background: BADGE_BG[r.counselor.badge] }}
              >
                {r.counselor.badge}
              </span>
              <span className="text-[15px] font-bold text-[#030712]">{r.counselor.name}</span>
              <span className="text-[14px] font-medium text-[#8259F5]">{r.counselor.code}</span>
              <button
                type="button"
                aria-label="더보기"
                className="ml-auto w-7 h-7 flex items-center justify-center text-[#9CA3AF]"
              >
                ⋮
              </button>
            </div>
            <p className="mt-1 text-[12px] text-[#99A1AF]">
              {r.consultType} · {r.date} · {r.duration}
            </p>
            <Link to={`/mypage/my-reviews/${r.id}`} className="mt-3 flex gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[#6A7282] mb-1">{r.customerName}</p>
                <p className="text-[14px] leading-[150%] text-[#030712] whitespace-pre-line line-clamp-3">
                  {r.title}
                </p>
                <p className="mt-1 text-[13px] leading-[150%] text-[#6A7282] whitespace-pre-line line-clamp-2">
                  {r.content}
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
          </article>
        ))}
      </main>

      <Pagination currentPage={page} totalPages={1} onPageChange={setPage} />

      <FloatingActions bottomOffset={24} />
    </div>
  )
}
