import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { api } from '../lib/api'
import { defaultLast7Days } from '../lib/dateRange'
import { DateRangeChips } from '../components/DateRangeChips'
import { DateField } from '../components/DateField'
import {
  Th,
  Td,
  Tr,
  TableShell,
  THead,
  TBody,
  EmptyRow,
  Chip,
  NumCell,
  PaginationBar,
  inputCls,
} from '../components/table'

/**
 * 정산 현황판 (2026-06-10 정산 단순화)
 *
 * 두 모드:
 *  - 이력: settlement_monthly (이미 계산/지급된 정산)
 *  - 이번 달 미리보기: cron 전에도 전체 상담사 정산예정액을 차감 없이 계산
 *
 * 공통 컬럼: 아이디 · 이름 · 해당월 · 정산예상금액 · 선지급(당겨감) · 원천세 · 실지급액 · 상태 · 액션
 */

interface HistItem {
  id: number
  member_id: number | null
  mb_id: string | null
  member_name: string | null
  member_nickname: string | null
  month: string
  price_tot: number
  withholding_tax: number
  price: number
  early_payout_total: number
  status: 'calculated' | 'paid' | 'voided'
  paid_at: string | null
  voided_at: string | null
  voided_by_name: string | null
  void_reason: string | null
  bank_name: string | null
  bank_holder: string | null
  bank_account: string | null
}
interface HistResp {
  items: HistItem[]
  total: number
  page: number
  limit: number
  summary: { total_price: number; total_price_tot: number; total_withholding: number }
}

interface PrevItem {
  member_id: number
  mb_id: string | null
  member_name: string | null
  member_nickname: string | null
  settle_amount: number
  early_payout_total: number
  withholding_tax: number
  price: number
  status: 'calculated' | 'paid' | 'voided' | 'pending'
  settlement_id: number | null
  voided_at: string | null
  voided_by_name: string | null
  void_reason: string | null
  bank_name: string | null
  bank_holder: string | null
  bank_account: string | null
}
interface PrevResp {
  month: string
  items: PrevItem[]
  summary: {
    count: number
    total_settle: number
    total_early_payout: number
    total_withholding: number
    total_price: number
  }
}

/** 중복지급 환수(회수) 대상 — 정산 미리보기 상단 패널 */
interface RecoveryItem {
  id: number
  member_id: number
  mb_id: string | null
  name: string | null
  amount: number
  reason: string | null
  origin_month: string | null
  bank_name: string | null
  bank_holder: string | null
  bank_account: string | null
}
interface RecoveryResp {
  items: RecoveryItem[]
  summary: { count: number; total_amount: number }
}

/** 두 모드를 한 테이블로 그리기 위한 공통 행 뷰모델 */
interface RowVM {
  key: string
  member_id: number | null
  mb_id: string | null
  name: string | null
  month: string
  settle: number // 정산예상(원금)
  early: number // 선지급 당겨감
  withholding: number
  price: number // 실지급
  status: 'calculated' | 'paid' | 'voided' | 'pending'
  settlementId: number | null
  voidReason?: string | null
  voidedBy?: string | null
  voidedAt?: string | null
  paidAt?: string | null
  bankName?: string | null
  bankHolder?: string | null
  bankAccount?: string | null
}

const PAGE_SIZE = Number(import.meta.env.VITE_LIST_PAGE_SIZE ?? 20)

/** 정산 가능한 마지막 달(KST 전월) 'YYYY-MM'. 이번 달은 마감 전이라 정산 불가 → 미리보기 기본값. */
function prevMonthKst(): string {
  const k = new Date(Date.now() + 9 * 3600 * 1000)
  k.setUTCDate(1) // 말일 오버플로 방지 후 전월로
  k.setUTCMonth(k.getUTCMonth() - 1)
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * 'YYYY-MM'(정산 대상 월) → 사람이 읽기 쉬운 정산일 라벨.
 * 정산 규칙: 매월 9일에 "전달 말일까지 쌓인 수익금"을 정산·지급.
 * 예) 2026-08 → 8월분을 9월 9일에 정산 지급. (헷갈림 방지: 화면 월표기가 8월이어도 실제 작업은 9월)
 */
