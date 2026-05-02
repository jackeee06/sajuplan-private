import { Link, useParams } from 'react-router-dom'
import CounselorDetailLayout from '../components/CounselorDetailLayout'
import { MOCK_DETAILS, MOCK_COUNSELOR_QNAS, type CounselorQna } from '../data/counselorDetails'

/**
 * 상담사 상세 — 문의 탭 (Figma 92:4694)
 * 라우트: /counselors/:id/qna
 *
 * 본문 구조 (후기 탭과 거의 동일, 다만 컨텐츠가 문의):
 *  1) 안내 카드 (개인정보 노출 주의 안내)
 *  2) "문의 작성하기" outline-primary 버튼
 *  3) "전체 N건" (체크박스 없음)
 *  4) 문의 카드 리스트 — 답변완료/답변대기 뱃지 + 제목/본문 + 작성자·날짜
 *  5) "상담 문의 더보기" outline-gray 버튼
 */
export default function CounselorQna() {
  const { id = '3' } = useParams<{ id: string }>()
  const data = MOCK_DETAILS[id] ?? MOCK_DETAILS['3']
  const qnas = MOCK_COUNSELOR_QNAS[id] ?? []

  return (
    <CounselorDetailLayout data={data} activeTab="qna">
      <div className="flex flex-col gap-3">
        {/* 안내 카드 */}
        <article className="bg-[#F9FAFB] rounded-[12px] p-4 flex flex-col gap-2">
          <img src="/img/review_visual_img.png" alt="" className="w-[46px] h-auto" />
          <p className="text-[14px] leading-[130%] text-[#4A5565]">
            문의 시 전화번호, SNS 등의 개인정보를 남기실 시 이용이 제한될 수 있습니다.
          </p>
          <a
            href="#"
            className="inline-flex items-center gap-1 text-[14px] leading-[130%] font-medium text-[#4A5565]"
          >
            상담문의 운영정책
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
              <path d="M6 4L10 8L6 12" stroke="#4A5565" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </article>

        {/* 문의 작성하기 — outline-primary */}
        <Link
          to={`/counselors/${id}/qna/new`}
          className="h-10 rounded-full bg-white border border-[#9B7AF7] text-[#8259F5] text-[14px] font-medium flex items-center justify-center gap-1 transition hover:bg-[#F3EEFE]"
        >
          <PencilLineIcon />
          문의 작성하기
        </Link>
      </div>

      {/* 카운터 (체크박스 없음) */}
      <div className="px-0 pb-3 flex items-center border-b border-[#F3F4F6]">
        <p className="text-[15px] leading-[130%] text-[#4A5565]">
          전체 <span className="font-medium text-[#8259F5]">{data.qnaTotal}</span>건
        </p>
      </div>

      {/* 문의 카드 리스트 */}
      <section className="flex flex-col -mt-2">
        {qnas.length === 0 ? (
          <p className="text-center text-[14px] text-[#99A1AF] py-10">아직 문의가 없습니다.</p>
        ) : (
          qnas.map((q) => <QnaCard key={q.id} qna={q} counselorId={id} />)
        )}
      </section>

      {/* 더보기 */}
      <div className="flex justify-center">
        <button
          type="button"
          className="inline-flex items-center justify-center h-10 px-4 rounded-full bg-white border border-[#D1D5DC] text-[#6A7282] text-[14px] font-medium gap-1"
        >
          상담 문의 더보기
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
            <path d="M6 4L10 8L6 12" stroke="#6A7282" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </CounselorDetailLayout>
  )
}

/* ───────────── 문의 카드 ───────────── */

function QnaCard({ qna, counselorId }: { qna: CounselorQna; counselorId: string }) {
  const { id, status, title, content, customerName, date, showLock } = qna
  const statusActive = status === '답변완료'

  return (
    <Link
      to={`/counselors/${counselorId}/qna/${id}`}
      className="block px-0 py-4 flex flex-col gap-2 border-b border-[#F3F4F6] hover:bg-[#F9FAFB]/40 transition"
    >
      {/* 뱃지 + 제목 + 메뉴 — 한 줄 (Figma 92:4694) */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          <span
            className={`inline-flex items-center px-2 py-[3px] rounded-full text-[12px] leading-[110%] font-medium shrink-0 ${
              statusActive
                ? 'bg-[#F3EEFE] text-[#8259F5]'
                : 'bg-[#F3F4F6] text-[#6A7282]'
            }`}
          >
            {status}
          </span>
          {showLock && <LockIcon />}
          <h3 className="text-[16px] leading-[130%] font-medium text-[#1E2939] truncate">
            {title}
          </h3>
        </div>
        <button
          type="button"
          aria-label="더보기"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
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
      <p className="text-[14px] leading-[150%] text-[#6A7282] line-clamp-2 whitespace-pre-line">
        {content}
      </p>

      {/* 작성자 · 날짜 */}
      <div className="flex items-center gap-1 text-[13px] leading-[130%] text-[#99A1AF]">
        <span>{customerName}</span>
        <span aria-hidden>∙</span>
        <span>{date}</span>
      </div>
    </Link>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4 shrink-0" fill="none" aria-hidden>
      <rect x="3" y="7" width="10" height="6.5" rx="1.3" stroke="#1E2939" strokeWidth="1.4" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="#1E2939" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function PencilLineIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
      <path d="M11.5 2.5l2 2-7 7H4.5v-2l7-7z" stroke="#8259F5" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M2.5 14h11" stroke="#8259F5" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
