import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import { chargeApi, type PaymentLogDto } from '../lib/api'

/**
 * 07마이페이지_일반회원_결제내역
 *
 * [2026-05-25] 사용자 신뢰 우선 디자인 적용:
 * - 결제완료된 건만 메인 노출 (진행중·실패·취소는 숨김 — DB엔 남아있음)
 * - 24시간 이내 입금대기 가상계좌는 상단 옅은 회색 알림 (압박감 X)
 * - 카드 레이아웃: 결제수단(앵커, 굵게) ↔ 충전 코인(동급, 보통) ↔ 완료뱃지
 * - 원화 결제금액 화면 표시 X (돈 자각 자극 X) — 영수증/상세에서만
 * - 합계·잔액 표시 X
 */
export default function Payments() {
  const navigate = useNavigate()
  const [items, setItems] = useState<PaymentLogDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    chargeApi
      .payments()
      .then((rows) => setItems(rows))
      .catch((e) => setError((e as Error).message))
  }, [])

  const { completed, awaitingRecent } = useMemo(() => {
    if (!items) return { completed: [] as PaymentLogDto[], awaitingRecent: [] as PaymentLogDto[] }
    const now = Date.now()
    const oneDayMs = 24 * 60 * 60 * 1000
    const completedAll = items.filter((p) => p.status === 'completed')
    const awaitingRecentAll = items.filter((p) => {
      if (p.status !== 'awaiting_deposit') return false
      if (!p.vbank?.account) return false
      const t = new Date(p.paidAt).getTime()
      if (isNaN(t)) return false
      return now - t < oneDayMs
    })
    return { completed: completedAll, awaitingRecent: awaitingRecentAll }
  }, [items])

  const grouped = useMemo(() => {
    const groups: Record<string, PaymentLogDto[]> = {}
    completed.forEach((p) => {
      const date = formatDate(p.paidAt)
      if (!groups[date]) groups[date] = []
      groups[date].push(p)
    })
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [completed])

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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">결제내역</h1>
      </header>

      <main className="flex-1 flex flex-col">
        {/* 입금대기 (24h 이내) — 옅은 회색, 압박 X */}
        {awaitingRecent.length > 0 && (
          <details className="mx-4 mt-3 group">
            <summary className="cursor-pointer list-none flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F9FAFB] hover:bg-[#F3F4F6] transition">
              <span className="text-[11.5px] text-[#6A7282] flex-1">
                가상계좌 입금 대기 {awaitingRecent.length}건 · 24h 후 자동 만료
              </span>
              <span className="text-[#99A1AF] text-[14px] group-open:rotate-180 transition">▾</span>
            </summary>
            <ul className="mt-1 space-y-1">
              {awaitingRecent.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/charge/vbank-info?oid=${encodeURIComponent(p.oid)}`)}
                    className="w-full text-left px-3 py-2 bg-white border border-[#F3F4F6] rounded-lg text-[11.5px] text-[#6A7282]"
                  >
                    <div className="flex justify-between">
                      <span>{p.vbank?.bankName ?? ''}</span>
                      <span className="tabular-nums font-medium text-[#4A5565]">{p.vbank?.account}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}

        {error ? (
          <div className="py-20 text-center text-[14px] text-[#FF6467]">{error}</div>
        ) : !items ? (
          <div className="py-20 text-center text-[14px] text-[#99A1AF]">불러오는 중...</div>
        ) : completed.length === 0 ? (
          <div className="py-20 text-center text-[14px] text-[#99A1AF]">결제내역이 없습니다.</div>
        ) : (
          <div className="flex-1 px-4 pt-1">
            {grouped.map(([date, ps]) => (
              <div key={date} className="mb-2">
                <div className="px-1 pt-3 pb-1.5 text-[12px] font-semibold text-[#6A7282]">{date}</div>
                <ul className="flex flex-col gap-2">
                  {ps.map((p) => (
                    <PaymentRow key={p.id} p={p} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </main>

      <FloatingActions bottomOffset={24} />
      <BottomNav />
      </div>
  )
}

function PaymentRow({ p }: { p: PaymentLogDto }) {
  const methodLabel = p.vbank?.bankName ? `${p.method} ${p.vbank.bankName}` : p.method
  return (
    <li>
      <article className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-[#F3F4F6] bg-white">
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-bold text-[#030712] leading-tight truncate">{methodLabel}</div>
          <div className="text-[11px] text-[#99A1AF] font-normal mt-1">{formatTime(p.paidAt)}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[16px] font-bold text-[#4A5565] tabular-nums leading-tight">
            +{p.coinAmount.toLocaleString()}
          </div>
          <div className="text-[10.5px] text-[#99A1AF] font-normal mt-1">코인</div>
        </div>
        <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full bg-[#ecfdf5] text-[#059669] text-[11px] font-semibold">
          ✓ 완료
        </span>
      </article>
    </li>
  )
}

/** ISO timestamp → 'YYYY.MM.DD (요일)' (KST) */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const ymd = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d).replaceAll('-', '.')
    const dow = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      weekday: 'short',
    }).format(d)
    return `${ymd} (${dow})`
  } catch {
    return ''
  }
}

/** ISO timestamp → 'HH:mm' (KST) */
function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
  } catch {
    return ''
  }
}
