import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import {
  ApiError,
  settlementApi,
  type SettlementIncomeItem,
  type SettlementSummary,
} from '../lib/api'

/**
 * 정산내역 (상담사 마이페이지 → 정산내역).
 *
 *   /counselor/mypage/settlement/history?tab=income|realtime
 *   (legacy: /mypage/settlement/history → 자동 redirect, 호환용)
 *
 * 사용자 시안 (thesaju 의 counselor_settlement.php + counselor_settlement_03.php) 을
 * 사주플랜 디자인 시스템 (보라 #8259F5 / Pretendard / radius 16-20) 으로 재구성:
 *
 *  - 상단 탭: [코인수익] [실시간 코인 정산]
 *  - 카드: 이번달 누적 코인 (전달 / 이달)
 *
 *  ── 코인수익 탭 ──
 *    필터: 전체 / 선불 / 후불
 *    기간 검색 (yyyy-mm-dd ~)
 *    카드형 리스트 (날짜 + 상담유형 + 고객명 + 구분뱃지 + 수익금)
 *
 *  ── 실시간 코인 정산 탭 ──
 *    월 셀렉트 (이전/다음)
 *    4분할 카드: 쿠폰상담 / 충전+후불 상담 / 기타정산비 / 정산비전체
 *    공제계 토글 (부가세 + 원천세 + 회선비)
 *    예상 실수령액 박스
 *    선/후불 칩 + 정산 대상 리스트 (consultation 매칭 row)
 */

const PAGE_SIZE = 15

type Tab = 'income' | 'realtime'
type MdFilter = 'all' | 'Y' | 'N'

export default function SettlementHistory() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab: Tab = searchParams.get('tab') === 'realtime' ? 'realtime' : 'income'
  const [tab, setTab] = useState<Tab>(initialTab)

  /** 헤더 카드용 — 항상 현재 월 기준으로 1회 fetch. */
  const [headerSummary, setHeaderSummary] = useState<SettlementSummary | null>(null)

  useEffect(() => {
    let mounted = true
    settlementApi.summary().then((s) => {
      if (mounted) setHeaderSummary(s)
    }).catch(() => {
      /* 헤더 카드 못 받아도 본 데이터는 표시 */
    })
    return () => { mounted = false }
  }, [])

  // 탭 변경 → URL 동기화
  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

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
          {tab === 'realtime' ? '실시간 정산' : '수익금 내역'}
        </h1>
      </header>

      {/* 상단 탭 — 활성: 보라 텍스트 + 하단 보라 보더 */}
      <nav className="grid grid-cols-2 border-b border-[#F3F4F6] bg-white">
        {(['income', 'realtime'] as Tab[]).map((t) => {
          const on = tab === t
          const label = t === 'income' ? '수익금 내역' : '실시간 정산'
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`relative h-[44px] flex items-center justify-center text-[15px] ${
                on ? 'text-[#8259F5] font-bold' : 'text-[#99A1AF] font-medium'
              }`}
            >
              {label}
              {on && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#8259F5]" />}
            </button>
          )
        })}
      </nav>

      <main className="flex-1 px-4 pt-3 flex flex-col gap-4">
        {/* 누적 카드 — 시안의 "이번달 누적 코인 / 전달 / 이달" 그대로
            [2026-05-28] 상담사 요청: 원천징수 3.3% 공제 안내 + 실수령 예상 같이 표시 */}
        <section className="rounded-[16px] bg-[#F9FAFB] px-5 py-4">
          <p className="text-[14px] leading-[140%] text-[#6A7282]">이번달 누적 수익금</p>
          <div className="mt-2 flex items-baseline gap-6">
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] text-[#99A1AF]">전달</span>
              <span className="text-[15px] font-semibold text-[#1E2939] tabular-nums">
                {(headerSummary?.prev_month ?? 0).toLocaleString()}원
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] text-[#99A1AF]">이달</span>
              <span className="text-[15px] font-semibold text-[#1E2939] tabular-nums">
                {(headerSummary?.this_month ?? 0).toLocaleString()}원
              </span>
            </div>
          </div>
          {(() => {
            const thisMonth = Number(headerSummary?.this_month ?? 0)
            const netExpected = Math.floor(thisMonth * 0.967)
            return (
              <>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-[13px] text-[#99A1AF]">실수령 예상</span>
                  <span className="text-[15px] font-semibold text-[#8259F5] tabular-nums">
                    {netExpected.toLocaleString()}원
                  </span>
                </div>
                <p className="mt-2 text-[12px] leading-[150%] text-[#9CA3AF]">
                  ※ 정산 시 원천징수 3.3% 공제 후 입금됩니다.
                </p>
              </>
            )
          })()}
        </section>

        {tab === 'income' ? <IncomeTab /> : <RealtimeTab />}
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav myHref="/counselor/mypage" />
    </div>
  )
}

