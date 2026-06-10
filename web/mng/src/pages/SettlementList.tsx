import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { api } from '../lib/api'
import { defaultLast7Days } from '../lib/dateRange'
import { DateRangeChips } from '../components/DateRangeChips'
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
}

const PAGE_SIZE = Number(import.meta.env.VITE_LIST_PAGE_SIZE ?? 20)

function curMonthKst(): string {
  const k = new Date(Date.now() + 9 * 3600 * 1000)
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, '0')}`
}

export default function SettlementList() {
  const [mode, setMode] = useState<'history' | 'preview'>('history')
  const [previewMonth, setPreviewMonth] = useState(curMonthKst())

  const _init = defaultLast7Days()
  const [filter, setFilter] = useState({ stx: '', fr_date: _init.from, to_date: _init.to, page: 1 })
  const [pending, setPending] = useState({ stx: '', fr_date: _init.from, to_date: _init.to })

  const [hist, setHist] = useState<HistResp | null>(null)
  const [prev, setPrev] = useState<PrevResp | null>(null)
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

  const onMarkVoided = async (vm: RowVM) => {
    if (!vm.settlementId) return
    const reason = window.prompt(
      `[${vm.mb_id} / ${vm.month}] 정산 무효화\n\n무효화 사유를 입력하세요 (5자 이상, 되돌릴 수 없음):`,
    )
    if (reason === null) return
    if (reason.trim().length < 5) {
      alert('무효화 사유는 5자 이상 입력해야 합니다.')
      return
    }
    try {
      await api(`/admin/settlements/${vm.settlementId}/mark-voided`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: reason.trim() }),
        headers: { 'Content-Type': 'application/json' },
      })
      reload()
    } catch (e) {
      alert(`무효화 실패: ${e instanceof Error ? e.message : String(e)}`)
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
        {modeBtn('preview', '이번 달 미리보기')}
        {mode === 'preview' && (
          <input
            type="month"
            value={previewMonth}
            onChange={(e) => setPreviewMonth(e.target.value || curMonthKst())}
            className={`${inputCls} w-[150px] ml-1`}
          />
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
              <input type="date" value={pending.fr_date} onChange={(e) => setPending({ ...pending, fr_date: e.target.value })} className={inputCls} />
            </div>
            <div className="w-[150px]">
              <label className="block text-[11px] font-medium text-gray-500 mb-1">종료 월</label>
              <input type="date" value={pending.to_date} onChange={(e) => setPending({ ...pending, to_date: e.target.value })} className={inputCls} />
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
        <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-2 leading-relaxed">
          ⓘ 정산예상금액 = 전달 말일까지 미정산 수익금, 실지급액 = (정산예상 − 선지급) × (1 − 원천세 3.3%).
          원하실 때 회원별 <b>[정산하기]</b>를 누르면 그 자리에서 <b>수익금 차감 + 정산완료</b> 처리됩니다.
          그 실지급액을 통장에서 송금하시면 됩니다. 잘못 눌렀을 땐 <b>[무효화]</b>로 수익금이 복구됩니다.
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
          <Th align="left">무효화 사유</Th>
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
                    <Link to={`/members/counselors/${vm.member_id}`} className="text-brand-600 hover:underline font-medium">
                      {vm.mb_id}
                    </Link>
                  ) : (
                    <span className="text-gray-500">{vm.mb_id || '-'}</span>
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
                  {vm.status === 'voided' && vm.voidReason ? (
                    <div className="max-w-[240px]">
                      <div className="text-xs text-gray-700 dark:text-gray-200 truncate" title={vm.voidReason}>
                        {vm.voidReason}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {vm.voidedBy || '-'}
                        {vm.voidedAt ? ` · ${vm.voidedAt.slice(0, 10)}` : ''}
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </Td>
                <Td align="center">
                  {mode === 'preview' ? (
                    <>
                      {vm.status === 'paid' && vm.settlementId ? (
                        <button
                          onClick={() => onMarkVoided(vm)}
                          className="px-2 py-1 text-[11px] rounded border border-rose-300 text-rose-600 hover:bg-rose-50 font-medium"
                          title="지급 후 사고 발견 시 무효화 (수익금 복구)"
                        >무효화</button>
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
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => onMarkPaid(vm)}
                            className="px-2 py-1 text-[11px] rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                            title="통장 송금 완료 + 수익금 차감"
                          >정산하기</button>
                          <button
                            onClick={() => onMarkVoided(vm)}
                            className="px-2 py-1 text-[11px] rounded border border-rose-300 text-rose-600 hover:bg-rose-50 font-medium"
                            title="사고/오정산 정정 (수익금 복구)"
                          >무효화</button>
                        </div>
                      )}
                      {vm.status === 'paid' && vm.settlementId && (
                        <button
                          onClick={() => onMarkVoided(vm)}
                          className="px-2 py-1 text-[11px] rounded border border-rose-300 text-rose-600 hover:bg-rose-50 font-medium"
                          title="지급 후 사고 발견 시 무효화 (수익금 복구)"
                        >무효화</button>
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
