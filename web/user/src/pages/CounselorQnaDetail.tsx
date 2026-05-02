import { Link, useNavigate, useParams } from 'react-router-dom'
import FloatingActions from '../components/FloatingActions'
import { MOCK_COUNSELOR_QNAS, type CounselorQna } from '../data/counselorDetails'

/**
 * 문의 상세 — Figma 92:6485 (답변 있음) / 92:6381 (답변 없음)
 * 라우트: /counselors/:id/qna/:qnaId
 *
 * 구조 (gap 40):
 *  [hd5 헤더: ← + 상담 문의]
 *  [본문 그룹 (gap 16)]
 *    1) 제목 (18px medium #1E2939)
 *    2) 작성자 · 날짜시간 (14px regular #99A1AF)
 *    3) 본문 14px line-150% #4A5565
 *  [답변 섹션 (gap 24)]
 *    · 카운터 "상담사 답변 N건" + border-b
 *    · 답변 있음: 답변 본문 → 작은 아바타(28) + 상담사명 · 시각 (Review와 동일 패턴)
 *    · 답변 없음: 60×60 연보라 원형 + 말풍선 + "등록된 답변이 없습니다."
 *  [목록으로 outline-primary, 가운데 정렬 — Review와 다름]
 *  [floating: go_top만]
 */

export default function CounselorQnaDetail() {
  const { id = '3', qnaId } = useParams<{ id: string; qnaId: string }>()
  const navigate = useNavigate()
  const qnas = MOCK_COUNSELOR_QNAS[id] ?? []
  const qna = qnas.find((q) => String(q.id) === qnaId) ?? qnas[0]

  if (!qna) {
    return (
      <div className="mobile-frame flex flex-col">
        <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="뒤로"
            className="w-[30px] h-[30px] flex items-center justify-center"
          >
            <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
          </button>
          <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">상담 문의</h1>
        </header>
        <p className="text-center text-[14px] text-[#99A1AF] py-20">문의를 찾을 수 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="mobile-frame flex flex-col">
      {/* 헤더 — hd5 */}
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">상담 문의</h1>
      </header>

      <main className="flex-1 flex flex-col pb-10">
        {/* 본문 그룹 */}
        <div className="px-4 pt-4 pb-4 flex flex-col gap-4">
          {/* 제목 + 작성자/날짜 */}
          <div className="flex flex-col gap-2">
            <h2 className="text-[18px] leading-[130%] font-medium text-[#1E2939]">
              {qna.title}
            </h2>
            <div className="flex items-center gap-1 text-[14px] leading-[130%] text-[#99A1AF]">
              <span>{qna.customerName}</span>
              <span aria-hidden>∙</span>
              <span>{qna.postedAt}</span>
            </div>
          </div>

          {/* 본문 */}
          <p className="text-[14px] leading-[150%] text-[#4A5565] whitespace-pre-line">
            {qna.content}
          </p>
        </div>

        {/* 답변 섹션 */}
        <ReplySection qna={qna} className="mt-6" />

        {/* 목록으로 — 가운데 정렬 */}
        <div className="px-4 mt-10 flex justify-center">
          <Link
            to={`/counselors/${id}/qna`}
            className="inline-flex items-center justify-center w-[120px] h-10 px-4 rounded-full bg-white border border-[#9B7AF7] text-[#8259F5] text-[14px] font-medium"
          >
            목록으로
          </Link>
        </div>
      </main>

      <FloatingActions bottomOffset={16} showKakao={false} />
    </div>
  )
}

/* ───────────── 답변 섹션 ───────────── */

function ReplySection({ qna, className = '' }: { qna: CounselorQna; className?: string }) {
  const hasReply = !!qna.reply

  return (
    <section className={`flex flex-col gap-6 ${className}`}>
      <div className="px-4 pb-3 flex items-center border-b border-[#F3F4F6]">
        <p className="text-[15px] leading-[130%] text-[#364153]">
          상담사 답변{' '}
          <span className="font-medium text-[#8259F5]">{hasReply ? 1 : 0}</span>건
        </p>
      </div>

      {hasReply ? (
        <article className="px-4 flex flex-col gap-3">
          <p className="text-[14px] leading-[150%] text-[#4A5565] whitespace-pre-line">
            {qna.reply!.text}
          </p>
          <div className="flex items-center gap-2">
            <img
              src={qna.reply!.profileImg}
              alt=""
              className="w-7 h-7 rounded-full object-cover border border-[#F9FAFB] shrink-0"
            />
            <div className="flex items-center gap-1 text-[13px] leading-[130%] text-[#6A7282]">
              <span className="font-medium text-[#1E2939]">{qna.reply!.name}</span>
              <span aria-hidden>∙</span>
              <span>{qna.reply!.postedAt}</span>
            </div>
          </div>
        </article>
      ) : (
        <div className="h-[230px] flex flex-col items-center justify-center gap-3 px-4">
          <div className="w-[60px] h-[60px] rounded-full bg-[#F3EEFE] flex items-center justify-center">
            <SpeechBubbleIcon />
          </div>
          <p className="text-[14px] leading-[130%] text-[#99A1AF]">등록된 답변이 없습니다.</p>
        </div>
      )}
    </section>
  )
}

function SpeechBubbleIcon() {
  return (
    <svg viewBox="0 0 28 28" className="w-7 h-7" fill="none" aria-hidden>
      <path
        d="M5 8c0-1.66 1.34-3 3-3h12c1.66 0 3 1.34 3 3v8c0 1.66-1.34 3-3 3h-6l-4.5 4v-4H8c-1.66 0-3-1.34-3-3V8z"
        stroke="#9B7AF7"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
