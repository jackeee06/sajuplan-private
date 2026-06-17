import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import {
  ApiError,
  settlementApi,
  counselorPayoutApi,
  type MyPayoutInfo,
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
 *    공제계 토글 (원천세 3.3% + 추천인 수수료) — 부가세·회선비는 2026-06-10 정산 단순화로 폐지
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
  /** 헤더 "지금 당겨받기 가능(선지급)" 숫자 — 선지급 게이팅과 동일한 공식 값. */
  const [payoutInfo, setPayoutInfo] = useState<MyPayoutInfo | null>(null)

  useEffect(() => {
    let mounted = true
    settlementApi.summary().then((s) => {
      if (mounted) setHeaderSummary(s)
    }).catch(() => {
      /* 헤더 카드 못 받아도 본 데이터는 표시 */
    })
    // 선지급 가능액 — 실패해도(권한/네트워크) 헤더의 나머지는 표시. null 이면 "—" 처리.
    counselorPayoutApi.available().then((p) => {
      if (mounted) setPayoutInfo(p)
    }).catch(() => {
      /* 선지급 칸만 비움 */
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
        {/* ── 수익금 요약 카드 (2026-06-14 계층형 — 마이페이지 메인과 동일 모델) ──
            "이번달 정산금액" 단일 숫자가 총잔여·당월·정산예상을 떠안아 혼란 → 행동 기준 분해.
              총잔여(balance) = 이번 정산 예정(전월까지) + 당월 적립 중(순액)
              · 모든 숫자는 순액(추천·정산 이미 반영). 추천수당은 "수익금 내역" 리스트에만 1회 기록.
              · 세후 입금 예상 = 상담사가 제일 궁금한 "통장에 꽂히는 돈". */}
        <section className="rounded-[16px] bg-[#F9FAFB] px-5 py-4">
          {(() => {
            const balance = headerSummary?.balance ?? 0                                  // 총잔여
            const thisMonthNet = (headerSummary?.this_month ?? 0)
              + (headerSummary?.referral_earn ?? 0)
              - (headerSummary?.referral_deduct ?? 0)                                      // 당월 적립 중 (순액)
            const pendingSettle = Math.max(0, balance - thisMonthNet)                      // 이번 정산 예정 (전월까지)
            const afterTax = Math.max(0, balance - Math.floor(balance * 0.033))            // 세후 입금 예상 (약)
            return (
              <>
                {/* 메인: 내 수익금 (총 잔여) */}
                <p className="text-[13px] leading-[140%] text-[#6A7282]">
                  내 수익금 <span className="text-[#99A1AF]">(받을 수 있는 전체)</span>
                </p>
                <p className="mt-1 text-[26px] font-bold text-[#8259F5] tabular-nums leading-[118%]">
                  {balance.toLocaleString()}원
                </p>
                <p className="mt-1 text-[11px] text-[#B0B8C1]">
                  원천세 3.3% 공제 후 약 {afterTax.toLocaleString()}원 입금 예상
                </p>

                {/* 분해 2칸 — 합치면 위 총잔여 */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-[12px] bg-white border border-[#F3F4F6] px-3 py-2.5">
                    <p className="text-[11px] text-[#6A7282]">이번 정산 예정</p>
                    <p className="mt-0.5 text-[22px] font-bold text-[#1E2939] tabular-nums leading-tight">
                      {pendingSettle.toLocaleString()}원
                    </p>
                    <p className="mt-0.5 text-[10px] text-[#B0B8C1]">전월까지 · 곧 정산</p>
                  </div>
                  <div className="rounded-[12px] bg-white border border-[#F3F4F6] px-3 py-2.5">
                    <p className="text-[11px] text-[#6A7282]">당월 적립 중</p>
                    <p className="mt-0.5 text-[22px] font-bold text-[#1E2939] tabular-nums leading-tight">
                      {thisMonthNet.toLocaleString()}원
                    </p>
                    <p className="mt-0.5 text-[10px] text-[#B0B8C1]">이번 달 · 쌓이는 중</p>
                  </div>
                </div>

                {/* 선지급 가능 — 차단 시 사유 표시 + 신청 막음, 정상 시 신청(탭→선지급 화면) */}
                {payoutInfo?.is_blocked ? (
                  <div className="mt-2 w-full rounded-[12px] bg-white border border-[#F3F4F6] px-3 py-2.5">
                    <p className="text-[11px] text-[#6A7282]">선지급 가능 (지금 당겨받기)</p>
                    <p className="mt-0.5 text-[22px] font-bold text-[#9CA3AF] tabular-nums leading-tight">
                      {payoutInfo.available_amount.toLocaleString()}원
                    </p>
                    <p className="mt-1 text-[11px] text-[#9CA3AF] flex items-start gap-1">
                      <span aria-hidden>🔒</span>
                      <span>{payoutInfo.block_reason ?? '선지급 신청이 제한됩니다.'}</span>
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate('/counselor/mypage/payout')}
                    className="mt-2 w-full text-left rounded-[12px] bg-white border border-[#F3F4F6] px-3 py-2.5 flex items-center justify-between active:bg-[#F9FAFB]"
                  >
                    <div>
                      <p className="text-[11px] text-[#6A7282]">선지급 가능 (지금 당겨받기)</p>
                      <p className="mt-0.5 text-[22px] font-bold text-[#1E2939] tabular-nums leading-tight">
                        {payoutInfo ? `${payoutInfo.available_amount.toLocaleString()}원` : '—'}
                      </p>
                    </div>
                    {payoutInfo?.has_pending_request ? (
                      <span className="text-[11px] px-2.5 h-8 rounded-full bg-[#FEF9C3] text-[#A16207] font-medium inline-flex items-center">처리 대기</span>
                    ) : (
                      <span className="px-3 h-8 rounded-full bg-[#8259F5] text-white text-[12px] font-medium inline-flex items-center">신청</span>
                    )}
                  </button>
                )}
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
  const [monthly, setMonthly] = useState<{ month: string; count: number; earn: number }[]>([])
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
        setMonthly(r.monthly ?? [])
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
          className="flex-1 min-w-0 h-11 px-3 rounded-[12px] bg-[#F9FAFB] border border-[#F3F4F6] text-[13px] text-[#1E2939] focus:outline-none focus:border-[#8259F5]"
        />
        <span className="shrink-0 text-[#99A1AF]">~</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="flex-1 min-w-0 h-11 px-3 rounded-[12px] bg-[#F9FAFB] border border-[#F3F4F6] text-[13px] text-[#1E2939] focus:outline-none focus:border-[#8259F5]"
        />
        <button
          type="button"
          onClick={() => {
            setAppliedFrom(fromDate)
            setAppliedTo(toDate)
            setPage(1)
          }}
          className="shrink-0 h-11 px-4 rounded-[12px] bg-[#1E2939] text-white text-[13px] font-medium"
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

      {/* 월별 수익 소계 — 페이지와 무관하게 "전체" 기준. "5월 합 N원" 바로 확인 (정산 증빙) */}
      {monthly.length > 0 && (
        <section className="rounded-[12px] bg-[#f3f0ff] border border-[#e9d5ff] px-3.5 py-3 mb-1">
          <p className="text-[12px] font-semibold text-[#7c3aed] mb-1.5">📅 월별 수익금 합계 (전체 기준)</p>
          <ul className="flex flex-col gap-1">
            {monthly.map((m) => (
              <li key={m.month} className="flex items-center justify-between text-[13px]">
                <span className="text-[#6A7282]">{m.month.replace('-', '년 ')}월 · {m.count}건</span>
                <span className="font-bold text-[#1E2939] tabular-nums">{m.earn.toLocaleString()}원</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-[#9CA3AF]">※ 각 달 합계 = 그 달 정산 대상 수익금 (아래 건별 내역의 월별 합과 동일)</p>
        </section>
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
            const isReferral = (it as { rel_table?: string | null }).rel_table === 'counselor_referral'
            if (isReferral) {
              // 추천 수당 행 — 별도 스타일
              return (
                <li
                  key={it.id}
                  className={`grid grid-cols-[1.4fr_1.3fr_1fr_0.6fr_0.9fr] gap-2 px-4 py-3 border-b border-[#F3F4F6] items-center ${
                    isNegative ? 'bg-rose-50/60' : 'bg-emerald-50/60'
                  }`}
                >
                  <span className="text-[12px] text-[#1E2939] tabular-nums">
                    {formatDateTime(it.created_at)}
                  </span>
                  <span className={`text-[12px] font-medium truncate ${isNegative ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {isNegative ? '추천 수당 차감' : '추천 수당'}
                  </span>
                  <span className="text-[12px] text-[#6A7282] truncate col-span-2">
                    {it.content?.replace(/\[추천 수당[^\]]*\]\s?/, '') ?? ''}
                  </span>
                  <span className={`text-right text-[13px] font-bold tabular-nums ${
                    isNegative ? 'text-rose-600' : 'text-emerald-600'
                  }`}>
                    {isNegative ? '' : '+'}{it.amount.toLocaleString()}원
                  </span>
                </li>
              )
            }
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
                <span className="text-center flex flex-col items-center gap-0.5">
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
                  {/* 등급 뱃지 — 실시간 승급 구간 혼동 방지 */}
                  {it.grade_at_session && (
                    <span className="inline-block px-1 py-[1px] rounded text-[10px] font-medium text-[#8259F5] bg-[#f3f0ff]">
                      {({'preliminary':'예비','partner1':'P1','partner2':'P2','partner3':'P3','partner4':'P4','partner5':'P5'} as Record<string,string>)[it.grade_at_session] ?? it.grade_at_session}
                    </span>
                  )}
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
  // [공제계] = 원천세 3.3% 하나뿐. (2026-06-14 정리 — 사장님 합의)
  //   ▸ 정산비전체(price_tot)는 이미 추천수당 차감(기타정산비)이 반영된 순액이다.
  //     그래서 공제계에 추천수당을 또 넣으면 "정산비전체 − 공제계 ≠ 실수령" 4원 착시가 났다.
  //     (옛 표기: 공제계 = 원천세 329 + 추천 4 = 333 → 9,996−333=9,663 ≠ 실수령 9,667)
  //   ▸ 공제계 = 원천세만(329) 으로 두면 9,996 − 329 = 9,667 로 화면이 산수적으로 맞아떨어진다.
  //     추천수당은 위 4분할 "기타정산비(-)" 와 헤더 카드에서 별도 표시하므로 정보 손실 없음.
  //   ▸ 실제 입금액(estimated_payout)은 API 가 price_tot − 원천세 로 계산 — 변동 없음(표시만 정리).
  const deduction = bd?.withholding_tax ?? 0
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
              <div className="px-5 pb-3 flex gap-4 text-[12px]">
                {/* 공제계 = 원천세만. 추천수당은 위 "기타정산비(-)" 로 이미 반영되어 여기 넣지 않음. */}
                <DeductionItem label="원천세(3.3%)" value={bd.withholding_tax} />
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
              <div className="px-5 pb-4 text-[12px] leading-[190%] text-[#4A5565]">
                <p>· 정산비전체 − 원천세(3.3%) = 예상 실수령액</p>
                <p>· 원천세(3.3%)는 법적 원천징수입니다</p>
                <p>· 추천 수당은 "기타정산비"에 이미 반영됩니다 (세금 아님)</p>
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
            {(bd?.price_tot ?? 0) > 0 && (
              <p className="mt-1 text-[11px] opacity-60 tabular-nums">
                수익금 {(bd?.price_tot ?? 0).toLocaleString()}원 → 원천세 공제 후 {(summary.estimated_payout ?? 0).toLocaleString()}원
              </p>
            )}
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
                    <span className="text-center flex flex-col items-center gap-0.5">
                      {it.preflag === 'Y' ? (
                        <span className="inline-block px-1.5 py-[1px] rounded-full text-[11px] font-semibold text-[#2E7D32] bg-[#E8F5E9]">
                          선불
                        </span>
                      ) : (
                        <span className="inline-block px-1.5 py-[1px] rounded-full text-[11px] font-semibold text-[#E65100] bg-[#FFF3E0]">
                          후불
                        </span>
                      )}
                      {/* 등급 뱃지 — 실시간 승급 구간별 수수료율이 다를 수 있어 혼란 방지 */}
                      {it.grade_at_session && (
                        <span className="inline-block px-1 py-[1px] rounded text-[10px] font-medium text-[#8259F5] bg-[#f3f0ff]">
                          {({'preliminary':'예비','partner1':'P1','partner2':'P2','partner3':'P3','partner4':'P4','partner5':'P5'} as Record<string,string>)[it.grade_at_session] ?? it.grade_at_session}
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
  // 실시간 추천수익금 — 상담별 적립(+)/차감(−). 핸드북 promotion/02-referral.
  if (s.includes('추천수익금 차감')) return '추천수익금 차감'
  if (s.includes('추천수익금')) return '추천수익금 적립'
  return s
    .replace('상담코인 증가', '수익금')
    .replace('상담코인 차감', '환불')
}
