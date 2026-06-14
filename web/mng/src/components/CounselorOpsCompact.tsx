import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'

interface OpsSummary {
  counselor: { id: number; mb_id: string | null; nickname: string | null; grade_label: string }
  point: { free_balance: number; paid_balance: number; earning_balance: number; total: number; total_earned: number; total_used: number }
  today: { consultations: number }
  month: {
    consultations: number
    amt_total: number
    revenue_rate_pct: number
    est_price_tot: number
    est_withholding: number
    est_payout: number
  }
  recent_credits: Array<{
    id: number
    content: string
    earn_point: number
    rel_table: string
    rel_id: string
    created_at: string
  }>
  // 상담사 화면 미러 — 상담사 마이페이지와 같은 숫자 (통화 응대용)
  mirror?: {
    balance: number
    this_month_net: number
    pending_settle: number
    after_tax: number
    payout_available: number
    payout_blocked: boolean
    payout_block_reason: string | null
  }
}

const won = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('ko-KR')

/** 오늘부터 이번달 말일까지 남은 일수 (정산 D-day) — 상담사 화면과 동일 계산 */
function daysUntilMonthEnd(): number {
  const now = new Date()
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return Math.max(0, Math.ceil((last.getTime() - now.getTime()) / 86_400_000))
}

/**
 * 상담사 상세 페이지 상단에 표시되는 조밀한 운영 현황 패널.
 *   - KPI 4개 한 줄 (보유 / 오늘 / 이번달 매출 / 정산 예상)
 *   - 정산 산식 접힘 → 클릭 시 한 줄 요약
 *   - 최근 적립 1건 + "전체 이력 →" 링크
 *   - 사진 카드 직후 ~80px 높이 (정산 산식 펼치면 +30px)
 */
export default function CounselorOpsCompact({ memberId }: { memberId: number }) {
  const [data, setData] = useState<OpsSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const fetchData = () => {
    if (!Number.isFinite(memberId) || memberId <= 0) return
    setError(null)
    api<OpsSummary>(`/admin/counselors/${memberId}/ops-summary`)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }
  useEffect(fetchData, [memberId])

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
        운영 현황 로드 실패: {error}
      </div>
    )
  }
  if (!data) {
    return <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-400">운영 현황 불러오는 중…</div>
  }

  const c = data.counselor
  const recent = data.recent_credits[0] ?? null

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700 overflow-hidden">
      {/* 한 줄 KPI — 상담사 화면 미러(통화 응대용) + 관리자 고유(건수/매출/코인).
          숫자는 상담사 마이페이지와 같은 함수 결과(mirror)라 절대 어긋나지 않음. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3.5 py-2 text-[13px]">
        {data.mirror ? (
          <>
            <span className="inline-flex items-center gap-1" title="상담사가 보는 '내 수익금' (받을 수 있는 전체 = 매월 정산 대상)">
              <span className="text-gray-500">💰 내 수익금</span>
              <span className="font-semibold text-amber-700 tabular-nums">{num.format(data.mirror.balance)}원</span>
              <span className="text-[11px] text-gray-400">(세후 ~{num.format(data.mirror.after_tax)})</span>
            </span>
            <span className="inline-flex items-center gap-1" title="전월까지 쌓인 정산 예정분 (곧 정산)">
              <span className="text-gray-500">이번 정산예정</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{num.format(data.mirror.pending_settle)}원</span>
            </span>
            <span className="inline-flex items-center gap-1" title="이번 달 쌓이는 중 (순액, 세전)">
              <span className="text-gray-500">당월 적립중</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{num.format(data.mirror.this_month_net)}원</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="text-gray-500">선지급</span>
              <span className={`font-semibold tabular-nums ${data.mirror.payout_available > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                {num.format(data.mirror.payout_available)}원
              </span>
              {data.mirror.payout_blocked && (
                <span className="text-[11px] text-rose-500 cursor-help" title={data.mirror.payout_block_reason ?? '선지급 신청 제한'}>
                  🔒신청제한
                </span>
              )}
            </span>
            <span className="inline-flex items-center gap-1 text-[12px] text-gray-400">
              <span>📞 오늘 {data.today.consultations}/당월 {data.month.consultations}건</span>
              <span>· 총매출 {won.format(data.month.amt_total)}</span>
              <span>· 코인 {num.format(data.point.total)}</span>
              <span>· 정산까지 <span className="font-semibold text-brand-600">D-{daysUntilMonthEnd()}</span></span>
            </span>
          </>
        ) : (
          /* mirror 미수신 시 폴백 — 기본 수익금만 */
          <span className="inline-flex items-center gap-1">
            <span className="text-gray-500">💰 수익금</span>
            <span className="font-semibold text-amber-700 tabular-nums">{num.format(data.point.earning_balance)}원</span>
          </span>
        )}

        <button
          onClick={() => setOpen((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 px-2 py-0.5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          정산 상세
        </button>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 px-2 py-0.5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
          aria-label="새로고침"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* 펼침 영역 — 정산 산식 + 최근 적립 1건 */}
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/30 px-3.5 py-2 text-[12px] space-y-1">
          {data.mirror && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-gray-600 dark:text-gray-300">
              <span className="text-gray-500">수익금 구성 ({c.grade_label}):</span>
              <span className="font-mono">
                총잔여 {num.format(data.mirror.balance)} = 이번정산예정 {num.format(data.mirror.pending_settle)} + 당월적립 {num.format(data.mirror.this_month_net)}
                {' '}· 세후 입금예상 <span className="text-amber-700 font-semibold">{num.format(data.mirror.after_tax)}원</span> (−원천세 3.3%)
              </span>
            </div>
          )}
          {recent && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-gray-600 dark:text-gray-300">
              <span className="text-gray-500">최근 적립:</span>
              <span className="text-gray-700 dark:text-gray-200">
                {new Date(recent.created_at).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
              <span className="text-emerald-700 font-semibold tabular-nums">+{num.format(recent.earn_point)}P</span>
              <span className="text-gray-500">{recent.content}</span>
              <span className="text-[11px] text-gray-400">({recent.rel_table} #{recent.rel_id})</span>
              <Link
                to={`/points/history?mb_id=${encodeURIComponent(c.mb_id ?? '')}`}
                className="ml-auto text-brand-600 hover:underline"
              >
                전체 이력 →
              </Link>
            </div>
          )}
          {!recent && (
            <div className="text-gray-400">적립 이력 없음</div>
          )}
        </div>
      )}
    </div>
  )
}