function settleLabelKst(month: string): { pun: string; settleMonth: number; text: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  if (!m) return null
  const mo = Number(m[2])
  const settleMonth = mo === 12 ? 1 : mo + 1 // 정산일 = 다음 달 9일
  return { pun: `${mo}월분`, settleMonth, text: `${mo}월분 → ${settleMonth}월 9일 정산 지급분` }
}

export default function SettlementList() {
  // 정산 이력 메뉴 진입 시 기본 = 미리보기(이번 정산 작업 화면)가 먼저 보이게. (2026-09-09 사장님 요청)
  const [mode, setMode] = useState<'history' | 'preview'>('preview')
  // 미리보기 기본 = 전달(정산 가능한 마지막 달). 매월 9일 정산 워크플로우상 열자마자 전달이 떠 바로 정산.
  const [previewMonth, setPreviewMonth] = useState(prevMonthKst())

  const _init = defaultLast7Days()
  const [filter, setFilter] = useState({ stx: '', fr_date: _init.from, to_date: _init.to, page: 1 })
  const [pending, setPending] = useState({ stx: '', fr_date: _init.from, to_date: _init.to })

  const [hist, setHist] = useState<HistResp | null>(null)
  const [prev, setPrev] = useState<PrevResp | null>(null)
  const [recovery, setRecovery] = useState<RecoveryResp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0) // 강제 재조회용

  useEffect(() => {
    setLoading(true)
    setError(null)
    if (mode === 'preview') {
      api<PrevResp>(`/admin/settlements/preview?month=${previewMonth}`)
        .then(setPrev)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false))
      // 회수 대상은 월과 무관(누적 환수). 조용히 갱신(실패해도 정산 화면은 뜨게).
      api<RecoveryResp>('/admin/settlements/recovery-targets')
        .then(setRecovery)
        .catch(() => setRecovery(null))
    } else {
      const params = new URLSearchParams()
      if (filter.stx) {
        params.set('sfl', 'mb_id')
        params.set('stx', filter.stx)
      }
      if (filter.fr_date) params.set('fr_date', filter.fr_date)
      if (filter.to_date) params.set('to_date', filter.to_date)
      params.set('page', String(filter.page))
      params.set('limit', String(PAGE_SIZE))
      api<HistResp>(`/admin/settlements?${params}`)
        .then(setHist)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false))
    }
  }, [mode, previewMonth, filter, tick])

  const reload = () => setTick((t) => t + 1)
  const onSearch = () => setFilter((f) => ({ ...f, ...pending, page: 1 }))
  const onReset = () => {
    setPending({ stx: '', fr_date: '', to_date: '' })
    setFilter({ stx: '', fr_date: '', to_date: '', page: 1 })
  }

  const onMarkPaid = async (vm: RowVM) => {
    if (!vm.settlementId) return
    const ok = window.confirm(
      `[${vm.mb_id} / ${vm.month}] 정산하기\n\n` +
        `정산예상금액 ${vm.settle.toLocaleString()}원\n` +
        (vm.early > 0 ? `선지급 차감 -${vm.early.toLocaleString()}원\n` : '') +
        `원천세(3.3%) -${vm.withholding.toLocaleString()}원\n` +
        `실지급액 ${vm.price.toLocaleString()}원\n\n` +
        '통장 송금을 완료하셨나요?\n→ 확인 시 상담사 수익금에서 정산예상금액이 차감되고 지급완료로 기록됩니다.',
    )
    if (!ok) return
    try {
      await api(`/admin/settlements/${vm.settlementId}/mark-paid`, { method: 'PATCH' })
      reload()
    } catch (e) {
      alert(`정산하기 실패: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // 회수 대상 1건 회수완료 처리 (상쇄/협의 완료 → 목록에서 내림). 돈 이동 없음.
  const onResolveRecovery = async (r: RecoveryItem) => {
    const ok = window.confirm(
      `[${r.name ?? ''} / ${r.mb_id ?? ''}] 회수완료 처리\n\n` +
        `받아낼 금액 ${r.amount.toLocaleString()}원을 회수(상쇄/협의) 완료로 표시합니다.\n` +
        '→ 회수 대상 목록에서 사라집니다. 계속할까요?',
    )
    if (!ok) return
    try {
      await api(`/admin/settlements/recovery/${r.id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      })
      reload()
    } catch (e) {
      alert(`회수완료 실패: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // 미리보기에서 회원 1명 즉시 정산 (생성 + 차감 + 지급완료 한 번에)
  const onSettleNow = async (vm: RowVM) => {
    if (!vm.member_id) return
    const ok = window.confirm(
      `[${vm.mb_id} / ${vm.month}] 정산하기\n\n` +
        `정산예상금액 ${vm.settle.toLocaleString()}원\n` +
        (vm.early > 0 ? `선지급 차감 -${vm.early.toLocaleString()}원\n` : '') +
        `원천세(3.3%) -${vm.withholding.toLocaleString()}원\n` +
        `실지급액 ${vm.price.toLocaleString()}원\n\n` +
        '통장 송금을 완료하셨나요?\n→ 확인 시 상담사 수익금에서 정산예상금액이 차감되고 지급완료로 기록됩니다.',
    )
    if (!ok) return
    try {
      await api(`/admin/settlements/${vm.member_id}/settle-now?month=${vm.month}`, { method: 'POST' })
      reload()
    } catch (e) {
      alert(`정산하기 실패: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // 정산완료(paid) 상담사에게 "정산금 입금 완료" 인앱 + 푸시 알림 발송
  const onNotifyPaid = async (vm: RowVM) => {
    if (!vm.settlementId) return
    const ok = window.confirm(
      `[${vm.mb_id} / ${vm.month}] 정산완료 알리기\n\n` +
        `상담사에게 "정산금 ${vm.price.toLocaleString()}원 입금 완료" 알림(인앱 + 푸시)을 보냅니다.\n` +
        '통장 송금을 완료하셨나요?',
    )
    if (!ok) return
    try {
      await api(`/admin/settlements/${vm.settlementId}/notify-paid`, { method: 'POST' })
      alert('정산완료 알림을 보냈습니다.')
    } catch (e) {
      alert(`알림 실패: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const rows: RowVM[] =
    mode === 'preview'
      ? (prev?.items ?? []).map((p) => ({
          key: `p${p.member_id}`,
          member_id: p.member_id,
          mb_id: p.mb_id,
          name: p.member_name || p.member_nickname,
          month: previewMonth,
          settle: p.settle_amount,
          early: p.early_payout_total,
          withholding: p.withholding_tax,
          price: p.price,
          status: p.status,
          settlementId: p.settlement_id,
          voidReason: p.void_reason,
          voidedBy: p.voided_by_name,
          voidedAt: p.voided_at,
          bankName: p.bank_name,
          bankHolder: p.bank_holder,
          bankAccount: p.bank_account,
        }))
      : (hist?.items ?? []).map((h) => ({
          key: `h${h.id}`,
          member_id: h.member_id,
          mb_id: h.mb_id,
          name: h.member_name || h.member_nickname,
          month: h.month,
          settle: h.price_tot,
          early: h.early_payout_total,
          withholding: h.withholding_tax,
          price: h.price,
          status: h.status,
          settlementId: h.id,
          voidReason: h.void_reason,
          voidedBy: h.voided_by_name,
          voidedAt: h.voided_at,
          paidAt: h.paid_at,
          bankName: h.bank_name,
          bankHolder: h.bank_holder,
          bankAccount: h.bank_account,
        }))

  const totalPages = hist ? Math.max(1, Math.ceil(hist.total / PAGE_SIZE)) : 1

  const modeBtn = (m: 'history' | 'preview', label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`px-3 py-1.5 text-sm rounded-md font-medium border ${
        mode === m
          ? 'bg-brand-600 text-white border-brand-600'
          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-3">
      {/* 타이틀 */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">정산 현황</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          상담사 월 정산 — 정산예상금액 · 선지급(당겨감) · 원천세 · 실지급액
        </p>
      </div>

      {/* 모드 토글 + 미리보기 월선택 */}
      <div className="flex flex-wrap items-center gap-2">
        {modeBtn('history', '정산 이력')}
        {modeBtn('preview', '정산 미리보기')}
        {mode === 'preview' && (
          <input
            type="month"
            value={previewMonth}
            onChange={(e) => setPreviewMonth(e.target.value || prevMonthKst())}
            className={`${inputCls} !w-[160px] ml-1`}
          />
        )}
        {mode === 'preview' && settleLabelKst(previewMonth) && (
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-md px-2.5 py-1 whitespace-nowrap"
            title="매월 9일에 '전달 말일까지 쌓인 수익금'을 정산·지급합니다. 화면 월표기가 8월이어도 실제 정산 작업은 9월 9일입니다."
          >
            📌 {settleLabelKst(previewMonth)!.text}
          </span>
        )}
      </div>

      {/* 요약 칩 */}
      {mode === 'preview' && prev && (
        <div className="flex flex-wrap items-center gap-2">
          <Chip label="대상 상담사" value={prev.summary.count} />
          <SumPill label="정산예상 합계" amount={prev.summary.total_settle} />
          {prev.summary.total_early_payout > 0 && (
            <SumPill label="선지급 차감" amount={prev.summary.total_early_payout} />
          )}
          <SumPill label="원천세(3.3%)" amount={prev.summary.total_withholding} />
          <SumPill label="실지급 합계" amount={prev.summary.total_price} highlight />
        </div>
      )}
      {mode === 'history' && hist && (
        <div className="flex flex-wrap items-center gap-2">
          <Chip label="전체목록" active onClick={onReset} />
          <Chip label="총건수" value={hist.total} />
          <SumPill label="정산예상금액" amount={hist.summary.total_price_tot} />
          <SumPill label="원천세(3.3%)" amount={hist.summary.total_withholding} />
          <SumPill label="실지급액" amount={hist.summary.total_price} highlight />
        </div>
      )}

      {/* 이력 검색 (history) / 미리보기 안내 (preview) */}
      {mode === 'history' ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 w-fit max-w-full">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-[240px]">
              <label className="block text-[11px] font-medium text-gray-500 mb-1">회원아이디 검색</label>
              <input
                type="text"
                value={pending.stx}
                onChange={(e) => setPending({ ...pending, stx: e.target.value })}
                placeholder="검색어"
                className={inputCls}
                onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              />
            </div>
            <div className="w-[150px]">
              <label className="block text-[11px] font-medium text-gray-500 mb-1">시작 월</label>
              <DateField value={pending.fr_date} onChange={(v) => setPending({ ...pending, fr_date: v })} placeholder="시작일" />
            </div>
            <div className="w-[150px]">
              <label className="block text-[11px] font-medium text-gray-500 mb-1">종료 월</label>
              <DateField value={pending.to_date} onChange={(v) => setPending({ ...pending, to_date: v })} placeholder="종료일" />
            </div>
            <div className="ml-auto">
              <button onClick={onSearch} className="px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white inline-flex items-center gap-1.5 font-medium">
                <Search className="w-4 h-4" /> 검색
              </button>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <DateRangeChips
              from={pending.fr_date}
              to={pending.to_date}
              onPick={(r) => {
                const next = { ...pending, fr_date: r.from, to_date: r.to }
                setPending(next)
                setFilter((f) => ({ ...f, ...next, page: 1 }))
              }}
            />
          </div>
        </div>
      ) : (
        <div className="w-fit max-w-[560px] text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-2 leading-relaxed">
          ⓘ 실지급 = (정산예상 − 선지급) × (1 − 원천세 3.3%) · <b>1만원 이상</b>만 표시(미만 이월)
          <br /><b>[정산하기]</b> = 수익금 차감 + 지급완료 → 통장 송금 → <b>[정산완료 알리기]</b>로 상담사 알림
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm">{error}</div>
      )}

      {/* 테이블 */}
      <TableShell>
        <THead>
          <Th align="left">아이디</Th>
          <Th align="left">이름</Th>
          <Th align="left">해당월</Th>
          <Th align="right">정산예상금액</Th>
          <Th align="right">선지급(당겨감)</Th>
          <Th align="right">원천세</Th>
          <Th align="right">실지급액</Th>
          <Th align="center">상태</Th>
          <Th align="left">은행 / 계좌</Th>
          <Th align="center">액션</Th>
        </THead>
        <TBody>
          {loading && rows.length === 0 ? (
            <EmptyRow colSpan={10} loading />
          ) : rows.length === 0 ? (
            <EmptyRow colSpan={10} />
          ) : (
            rows.map((vm) => (
              <Tr key={vm.key}>
                <Td align="left">
                  {vm.member_id && vm.mb_id ? (
                    <Link to={`/members/counselors/${vm.member_id}`} className="text-brand-600 hover:underline font-medium inline-block max-w-[150px] truncate align-bottom" title={String(vm.mb_id ?? '')}>
                      {vm.mb_id}
                    </Link>
                  ) : (
                    <span className="inline-block max-w-[150px] truncate align-bottom text-gray-500" title={String(vm.mb_id ?? '')}>{vm.mb_id || '-'}</span>
                  )}
                </Td>
                <Td align="left">{vm.name || <span className="text-gray-300">-</span>}</Td>
                <Td align="left" className="text-gray-700 tabular-nums">{vm.month}</Td>
                <Td align="right"><NumCell value={vm.settle} bold /></Td>
                <Td align="right">
                  {vm.early > 0 ? (
                    <span className="text-rose-600 dark:text-rose-400 tabular-nums">-{vm.early.toLocaleString()}</span>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </Td>
                <Td align="right"><NumCell value={vm.withholding} /></Td>
                <Td align="right" className="font-bold text-brand-700 dark:text-brand-300 tabular-nums">
                  {vm.price.toLocaleString()}
                </Td>
                <Td align="center">
                  <StatusChip
                    status={vm.status}
                    title={
                      vm.status === 'paid' && vm.paidAt ? `지급일: ${vm.paidAt.slice(0, 10)}` :
                      undefined
                    }
                  />
                </Td>
                <Td align="left">
                  {vm.bankAccount ? (
                    <span className="text-xs text-gray-700 dark:text-gray-200 whitespace-nowrap tabular-nums" title={`${vm.bankName ?? ''} ${vm.bankAccount} ${vm.bankHolder ?? ''}`}>
                      {vm.bankName && <span className="text-gray-500">{vm.bankName} </span>}
                      <span className="font-medium text-gray-800 dark:text-gray-100">{vm.bankAccount}</span>
                      {vm.bankHolder && <span className="text-gray-400"> · {vm.bankHolder}</span>}
                    </span>
                  ) : (
                    <span className="text-[11px] text-amber-500" title="상담사 정보에서 계좌 등록 필요">계좌 미등록</span>
                  )}
                </Td>
                <Td align="center">
                  {mode === 'preview' ? (
                    <>
                      {vm.status === 'paid' && vm.settlementId ? (
                        <button
                          onClick={() => onNotifyPaid(vm)}
                          className="px-2 py-1 text-[11px] rounded bg-blue-600 hover:bg-blue-700 text-white font-medium whitespace-nowrap"
                          title="상담사에게 정산금 입금 완료 알림 (인앱 + 푸시)"
                        >정산완료 알리기</button>
                      ) : vm.settle > 0 ? (
                        <button
                          onClick={() => onSettleNow(vm)}
                          className="px-2 py-1 text-[11px] rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                          title={vm.status === 'voided' ? '무효화 후 재정산' : '수익금 차감 + 정산완료 (1명 즉시 정산)'}
                        >정산하기</button>
                      ) : (
                        <span className="text-[11px] text-gray-300">-</span>
                      )}
                    </>
                  ) : (
                    <>
                      {vm.status === 'calculated' && vm.settlementId && (
                        <button
                          onClick={() => onMarkPaid(vm)}
                          className="px-2 py-1 text-[11px] rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                          title="통장 송금 완료 + 수익금 차감"
                        >정산하기</button>
                      )}
                      {vm.status === 'paid' && vm.settlementId && (
                        <button
                          onClick={() => onNotifyPaid(vm)}
                          className="px-2 py-1 text-[11px] rounded bg-blue-600 hover:bg-blue-700 text-white font-medium whitespace-nowrap"
                          title="상담사에게 정산금 입금 완료 알림 (인앱 + 푸시)"
                        >정산완료 알리기</button>
                      )}
                      {vm.status === 'voided' && <span className="text-[11px] text-gray-400">잠금</span>}
                      {vm.status === 'pending' && <span className="text-[11px] text-gray-400">정산 전</span>}
                    </>
                  )}
                </Td>
              </Tr>
            ))
          )}
        </TBody>
      </TableShell>

      {mode === 'history' && hist && (
        <PaginationBar
          page={filter.page}
          totalPages={totalPages}
          total={hist.total}
          pageSize={PAGE_SIZE}
          onChange={(p) => setFilter((f) => ({ ...f, page: p }))}
          unit="건"
        />
      )}

      {/* 회수 대상 (중복지급 환수) — 미리보기 모드 하단, 폭은 내용만큼(w-fit) 좌측정렬 */}
      {mode === 'preview' && recovery && recovery.items.length > 0 && (
        <div className="w-fit max-w-full border border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-900/15 rounded-xl p-4 mt-4">
          <div className="flex items-baseline gap-2.5">
            <span className="text-sm font-semibold text-rose-700 dark:text-rose-300 whitespace-nowrap">
              💸 회수 대상 (중복지급 환수)
            </span>
            <span className="text-sm font-bold text-rose-700 dark:text-rose-300 tabular-nums whitespace-nowrap">
              합계 {recovery.summary.total_amount.toLocaleString()}원 · {recovery.summary.count}명
            </span>
          </div>
          <p className="text-[11px] text-rose-500/90 mt-1 mb-2.5 max-w-[560px]">
            정산하기 버튼 누락으로 6월분이 2회 지급된 사람들. 상담사 포인트는 건드리지 않고 <b>받아낼 금액만 기록</b>합니다. 받아낸 뒤 [회수완료]를 누르세요.
          </p>
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse">
              <thead>
                <tr className="text-[11px] text-gray-500 border-b border-rose-100 dark:border-rose-800/60">
                  <th className="text-left font-medium py-1.5 pr-5">이름</th>
                  <th className="text-left font-medium py-1.5 pr-5">아이디</th>
                  <th className="text-right font-medium py-1.5 pr-5">받아낼 금액</th>
                  <th className="text-left font-medium py-1.5 pr-5">은행 / 계좌</th>
                  <th className="text-center font-medium py-1.5">처리</th>
                </tr>
              </thead>
              <tbody>
                {recovery.items.map((r) => (
                  <tr key={r.id} className="border-b border-rose-50 dark:border-rose-900/40 last:border-0">
                    <td className="py-1.5 pr-5 font-medium text-gray-800 dark:text-gray-100 whitespace-nowrap">
                      {r.name || '-'}
                    </td>
                    <td className="py-1.5 pr-5 text-gray-500">
                      {r.member_id ? (
                        <Link to={`/members/counselors/${r.member_id}`} className="text-brand-600 hover:underline inline-block max-w-[120px] truncate align-bottom" title={r.mb_id ?? ''}>
                          {r.mb_id}
                        </Link>
                      ) : (
                        r.mb_id || '-'
                      )}
                    </td>
                    <td className="py-1.5 pr-5 text-right font-bold text-rose-600 dark:text-rose-400 tabular-nums whitespace-nowrap">
                      {r.amount.toLocaleString()}원
                    </td>
                    <td className="py-1.5 pr-5 text-xs text-gray-600 dark:text-gray-300 tabular-nums whitespace-nowrap">
                      {r.bank_account ? (
                        <>
                          {r.bank_name && <span className="text-gray-500">{r.bank_name} </span>}
                          <span className="font-medium">{r.bank_account}</span>
                          {r.bank_holder && <span className="text-gray-400"> · {r.bank_holder}</span>}
                        </>
                      ) : (
                        <span className="text-amber-500">계좌 미등록</span>
                      )}
                    </td>
                    <td className="py-1.5 text-center">
                      <button
                        onClick={() => onResolveRecovery(r)}
                        className="px-2 py-1 text-[11px] rounded border border-gray-300 text-gray-600 hover:bg-white dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 font-medium whitespace-nowrap"
                        title="상쇄/협의로 실제 회수가 끝나면 누르세요 (목록에서 내려감)"
                      >
                        회수완료
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusChip({ status, title }: { status: 'calculated' | 'paid' | 'voided' | 'pending'; title?: string }) {
  const map = {
    pending: { label: '미정산', cls: 'bg-amber-50 text-amber-700 border-amber-300' },
    calculated: { label: '계산됨', cls: 'bg-gray-100 text-gray-600 border-gray-300' },
    paid: { label: '지급완료', cls: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
    voided: { label: '무효', cls: 'bg-rose-50 text-rose-600 border-rose-300' },
  } as const
  const m = map[status]
  return (
    <span title={title} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${m.cls}`}>
      {m.label}
    </span>
  )
}

function SumPill({ label, amount, highlight }: { label: string; amount: number; highlight?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border ${
        highlight ? 'bg-brand-50 text-brand-700 border-brand-200' : 'bg-gray-50 text-gray-600 border-gray-200'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${highlight ? 'bg-brand-500' : 'bg-gray-400'}`} />
      <span>{label}</span>
      <span className="font-semibold tabular-nums">{amount.toLocaleString()}원</span>
    </span>
  )
}