// ─────────────────────────────────────────────
// 코인수익 탭
// ─────────────────────────────────────────────

function IncomeTab() {
  const navigate = useNavigate()
  const [md, setMd] = useState<MdFilter>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<SettlementIncomeItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    settlementApi
      .income({
        page,
        limit: PAGE_SIZE,
        md: md === 'all' ? null : md,
        from_date: appliedFrom || null,
        to_date: appliedTo || null,
      })
      .then((r) => {
        if (!mounted) return
        setItems(r.items)
        setTotal(r.total)
      })
      .catch((e) => {
        if (!mounted) return
        if (e instanceof ApiError && e.status === 401) {
          navigate('/login', { replace: true, state: { from: '/counselor/mypage/settlement/history' } })
          return
        }
        setError(e instanceof Error ? e.message : '내역을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [page, md, appliedFrom, appliedTo, navigate])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      {/* 전체 / 선불 / 후불 칩 (consultation.preflag — 'Y'=선불, 'N'=후불) */}
      <div className="grid grid-cols-3 gap-2">
        {(['all', 'Y', 'N'] as MdFilter[]).map((v) => {
          const on = md === v
          const label = v === 'all' ? '전체' : v === 'Y' ? '선불' : '후불'
          return (
            <button
              key={v}
              type="button"
              onClick={() => { setMd(v); setPage(1) }}
              className={`h-10 rounded-full text-[14px] font-medium transition ${
                on
                  ? 'bg-[#8259F5] text-white border border-[#8259F5]'
                  : 'bg-white text-[#6A7282] border border-[#E5E7EB]'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* 기간 검색 */}
      <section className="flex items-center gap-2">
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="flex-1 h-11 px-3 rounded-[12px] bg-[#F9FAFB] border border-[#F3F4F6] text-[13px] text-[#1E2939] focus:outline-none focus:border-[#8259F5]"
        />
        <span className="text-[#99A1AF]">~</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="flex-1 h-11 px-3 rounded-[12px] bg-[#F9FAFB] border border-[#F3F4F6] text-[13px] text-[#1E2939] focus:outline-none focus:border-[#8259F5]"
        />
        <button
          type="button"
          onClick={() => {
            setAppliedFrom(fromDate)
            setAppliedTo(toDate)
            setPage(1)
          }}
          className="h-11 px-4 rounded-[12px] bg-[#1E2939] text-white text-[13px] font-medium"
        >
          검색
        </button>
      </section>
      {(appliedFrom || appliedTo) && (
        <button
          type="button"
          onClick={() => {
            setFromDate('')
            setToDate('')
            setAppliedFrom('')
            setAppliedTo('')
            setPage(1)
          }}
          className="-mt-2 self-start text-[12px] text-[#6A7282] underline"
        >
          기간 초기화
        </button>
      )}

      {/* 리스트 — 시안의 열 구성 (일자/상담유형/고객명/구분/수익금) */}
      <section className="-mx-4">
        <div className="grid grid-cols-[1.4fr_1.3fr_1fr_0.6fr_0.9fr] gap-2 px-4 py-2 bg-[#F9FAFB] border-y border-[#F3F4F6] text-[12px] font-semibold text-[#8259F5]">
          <span>일자</span>
          <span>내역</span>
          <span>고객명</span>
          <span className="text-center">구분</span>
          <span className="text-right">수익금</span>
        </div>

        {loading && (
          <p className="py-12 text-center text-[14px] text-[#99A1AF]">불러오는 중…</p>
        )}
        {!loading && error && (
          <p className="py-12 text-center text-[14px] text-[#FB2C36]">{error}</p>
        )}
        {!loading && !error && items.length === 0 && (
          <p className="py-12 text-center text-[14px] text-[#99A1AF]">자료가 없습니다.</p>
        )}

        <ul>
          {items.map((it) => {
            const isNegative = it.amount < 0
            return (
              <li
                key={it.id}
                className="grid grid-cols-[1.4fr_1.3fr_1fr_0.6fr_0.9fr] gap-2 px-4 py-3 border-b border-[#F3F4F6] items-center"
              >
                <span className="text-[12px] text-[#1E2939] tabular-nums">
                  {formatDateTime(it.created_at)}
                </span>
                <span className="text-[13px] text-[#1E2939] truncate">{shortContent(it.content)}</span>
                <span className="text-[13px] text-[#1E2939] truncate">{it.customer_name ?? '-'}</span>
                <span className="text-center">
                  {it.preflag === 'Y' && (
                    <span className="inline-block px-1.5 py-[1px] rounded-full text-[11px] font-semibold text-[#2E7D32] bg-[#E8F5E9]">
                      선불
                    </span>
                  )}
                  {it.preflag === 'N' && (
                    <span className="inline-block px-1.5 py-[1px] rounded-full text-[11px] font-semibold text-[#E65100] bg-[#FFF3E0]">
                      후불
                    </span>
                  )}
                  {!it.preflag && <span className="text-[12px] text-[#99A1AF]">-</span>}
                </span>
                <span className={`text-right text-[13px] font-bold tabular-nums ${
                  isNegative ? 'text-[#FB2C36]' : 'text-[#8259F5]'
                }`}>
                  {it.amount.toLocaleString()}원
                </span>
              </li>
            )
          })}
        </ul>

        {!loading && total > PAGE_SIZE && (
          <div className="mt-4">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </section>
    </>
  )
}

// ─────────────────────────────────────────────
// 실시간 코인 정산 탭
// ─────────────────────────────────────────────

function RealtimeTab() {
  const navigate = useNavigate()
  /** YYYY-MM. 기본: 이번달. */
  const [month, setMonth] = useState<string>(() => new Date().toISOString().slice(0, 7))
  const [summary, setSummary] = useState<SettlementSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deductionOpen, setDeductionOpen] = useState(false)
  const [formulaOpen, setFormulaOpen] = useState(false)

  // 정산 대상 리스트 (선/후불 필터)
  const [md, setMd] = useState<MdFilter>('all')
  const [items, setItems] = useState<SettlementIncomeItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    settlementApi.summary(month)
      .then((s) => {
        if (mounted) setSummary(s)
      })
      .catch((e) => {
        if (!mounted) return
        if (e instanceof ApiError && e.status === 401) {
          navigate('/login', { replace: true, state: { from: '/counselor/mypage/settlement/history' } })
          return
        }
        setError(e instanceof Error ? e.message : '정산 정보를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [month, navigate])

  // 선택한 월의 consultation 매칭 row 만 — 코인수익 income 에서 fr/to=해당월 로 한정.
  useEffect(() => {
    let mounted = true
    setItemsLoading(true)
    const from = `${month}-01`
    const last = new Date(`${month}-01T00:00:00`)
    last.setMonth(last.getMonth() + 1)
    last.setDate(0)
    const to = last.toISOString().slice(0, 10)
    settlementApi
      .income({
        page: 1,
        limit: 50,
        md: md === 'all' ? null : md,
        from_date: from,
        to_date: to,
      })
      .then((r) => {
        if (!mounted) return
        // consultation 매칭 row 만 (preflag 가 있는 것). 그 외는 기타정산비 영역.
        setItems(r.items.filter((it) => it.preflag === 'Y' || it.preflag === 'N'))
      })
      .catch(() => {
        if (mounted) setItems([])
      })
      .finally(() => {
        if (mounted) setItemsLoading(false)
      })
    return () => { mounted = false }
  }, [month, md])

  const monthLabel = useMemo(() => {
    const [y, m] = month.split('-')
    return `${y}년 ${Number(m)}월`
  }, [month])

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    setMonth(ym)
  }

  const bd = summary?.payout_breakdown
  const deduction = (bd?.vat_amount ?? 0) + (bd?.withholding_tax ?? 0) + (bd?.reply_fee ?? 0)
  const today = new Date().toISOString().slice(0, 7)
  const isCurrent = month === today

  return (
    <>
      {/* 월 선택 */}
      <section className="flex items-center gap-2 rounded-[12px] border border-[#F3F4F6] px-2 py-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="이전 달"
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F9FAFB]"
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
            <path d="M10 4L6 8L10 12" stroke="#6A7282" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <input
          type="month"
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className="flex-1 h-9 px-3 text-center text-[15px] font-medium text-[#1E2939] bg-transparent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="다음 달"
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F9FAFB]"
          disabled={month >= today}
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
            <path d="M6 4L10 8L6 12" stroke={month >= today ? '#D1D5DC' : '#6A7282'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </section>

      <section className="flex items-center gap-2">
        <h2 className="text-[16px] font-bold text-[#030712]">
          {monthLabel} 수익금 정산
        </h2>
        {isCurrent && (
          <span className="px-2 py-[2px] rounded-full text-[11px] font-semibold text-[#8259F5] bg-[#f3f0ff]">
            실시간
          </span>
        )}
      </section>

      {loading && (
        <p className="py-12 text-center text-[14px] text-[#99A1AF]">불러오는 중…</p>
      )}
      {!loading && error && (
        <p className="py-12 text-center text-[14px] text-[#FB2C36]">{error}</p>
      )}

      {!loading && !error && bd && (
        <>
          {/* 4분할 카드 */}
          <section className="rounded-[16px] border border-[#F3F4F6] bg-white">
            <div className="grid grid-cols-4 divide-x divide-[#F3F4F6] py-4">
              <SummaryCell label="쿠폰상담" value={bd.price_free} />
              <SummaryCell label="충전+후불 상담" value={bd.price_paid} />
              <SummaryCell label="기타정산비" value={bd.price_other} />
              <SummaryCell label="정산비전체" value={bd.price_tot} highlight />
            </div>
            <div className="border-t border-[#F3F4F6] px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[#6A7282]">공제계</span>
                <span className="text-[14px] font-semibold text-[#FB2C36] tabular-nums">
                  -{deduction.toLocaleString()}원
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDeductionOpen((v) => !v)}
                className="text-[12px] text-[#6A7282] flex items-center gap-1"
              >
                세부사항
                <svg viewBox="0 0 16 16" className={`w-3 h-3 transition-transform ${deductionOpen ? 'rotate-180' : ''}`} fill="none">
                  <path d="M4 6L8 10L12 6" stroke="#6A7282" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            {deductionOpen && (
              <div className="px-5 pb-3 grid grid-cols-3 gap-2 text-[12px]">
                <DeductionItem label="부가세(10%)" value={bd.vat_amount} />
                <DeductionItem label="원천세(3.3%)" value={bd.withholding_tax} />
                <DeductionItem label="회선비" value={bd.reply_fee} />
              </div>
            )}
            <div className="border-t border-[#F3F4F6] px-5 py-3 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setFormulaOpen((v) => !v)}
                className="text-[12px] text-[#8259F5] font-medium flex items-center gap-1"
              >
                <span className="w-4 h-4 inline-flex items-center justify-center rounded-full bg-[#f3f0ff] text-[10px]">?</span>
                정산구조 설명
              </button>
            </div>
            {formulaOpen && (
              <div className="px-5 pb-4 text-[12px] leading-[170%] text-[#4A5565]">
                <p>1) 쿠폰상담 = amt_free × {bd.royalty_free_pct}%</p>
                <p>2) 충전+후불 = amt_pro × {bd.royalty_pro_pct}%</p>
                <p>3) 정산비전체 = (1) + (2) + 기타정산비</p>
                <p>4) 공급가 = 정산비전체 ÷ 1.1, 부가세 = 정산비전체 − 공급가</p>
                <p>5) 원천세 3.3% = 공급가 × 0.033</p>
                <p>6) 회선비 = 정산비전체 50,000원 이상 시 20,000원</p>
                <p className="mt-1 font-semibold text-[#1E2939]">
                  실수령 = 공급가 − 원천세 − 회선비
                </p>
              </div>
            )}
          </section>

          {/* 예상 실수령액 */}
          <section
            className="rounded-[20px] px-5 py-5 text-center text-white"
            style={{ background: 'linear-gradient(135deg, #8259F5, #6B3FE4)' }}
          >
            <p className="text-[13px] opacity-80">예상 실수령액</p>
            <p className="mt-1 text-[26px] font-bold tabular-nums">
              {(summary.estimated_payout ?? 0).toLocaleString()}원
            </p>
          </section>

          {/* 선/후불 칩 (consultation.preflag — 'Y'=선불, 'N'=후불) */}
          <div className="grid grid-cols-3 gap-2">
            {(['all', 'Y', 'N'] as MdFilter[]).map((v) => {
              const on = md === v
              const label = v === 'all' ? '전체' : v === 'Y' ? '선불' : '후불'
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setMd(v)}
                  className={`h-10 rounded-full text-[14px] font-medium transition ${
                    on
                      ? 'bg-[#8259F5] text-white border border-[#8259F5]'
                      : 'bg-white text-[#6A7282] border border-[#E5E7EB]'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* 정산 대상 리스트 — 시안의 (일자/고객명/구분/정산코인) */}
          <section className="-mx-4">
            <div className="grid grid-cols-[1.4fr_1fr_0.6fr_1fr] gap-2 px-4 py-2 bg-[#F9FAFB] border-y border-[#F3F4F6] text-[12px] font-semibold text-[#8259F5]">
              <span>일자</span>
              <span>고객명</span>
              <span className="text-center">구분</span>
              <span className="text-right">정산금액</span>
            </div>
            {itemsLoading ? (
              <p className="py-10 text-center text-[14px] text-[#99A1AF]">불러오는 중…</p>
            ) : items.length === 0 ? (
              <p className="py-10 text-center text-[14px] text-[#99A1AF]">조회된 내역이 없습니다.</p>
            ) : (
              <ul>
                {items.map((it) => (
                  <li
                    key={it.id}
                    className="grid grid-cols-[1.4fr_1fr_0.6fr_1fr] gap-2 px-4 py-3 border-b border-[#F3F4F6] items-center"
                  >
                    <span className="text-[12px] text-[#1E2939] tabular-nums">{formatDateTime(it.created_at)}</span>
                    <span className="text-[13px] text-[#1E2939] truncate">{it.customer_name ?? '-'}</span>
                    <span className="text-center">
                      {it.preflag === 'Y' ? (
                        <span className="inline-block px-1.5 py-[1px] rounded-full text-[11px] font-semibold text-[#2E7D32] bg-[#E8F5E9]">
                          선불
                        </span>
                      ) : (
                        <span className="inline-block px-1.5 py-[1px] rounded-full text-[11px] font-semibold text-[#E65100] bg-[#FFF3E0]">
                          후불
                        </span>
                      )}
                    </span>
                    <span className="text-right text-[13px] font-bold text-[#8259F5] tabular-nums">
                      {it.amount.toLocaleString()}원
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  )
}

function SummaryCell({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-1">
      <span className="text-[11px] leading-[140%] text-[#6A7282] whitespace-nowrap">{label}</span>
      <span
        className={`mt-1 text-[14px] leading-[140%] font-bold tabular-nums ${
          highlight ? 'text-[#FB2C36]' : 'text-[#1E2939]'
        }`}
      >
        {value.toLocaleString()}원
      </span>
    </div>
  )
}

function DeductionItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center bg-[#F9FAFB] rounded-[8px] py-2">
      <span className="text-[11px] text-[#6A7282]">{label}</span>
      <span className="mt-0.5 text-[12px] font-semibold text-[#1E2939] tabular-nums">
        {value.toLocaleString()}원
      </span>
    </div>
  )
}

function formatDateTime(iso: string): string {
  if (!iso) return ''
  const dt = new Date(iso)
  if (isNaN(dt.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

// point_history.content 를 간결한 표시값으로 단축.
//  [전화/채팅] prefix 는 유지, "상담코인 증가/차감" 부분만 줄임.
//  [2026-05-28] 상담사 영역 용어 통일 — "코인" 단어 제거, "수익금"/"환불" 로 표기.
function shortContent(s: string | null | undefined): string {
  if (!s) return '-'
  return s
    .replace('상담코인 증가', '수익금')
    .replace('상담코인 차감', '환불')
}
