import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import ConsultHistoryCard from '../components/ConsultHistoryCard'
import { ApiError, historyApi, type ConsultHistoryItem as ApiConsultHistoryItem } from '../lib/api'
import type { ConsultHistoryItem } from '../data/myActivities'

/**
 * 전화상담 내역 — Figma 109:10816
 *  카드 리스트: ConsultHistoryCard 재사용 (type='전화상담')
 *
 * 데이터 소스: GET /user/consult/history?role=member&type=call
 *  - 본인이 회원으로 상담받은 전화 상담 목록 + 후기 작성 여부(review_id) 포함.
 *  - 실데이터 전환 (2026-06-04). 기존 MOCK_CALL_HISTORY 제거.
 */
export default function MyCalls() {
  const navigate = useNavigate()
  const [items, setItems] = useState<ConsultHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    historyApi
      .list({ role: 'member', type: 'call', page: 1, limit: 50 })
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
        setError(e instanceof Error ? e.message : '전화상담 내역을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [navigate])

  const handleDelete = (id: number) => {
    setItems((list) => list.filter((it) => it.id !== id))
  }

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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">
          전화상담 내역
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
            아직 전화상담 내역이 없습니다.
          </p>
        )}
        {items.map((it) => (
          <ConsultHistoryCard key={it.id} item={it} type="전화상담" onDelete={handleDelete} />
        ))}
      </main>

      <FloatingActions bottomOffset={24} />
      <BottomNav />
    </div>
  )
}

/**
 * /user/consult/history?type=call 응답 row → ConsultHistoryCard prop 형태로 매핑.
 * MyChats.tsx 의 동일 함수와 로직 공유 (전화/채팅 통합 API 대응).
 */
function mapToHistoryItem(r: ApiConsultHistoryItem): ConsultHistoryItem {
  const startedAt = formatKDateTime(r.started_at)
  const endedAt = formatKDateTime(r.ended_at)
  // [2026-05-27 후기 5분 정책] 백엔드 가드(reviews.service.ts:520)와 동기화.
  //   5분(300초) 미만 통화 시 후기 작성 불가 → noaction 으로 분기.
  const reviewStatus = r.review_id != null
    ? 'written'
    : (Number(r.usetm_seconds) || 0) < 300
      ? 'noaction'
      : 'unwritten'
  return {
    id: r.id,
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
