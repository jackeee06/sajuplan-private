import { Link } from 'react-router-dom'
import type { ConsultHistoryItem, ConsultType } from '../data/myActivities'

/**
 * 전화/채팅상담 내역 카드 — 2줄 압축형 (2026-06-14).
 *
 * 사장님 요청: 휴지통 빼고, 사진은 두 줄 중간(세로 가운데)에, 한 이벤트를 두 줄로 끝낸다.
 *  - 성공:   [사진] 상담사명 (번호) ............ N코인  /  시간 시작 ~ 종료  (+ 후기/채팅 작은 링크)
 *  - 연결실패: [사진] 상담사명 (번호) · 연결 실패 · 상담사와 연결 전 종료   (한 줄)
 */

interface Props {
  item: ConsultHistoryItem
  type: ConsultType
  onDelete?: (id: number) => void // 미사용(휴지통 제거) — 호출처 호환 위해 유지
}

export default function ConsultHistoryCard({ item, type }: Props) {
  const { counselor, startedAt, endedAt, point, reviewStatus, reviewId, chatStatus, consultationId, counselorId, isFailed } = item
  const writeQs = new URLSearchParams()
  if (consultationId) writeQs.set('consultation_id', String(consultationId))
  writeQs.set('counselor_id', String(counselorId ?? counselor.id))
  const writeHref = `/mypage/my-reviews/new?${writeQs.toString()}`
  const reviewHref = reviewId ? `/mypage/my-reviews/${reviewId}` : '#'
  const isChat = type === '채팅상담'
  const chatEnded = chatStatus === 'DISCONNECT' || (endedAt != null && endedAt !== '')
  const chatActive = isChat && !chatEnded
  const timeRange = `${startedAt}${endedAt ? ` ~ ${shortEnd(startedAt, endedAt)}` : ''}`

  return (
    <article className="px-4 py-2.5 border-b border-[#F3F4F6]">
      <div className="flex items-center gap-2.5">
        <img
          src={counselor.avatar || '/img/avatar_default.svg'}
          alt=""
          className="w-9 h-9 rounded-full object-cover bg-[#E5E7EB] shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).src = '/img/avatar_default.svg' }}
        />
        <div className="flex-1 min-w-0">
          {/* 1줄: 상담사명 (번호) ...... N코인 / 또는 연결실패 라벨 */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[#030712] text-[15px]">{counselor.name}</span>
            <span className="font-medium text-[#ec4899] text-[14px]">{counselor.code}</span>
            {isFailed ? (
              <span className="text-[#FB2C36] text-[13px] font-medium">· 연결 실패 · 상담사와 연결 전 종료</span>
            ) : (
              <span className="ml-auto font-bold text-[#ec4899] text-[15px]">{(point ?? 0).toLocaleString()}코인</span>
            )}
          </div>
          {/* 2줄: 시간 시작~끝 (연결 실패도 시도 시각을 보여줌) + 후기/채팅 링크는 성공만 */}
          <div className="mt-0.5 flex items-center gap-2">
            <p className="text-[12.5px] text-[#99A1AF] truncate">시간 {timeRange}</p>
            {!isFailed && (
              <span className="ml-auto shrink-0 flex items-center gap-2.5">{renderActions()}</span>
            )}
          </div>
        </div>
      </div>
    </article>
  )

  function renderActions() {
    if (chatActive) {
      return <Link to={`/chat/${item.id}`} className="text-[13px] font-semibold text-[#8259F5]">채팅방 입장</Link>
    }
    const chatLogLink = isChat ? (
      <Link to={`/chat-log/${consultationId ?? item.id}`} className="text-[13px] font-medium text-[#6A7282]">내역</Link>
    ) : null
    let reviewLink = null
    if (reviewStatus === 'written') {
      reviewLink = <Link to={reviewHref} className="text-[13px] font-medium text-[#ec4899]">후기 보기</Link>
    } else if (reviewStatus === 'unwritten') {
      reviewLink = <Link to={writeHref} className="text-[13px] font-semibold text-[#ec4899]">후기 작성</Link>
    }
    return (
      <>
        {chatLogLink}
        {reviewLink}
      </>
    )
  }
}

/** 종료시각: 시작과 같은 날이면 시간만, 다른 날이면 전체. */
function shortEnd(start: string, end: string): string {
  const sd = start.split(' ')[0]
  const [ed, et] = end.split(' ')
  return ed === sd ? (et ?? end) : end
}
