import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import { ApiError, historyApi, type ConsultHistoryItem as ApiConsultHistoryItem } from '../lib/api'
import type { ConsultLog } from '../data/counselorMyPage'

const PAGE_SIZE = 10

/**
 * 08마이페이지_상담사_채팅상담내역
 * Figma node-id: 152:10138
 *
 * 데이터 소스: GET /user/consult/history?role=counselor&type=chat
 *  - 본인이 상담사로 진행/종료한 채팅 상담 + 회원이 작성한 후기(review_id) + 본인이 작성한 답변(reply_id)
 *    까지 한 번에 받아온다.
 *  - 과금 포인트(amt) 는 consultation.amt 그대로.
 *
 * 과거 구현은 /user/chat/rooms?role=counselor 만 호출해 pointPaid/reviewStatus 가 모두
 * 하드코딩(0 / '대기')이라 "후기 답변 작성하기" 버튼이 영원히 노출되지 않았다.
 */
export default function CounselorMyChats() {
  const navigate = useNavigate()
  const location = useLocation()
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [items, setItems] = useState<ConsultLog[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [otherRoleCount, setOtherRoleCount] = useState(0)

  // 라우트로 다시 진입할 때마다 fresh fetch. location.key 가 매 navigate 마다 새로 발급되므로
  // 동일 경로로 돌아와도 useEffect 가 재실행되어 최신 데이터로 갱신된다.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    historyApi
      .list({ role: 'counselor', type: 'chat', page, limit: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return
        setItems(res.items.map(mapHistoryToLog))
        setTotal(res.total)
        setOtherRoleCount((res as { other_role_count?: number }).other_role_count ?? 0)
        setError(null)
      })
      .catch((e) => {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 401) {
          navigate('/login')
          return
        }
        setError(e instanceof Error ? e.message : '채팅 내역을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [navigate, page, location.key])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">채팅상담내역</h1>
      </header>

      {/* 이중역할자(회원+상담사)에게만 노출 — 상담사로 "진행한" 내역임을 명확히. 순수 상담사/회원은 안 보임. */}
      {otherRoleCount > 0 && (
        <div className="px-4 py-2 bg-[#F5F3FF] border-b border-[#ede9fe]">
          <p className="text-[12.5px] leading-[150%] text-[#5b21b6]">
            ※ 이 목록은 <span className="font-medium">상담사로 “진행한”</span> 상담입니다.
          </p>
        </div>
      )}

      <main className="flex-1">
        {loading && <p className="py-10 text-center text-[14px] text-[#99A1AF]">불러오는 중…</p>}
        {error && !loading && (
          <p className="py-10 text-center text-[14px] text-[#FB2C36]">{error}</p>
        )}
        {!loading && !error && items.length === 0 && (
          <p className="py-10 text-center text-[14px] text-[#99A1AF]">
            아직 진행한 채팅상담 내역이 없습니다.
          </p>
        )}
        <ul className="flex flex-col">
          {items.map((it) => (
            <li key={`${it.id}-${it.startedAt}`} className="border-b border-[#F3F4F6]">
              <ChatCard
                log={it}
                onMemo={() => {
                  // 상담 메모는 consultation_id 기준. (chat_room.id ≠ consultation.id)
                  const cid = it.consultationId ?? it.id
                  navigate(`/counselor/mypage/chats/${cid}/memo`)
                }}
                onOpenChat={() => navigate(`/chat/${it.id}`)}
                onWriteReply={() => {
                  if (it.reviewId) navigate(`/counselor/mypage/reviews/${it.reviewId}`)
                }}
              />
            </li>
          ))}
        </ul>

        {!loading && total > 0 && (
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav myHref="/counselor/mypage" />
    </div>
  )
}

function mapHistoryToLog(r: ApiConsultHistoryItem): ConsultLog {
  const startedAt = formatKDateTime(r.started_at)
  const endedAt = formatKDateTime(r.ended_at)
  const reviewWritten = r.review_id != null
  const replyWritten = r.reply_id != null
  return {
    id: r.chat_room_id ?? r.id,
    type: 'chat',
    // role=counselor 응답에서 counselor_* 필드는 사실 "회원(peer)" 정보를 담는다.
    customerName: r.counselor_name || '회원',
    date: startedAt.split(' ')[0] ?? '',
    duration: r.usetm_label,
    startedAt,
    endedAt,
    pointPaid: r.amt,
    earning: r.earning ?? 0,
    avatar: r.counselor_avatar,
    usetmSeconds: r.usetm_seconds,
    reviewStatus: reviewWritten ? '완료' : '대기',
    hasReply: replyWritten,
    reviewId: r.review_id,
    chatStatus: r.is_active_chat ? r.chat_status ?? 'STAY' : 'DISCONNECT',
    consultationId: r.id,
  }
}

function formatKDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function ChatCard({
  log,
  onMemo,
  onOpenChat,
  onWriteReply,
}: {
  log: ConsultLog
  onMemo: () => void
  onOpenChat: () => void
  onWriteReply: () => void
}) {
  const reviewDone = log.reviewStatus === '완료'
  // 종료 판정: 명시적 DISCONNECT 또는 endedAt 값이 채워진 경우. 그 외(STAY/CNCH/null) 모두 진행 중.
  const chatEnded = log.chatStatus === 'DISCONNECT' || (log.endedAt != null && log.endedAt !== '')
  const chatActive = !chatEnded
  const earning = log.earning ?? 0
  const avatar = log.avatar || '/img/avatar_default.svg'
  const timeRange = `${log.startedAt}${log.endedAt ? ` ~ ${shortEnd(log.startedAt, log.endedAt)}` : ''}`

  // 2줄 압축 (2026-06-14). 전화상담내역과 동일 형식 + 휴지통 제거.
  //  - 1줄: [사진] 회원명 · 채팅 {시간}  ……  {수익}원
  //  - 2줄: 시간 시작 ~ 끝  ……  채팅보기 · 후기답변 · 메모
  return (
    <article className="px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <img
          src={avatar}
          alt=""
          className="w-9 h-9 rounded-full object-cover bg-[#E5E7EB] shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).src = '/img/avatar_default.svg' }}
        />
        <div className="flex-1 min-w-0">
          {/* 1줄: 회원명 · 채팅 시간 …… 수익 (진행중이면 [상담중]) */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[#030712] text-[15px] shrink-0">{log.customerName}</span>
            {chatActive ? (
              <span className="px-2 h-[20px] inline-flex items-center text-[11px] font-semibold text-[#ec4899] bg-[#fdf2f8] rounded-full shrink-0">상담중</span>
            ) : (
              <>
                <span className="text-[12px] text-[#6A7282] truncate">· 채팅 {briefDur(Number(log.usetmSeconds) || 0)}</span>
                <span className="ml-auto font-bold text-[#8259F5] text-[15px] shrink-0">{earning.toLocaleString()}원</span>
              </>
            )}
          </div>
          {/* 2줄: 시각 시작~끝 …… (채팅보기·후기답변·메모 / 또는 채팅방 입장) */}
          <div className="mt-0.5 flex items-center gap-2">
            <p className="text-[12.5px] text-[#99A1AF] truncate">
              {chatActive ? `시작 ${log.startedAt}` : `시간 ${timeRange}`}
            </p>
            <span className="ml-auto shrink-0 flex items-center gap-2.5">
              {chatActive ? (
                <button type="button" onClick={onOpenChat} className="text-[13px] font-semibold text-[#8259F5]">채팅방 입장</button>
              ) : (
                <>
                  <button type="button" onClick={onOpenChat} className="text-[13px] font-medium text-[#6A7282]">채팅보기</button>
                  {reviewDone && (
                    <button type="button" onClick={onWriteReply} className="text-[13px] font-semibold text-[#8259F5]">
                      {log.hasReply ? '답변 보기' : '후기 답변'}
                    </button>
                  )}
                  <button type="button" onClick={onMemo} className="text-[13px] font-medium text-[#6A7282]">메모</button>
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}

/** 종료시각: 시작과 같은 날이면 시·분·초만, 다른 날이면 전체. */
function shortEnd(start: string, end: string): string {
  const sd = start.split(' ')[0]
  const [ed, et] = end.split(' ')
  return ed === sd ? (et ?? end) : end
}

/** 간략 통화시간: "3분35초" / "36초" / "1시간2분". */
function briefDur(sec: number): string {
  const n = Number(sec) || 0
  const h = Math.floor(n / 3600)
  const m = Math.floor((n % 3600) / 60)
  const s = n % 60
  if (h) return `${h}시간${m}분`
  if (m) return `${m}분${s}초`
  return `${s}초`
}
