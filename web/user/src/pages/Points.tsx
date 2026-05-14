import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FloatingActions from '../components/FloatingActions'
import { pointsApi, type PointBalance, type PointHistoryItem } from '../lib/api'

/**
 * 07마이페이지_일반회원_포인트 내역
 * Figma node-id: 147:10616
 *
 * 데이터:
 *   - 보유 포인트 카드: GET /api/user/points/balance (free + paid)
 *   - 내역 리스트:     GET /api/user/points/history?page=&limit=
 *     · direction(in/out), title(content), occurred_at, amount, balance_after
 *     · is_expired, is_paid 등 추가 정보 (현재 UI는 기본만 노출)
 */
export default function Points() {
  const navigate = useNavigate()
  const [balance, setBalance] = useState<PointBalance | null>(null)
  const [items, setItems] = useState<PointHistoryItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const PAGE_SIZE = 20

  // 첫 로드: 잔액 + 1페이지 동시 조회
  useEffect(() => {
    let alive = true
    Promise.all([pointsApi.balance(), pointsApi.history({ page: 1, limit: PAGE_SIZE })]).then(
      ([b, h]) => {
        if (!alive) return
        setBalance(b)
        setItems(h.items ?? [])
        setTotal(h.total ?? 0)
        setPage(1)
        setLoading(false)
      },
      () => {
        if (!alive) return
        setLoading(false)
      },
    )
    return () => {
      alive = false
    }
  }, [])

  const loadMore = async () => {
    if (loadingMore) return
    const next = page + 1
    setLoadingMore(true)
    try {
      const r = await pointsApi.history({ page: next, limit: PAGE_SIZE })
      setItems((prev) => [...prev, ...(r.items ?? [])])
      setPage(next)
    } catch {
      /* swallow — 사용자가 다시 누를 수 있음 */
    } finally {
      setLoadingMore(false)
    }
  }

  const hasMore = items.length < total

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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">포인트 내역</h1>
      </header>

      <section className="px-4 pt-1">
        <div className="rounded-[16px] bg-[#F9FAFB] px-5 pt-5 pb-1">
          <p className="text-[14px] text-[#99A1AF] leading-[140%]">보유 포인트</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[28px] font-bold text-[#8259F5] leading-[120%]">
              {(balance?.total ?? 0).toLocaleString()}
            </span>
            <img src="/img/ic_point.svg" alt="" className="w-6 h-6" />
          </div>
          <button
            type="button"
            onClick={() => navigate('/mypage/charge')}
            className="mt-4 w-full h-[44px] flex items-center justify-center gap-2 border-t border-[#E5E7EB] text-[15px] font-medium text-[#1E2939]"
          >
            <img src="/img/ic_my_card.svg" alt="" className="w-5 h-5" />
            포인트충전
          </button>
        </div>
      </section>

      <main className="flex-1 px-4 pt-6 flex flex-col gap-5">
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-[#E5E7EB] border-t-[#8259F5] rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center text-[14px] text-[#99A1AF]">포인트 내역이 없습니다.</div>
        ) : (
          <>
            {items.map((log) => {
              const isIn = log.direction === 'in'
              return (
                <article key={log.id} className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-[12px] border border-[#F3F4F6] bg-white flex items-center justify-center shrink-0">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      {isIn ? (
                        <path
                          d="M4 10H16M16 10L11 5M16 10L11 15"
                          stroke="#8259F5"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ) : (
                        <path
                          d="M16 10H4M4 10L9 5M4 10L9 15"
                          stroke="#99A1AF"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[16px] text-[#1E2939] leading-[140%] break-keep">{log.title}</p>
                    <p className="mt-1 text-[13px] text-[#99A1AF] leading-[140%]">
                      {formatOccurredAt(log.occurred_at)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`text-[16px] font-bold leading-[140%] ${
                        isIn ? 'text-[#8259F5]' : 'text-[#1E2939]'
                      }`}
                    >
                      {isIn ? '+' : '-'}
                      {log.amount.toLocaleString()}P
                    </p>
                    <p className="mt-1 text-[13px] text-[#99A1AF] leading-[140%]">
                      {log.balance_after.toLocaleString()}P
                    </p>
                  </div>
                </article>
              )
            })}
            {hasMore && (
              <div className="flex justify-center pt-2 pb-4">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-1 h-10 px-5 rounded-full border border-[#E5E7EB] bg-white text-[14px] text-[#364153] font-medium hover:bg-[#F9FAFB] transition disabled:opacity-60"
                >
                  {loadingMore ? '불러오는 중...' : '더보기'}
                  {!loadingMore && (
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="#364153" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 6L8 10L12 6" />
                    </svg>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <FloatingActions bottomOffset={24} />
    </div>
  )
}

/**
 * "2026-05-07T01:23:45+09:00" → "2026.05.07 10:23"
 * 한국 사용자 대상 페이지 — 로컬 시간 기준으로 표시.
 */
function formatOccurredAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`
}
