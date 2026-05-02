import { Link } from 'react-router-dom'
import { BADGE_BG } from '../data/counselorDetails'
import type { ConsultHistoryItem, ConsultType } from '../data/myActivities'

/**
 * 전화/채팅상담 내역 카드 — Figma 109:10816 / 147:12434
 *
 * 카드 구조:
 *  - 상단: 아바타 + 보라 뱃지 + 이름 + 코드(보라) + 우측 휴지통(빨강)
 *  - 메타: "YYYY.MM.DD · 00시간NN분NN초" (이름 줄 아래)
 *  - 정보 행: 시작시간 / 완료시간 / 사용 포인트(보라 강조)
 *  - 액션 버튼: 상담타입 + reviewStatus 조합으로 분기
 *      전화상담  unwritten  → "후기 작성하기"(보라 채움)
 *      전화상담  written    → "작성한 후기 보기"(보라 outline)
 *      전화상담  noaction   → 버튼 없음 (짧은 통화)
 *      채팅상담  unwritten  → "채팅 내역 보기"(회색) + "후기 작성하기"(보라 narrow)
 *      채팅상담  written    → "채팅 내역 보기" + "작성한 후기 보기"
 *      채팅상담  noaction   → "채팅 내역 보기" 단독
 */

interface Props {
  item: ConsultHistoryItem
  type: ConsultType
  onDelete?: (id: number) => void
}

export default function ConsultHistoryCard({ item, type, onDelete }: Props) {
  const { counselor, startedAt, endedAt, duration, point, reviewStatus, reviewId } = item
  const writeHref = `/mypage/my-reviews/new?orderId=${item.id}&type=${type === '전화상담' ? 'phone' : 'chat'}`
  const reviewHref = reviewId ? `/mypage/my-reviews/${reviewId}` : '#'
  const dateOnly = startedAt.split(' ')[0]

  return (
    <article className="py-5 border-b border-[#F3F4F6]">
      <div className="flex items-center gap-2">
        <img src={counselor.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
        <span
          className="px-2 h-[22px] inline-flex items-center text-[12px] font-medium text-white rounded"
          style={{ background: BADGE_BG[counselor.badge] }}
        >
          {counselor.badge}
        </span>
        <span className="text-[15px] font-bold text-[#030712]">{counselor.name}</span>
        <span className="text-[14px] font-medium text-[#8259F5]">{counselor.code}</span>
        <button
          type="button"
          onClick={() => onDelete?.(item.id)}
          aria-label="삭제"
          className="ml-auto w-7 h-7 flex items-center justify-center"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" aria-hidden>
            <path d="M3 6h18" stroke="#FB2C36" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke="#FB2C36" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="#FB2C36" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 11v6M14 11v6" stroke="#FB2C36" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <p className="mt-1 ml-11 text-[12px] text-[#99A1AF]">
        {dateOnly} · {duration}
      </p>

      <dl className="mt-3 grid grid-cols-[80px_1fr] gap-y-1 text-[13px] leading-[150%]">
        <dt className="text-[#6A7282]">시작시간</dt>
        <dd className="text-right text-[#030712]">{startedAt}</dd>

        <dt className="text-[#6A7282]">완료시간</dt>
        <dd className="text-right text-[#030712]">{endedAt}</dd>

        <dt className="text-[#6A7282]">사용 포인트</dt>
        <dd className="text-right text-[#8259F5] font-bold">{point.toLocaleString()}P</dd>
      </dl>

      {renderActions()}
    </article>
  )

  function renderActions() {
    if (type === '전화상담') {
      if (reviewStatus === 'noaction') return null
      if (reviewStatus === 'written') {
        return (
          <Link
            to={reviewHref}
            className="mt-3 h-11 rounded-full border border-[#9B7AF7] bg-[#F3EEFE] flex items-center justify-center gap-1 text-[14px] font-medium text-[#8259F5]"
          >
            <PencilIcon />
            작성한 후기 보기
          </Link>
        )
      }
      return (
        <Link
          to={writeHref}
          className="mt-3 h-11 rounded-full bg-[#9B7AF7] flex items-center justify-center gap-1 text-[14px] font-medium text-white"
        >
          <PencilIcon stroke="#fff" />
          후기 작성하기
        </Link>
      )
    }

    // 채팅상담
    const chatBtn = (
      <Link
        to={`/chat/${counselor.id}`}
        className="flex-1 h-11 rounded-full border border-[#E5E7EB] bg-white flex items-center justify-center text-[14px] font-medium text-[#4A5565]"
      >
        채팅 내역 보기
      </Link>
    )
    if (reviewStatus === 'noaction') return <div className="mt-3 flex">{chatBtn}</div>
    if (reviewStatus === 'written') {
      return (
        <div className="mt-3 flex gap-2">
          {chatBtn}
          <Link
            to={reviewHref}
            className="flex-1 h-11 rounded-full border border-[#9B7AF7] bg-[#F3EEFE] flex items-center justify-center gap-1 text-[14px] font-medium text-[#8259F5]"
          >
            <PencilIcon />
            작성한 후기 보기
          </Link>
        </div>
      )
    }
    return (
      <div className="mt-3 flex gap-2">
        {chatBtn}
        <Link
          to={writeHref}
          className="flex-1 h-11 rounded-full bg-[#9B7AF7] flex items-center justify-center gap-1 text-[14px] font-medium text-white"
        >
          <PencilIcon stroke="#fff" />
          후기 작성하기
        </Link>
      </div>
    )
  }
}

function PencilIcon({ stroke = '#8259F5' }: { stroke?: string }) {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" aria-hidden>
      <path d="M3 21l3.5-1L18 8.5 15.5 6 4 17.5 3 21z" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M15.5 6L18 3.5 20.5 6 18 8.5 15.5 6z" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}
