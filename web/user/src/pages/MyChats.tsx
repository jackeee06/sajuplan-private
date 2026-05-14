import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FloatingActions from '../components/FloatingActions'
import ConsultHistoryCard from '../components/ConsultHistoryCard'
import { ApiError, historyApi, type ConsultHistoryItem as ApiConsultHistoryItem } from '../lib/api'
import type { ConsultHistoryItem } from '../data/myActivities'

/**
 * 채팅상담 내역 — Figma 147:12434
 *
 * 데이터 소스: GET /user/consult/history?type=chat
 *  - consultation 테이블 기반(reason in DISCONNECT/END_CHAT) → 사용 포인트(amt) + 후기 작성 여부(review_id) 포함.
 *  - 진행 중인 chat_room(STAY/CNCH) 도 active_chat 으로 동봉되므로 그대로 "채팅방 입장" 카드 노출.
 *
 *  과거 구현은 chat_room 기반(/user/chat/rooms?role=member)으로, 후기/포인트 정보가 없어 항상
 *  "noaction"으로 떨어져 후기 작성하기 버튼이 나오지 않았다. (이번 PR로 통합 상담내역 API로 통일.)
 */
export default function MyChats() {
  const navigate = useNavigate()
  const [items, setItems] = useState<ConsultHistoryItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    historyApi
      .list({ page: 1, limit: 50, type: 'chat' })
      .then((res) => {
        if (cancelled) return
        setItems(res.items.map(mapToHistoryItem))
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
  }, [navigate])

  const handleDelete = (id: number) => {
    setItems((list) => list.filter((it) => it.id !== id))
  }

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
          채팅상담 내역
        </h1>
      </header>

      <main className="flex-1 px-4">
        {loading && (
          <p className="py-10 text-center text-[14px] text-[#99A1AF]">불러오는 중…</p>
        )}
        {error && !loading && (
          <p className="py-10 text-center text-[14px] text-[#FB2C36]">{error}</p>
        )}
        {!loading && !error && items.length === 0 && (
          <p className="py-10 text-center text-[14px] text-[#99A1AF]">
            아직 채팅상담 내역이 없습니다.
          </p>
        )}
        {items.map((it) => (
          <ConsultHistoryCard key={it.id} item={it} type="채팅상담" onDelete={handleDelete} />
        ))}
      </main>

      <FloatingActions bottomOffset={24} />
    </div>
  )
}

/**
 * /user/consult/history 응답 row → ConsultHistoryCard prop 형태로 매핑.
 *  - card 의 item.id 는 chat_room.id (채팅방 입장/내역보기 라우팅 용).
 *  - 후기 작성 라우팅을 위해 별도로 consultation_id 가 필요한데, ConsultHistoryItem
 *    스키마는 이를 갖고 있지 않다. → 카드의 writeHref 가 orderId 라는 잘못된 쿼리키를
 *    쏘고 있어 link 자체가 깨졌었다. card 컴포넌트 쪽에서도 consultation_id 로 교정한다.
 */
function mapToHistoryItem(r: ApiConsultHistoryItem): ConsultHistoryItem {
  const startedAt = formatKDateTime(r.started_at)
  const endedAt = formatKDateTime(r.ended_at)
  const reviewStatus = r.is_active_chat
    ? 'noaction'
    : r.review_id != null
      ? 'written'
      : 'unwritten'
  return {
    id: r.chat_room_id ?? r.id,
    counselor: {
      id: r.counselor_id ?? 0,
      name: r.counselor_name,
      code: r.counselor_code ?? '------',
      badge: r.counselor_badge,
      avatar: r.counselor_avatar ?? '/img/avatar_default.svg',
    },
    startedAt,
    endedAt,
    duration: r.usetm_label,
    point: r.amt,
    reviewStatus,
    reviewId: r.review_id ?? undefined,
    chatStatus: r.is_active_chat ? r.chat_status ?? 'STAY' : 'DISCONNECT',
    consultationId: r.id,
    counselorId: r.counselor_id ?? undefined,
  }
}

function formatKDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
