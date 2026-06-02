import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Download } from 'lucide-react'
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
 * sample/adm/settlement_list.php (메뉴 350450 "정산이력") 정확 매핑.
 *
 * 컬럼: 아이디 / 이름 / 닉네임 / 해당월 / 무료R% / 유료R% / 무료정산비 / 유료정산비 /
 *      기타정산비 / 정산비전체 / 부가세공제 / 원천세공제 / 회선비 / 총정산금액
 * 검색: 회원아이디 (sfl=mb_id, like %stx%)
 * 기간: month BETWEEN YYYY-MM AND YYYY-MM
 */

interface Item {
  id: number
  no: number | null
  member_id: number | null
  mb_id: string | null
  member_name: string | null
  member_nickname: string | null
  free_royalty_pct: number | null
  paid_royalty_pct: number | null
  month: string
  kind: string | null
  price_free: number
  price_paid: number
  price_other: number
  price_tot: number
  vat_amount: number
  withholding_tax: number
  reply_fee: number
  price: number
  wr_datetime: string | null
  created_at: string
  status: 'calculated' | 'paid' | 'voided'
  paid_at: string | null
  paid_by_id: number | null
  voided_at: string | null
  voided_by_id: number | null
  void_reason: string | null
}

interface Resp {
  items: Item[]
  total: number
  page: number
  limit: number
  summary: {
    total_price: number
    total_price_tot: number
    total_vat: number
    total_withholding: number
    total_reply_fee: number
  }
}

interface Filter {
  sfl: 'mb_id'
  stx: string
  fr_date: string
  to_date: string
  page: number
}

const PAGE_SIZE = Number(import.meta.env.VITE_LIST_PAGE_SIZE ?? 20)

export default function SettlementList() {
  // [2026-06-02 v2] 사장님 명시: 모든 페이지 기본 = 최근 7일 (일관성 우선)
  const _init = defaultLast7Days()
  const [filter, setFilter] = useState<Filter>({
    sfl: 'mb_id',
    stx: '',
    fr_date: _init.from,
    to_date: _init.to,
    page: 1,
  })
  const [pending, setPending] = useState<Omit<Filter, 'page'>>({
    sfl: 'mb_id',
    stx: '',
    fr_date: _init.from,
    to_date: _init.to,
  })
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (filter.stx) {
      params.set('sfl', filter.sfl)
      params.set('stx', filter.stx)
    }
    if (filter.fr_date) params.set('fr_date', filter.fr_date)
    if (filter.to_date) params.set('to_date', filter.to_date)
    params.set('page', String(filter.page))
    params.set('limit', String(PAGE_SIZE))

    setLoading(true)
    setError(null)
    api<Resp>(`/admin/settlements?${params}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [filter])

  const onSearch = () => setFilter((f) => ({ ...f, ...pending, page: 1 }))
  const onReset = () => {
    setPending({ sfl: 'mb_id', stx: '', fr_date: '', to_date: '' })
    setFilter({ sfl: 'mb_id', stx: '', fr_date: '', to_date: '', page: 1 })
  }

  const refresh = () => setFilter((f) => ({ ...f }))

  const onMarkPaid = async (item: Item) => {
    const ok = window.confirm(
      `[${item.mb_id} / ${item.month}] 정산 ${item.price.toLocaleString()}원\n\n` +
      '통장 송금을 완료하셨나요? 지급완료로 마킹합니다.',
    )
    if (!ok) return
    try {
      await api(`/admin/settlements/${item.id}/mark-paid`, { method: 'PATCH' })
      refresh()
    } catch (e) {
      alert(`지급완료 마킹 실패: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const onMarkVoided = async (item: Item) => {
    const reason = window.prompt(
      `[${item.mb_id} / ${item.month}] 정산 ${item.price.toLocaleString()}원 무효화\n\n` +
      '무효화 사유를 입력하세요 (5자 이상, 한 번 무효화 후 되돌릴 수 없음):',
    )
    if (reason === null) return
    if (reason.trim().length < 5) {
      alert('무효화 사유는 5자 이상 입력해야 합니다.')
      return
    }
    try {
      await api(`/admin/settlements/${item.id}/mark-voided`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: reason.trim() }),
        headers: { 'Content-Type': 'application/json' },
      })
      refresh()
    } catch (e) {
      alert(`무효화 실패: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-3">
      {/* 타이틀 + 엑셀 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">정산 이력</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">상담사 월 정산 이력</p>
        </div>
        <button
          type="button"
          disabled
          title="엑셀 다운로드는 추후 단계"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border border-gray-200 text-gray-400 dark:border-gray-700 opacity-50 cursor-not-allowed"
        >
          <Download className="w-4 h-4" /> 엑셀다운로드
        </button>
      </div>

      {/* 상단 요약 칩 */}
      {data && (
        <div className="flex flex-wrap items-center gap-2">
          <Chip label="전체목록" active onClick={onReset} />
          <Chip label="총건수" value={data.total} />
          <SumPill label="총정산금액" amount={data.summary.total_price} highlight />
          <SumPill label="정산비전체" amount={data.summary.total_price_tot} />
          <SumPill label="부가세" amount={data.summary.total_vat} />
          <SumPill label="원천세" amount={data.summary.total_withholding} />
          <SumPill label="회선비" amount={data.summary.total_reply_fee} />
        </div>
      )}

      {/* 검색 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 w-fit max-w-full">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-[120px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">검색기준</label>
            <select className={inputCls} value={pending.sfl} onChange={() => {}}>
              <option value="mb_id">회원아이디</option>
            </select>
          </div>
          <div className="w-[240px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">검색어</label>
            <input
              type="text"
              value={pending.stx}
              onChange={(e) => setPending({ ...pending, stx: e.target.value })}
              placeholder="검색어"
              className={inputCls}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            />
          </div>
          <div className="w-[160px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">시작 월</label>
            <input
              type="date"
              value={pending.fr_date}
              onChange={(e) => setPending({ ...pending, fr_date: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="w-[160px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">종료 월</label>
            <input
              type="date"
              value={pending.to_date}
              onChange={(e) => setPending({ ...pending, to_date: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="ml-auto">
            <button
              onClick={onSearch}
              className="px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white inline-flex items-center gap-1.5 font-medium"
            >
              <Search className="w-4 h-4" /> 검색
            </button>
          </div>
        </div>
        {/* [2026-06-02] 빠른 기간 칩 — 사장님 합의 (오늘/어제/최근7일/이번달/지난달) */}
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

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* 테이블 */}
      <TableShell>
        <THead>
          <Th align="left">아이디</Th>
          <Th align="left">이름</Th>
          <Th align="left">닉네임</Th>
          <Th align="left">해당월</Th>
          <Th align="right">무료R%</Th>
          <Th align="right">유료R%</Th>
          <Th align="right">무료정산비</Th>
          <Th align="right">유료정산비</Th>
          <Th align="right">기타정산비</Th>
          <Th align="right">정산비전체</Th>
          <Th align="right">부가세공제</Th>
          <Th align="right">원천세공제</Th>
          <Th align="right">회선비</Th>
          <Th align="right">총정산금액</Th>
          <Th align="center">상태</Th>
          <Th align="center">액션</Th>
        </THead>
        <TBody>
          {loading && !data ? (
            <EmptyRow colSpan={16} loading />
          ) : !data || data.items.length === 0 ? (
            <EmptyRow colSpan={16} />
          ) : (
            data.items.map((s) => (
              <Tr key={s.id}>
                <Td align="left">
                  {s.member_id && s.mb_id ? (
                    <Link
                      to={`/members/counselors/${s.member_id}`}
                      className="text-brand-600 hover:underline font-medium"
                    >
                      {s.mb_id}
                    </Link>
                  ) : (
                    <span className="text-gray-500">{s.mb_id || '-'}</span>
                  )}
                </Td>
                <Td align="left">{s.member_name || <span className="text-gray-300">-</span>}</Td>
                <Td align="left" className="text-gray-700">
                  {s.member_nickname || <span className="text-gray-300">-</span>}
                </Td>
                <Td align="left" className="text-gray-700 tabular-nums">
                  {s.month}
                </Td>
                <Td align="right" className="text-xs text-gray-600 tabular-nums">
                  {s.free_royalty_pct !== null ? `${s.free_royalty_pct}%` : <span className="text-gray-300">-</span>}
                </Td>
                <Td align="right" className="text-xs text-gray-600 tabular-nums">
                  {s.paid_royalty_pct !== null ? `${s.paid_royalty_pct}%` : <span className="text-gray-300">-</span>}
                </Td>
                <Td align="right"><NumCell value={s.price_free} /></Td>
                <Td align="right"><NumCell value={s.price_paid} /></Td>
                <Td align="right"><NumCell value={s.price_other} /></Td>
                <Td align="right"><NumCell value={s.price_tot} bold /></Td>
                <Td align="right"><NumCell value={s.vat_amount} /></Td>
                <Td align="right"><NumCell value={s.withholding_tax} /></Td>
                <Td align="right"><NumCell value={s.reply_fee} /></Td>
                <Td align="right" className="font-bold text-brand-700 dark:text-brand-300 tabular-nums">
                  {s.price.toLocaleString()}
                </Td>
                <Td align="center">
                  <StatusChip status={s.status} title={
                    s.status === 'paid' && s.paid_at ? `지급일: ${s.paid_at.slice(0,10)}` :
                    s.status === 'voided' && s.void_reason ? `사유: ${s.void_reason}` :
                    undefined
                  } />
                </Td>
                <Td align="center">
                  {s.status === 'calculated' && (
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => onMarkPaid(s)}
                        className="px-2 py-1 text-[11px] rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                        title="통장 송금 완료 마킹"
                      >지급완료</button>
                      <button
                        onClick={() => onMarkVoided(s)}
                        className="px-2 py-1 text-[11px] rounded border border-rose-300 text-rose-600 hover:bg-rose-50 font-medium"
                        title="사고/오정산 정정"
                      >무효화</button>
                    </div>
                  )}
                  {s.status === 'paid' && (
                    <button
                      onClick={() => onMarkVoided(s)}
                      className="px-2 py-1 text-[11px] rounded border border-rose-300 text-rose-600 hover:bg-rose-50 font-medium"
                      title="지급 후 사고 발견 시 무효화"
                    >무효화</button>
                  )}
                  {s.status === 'voided' && (
                    <span className="text-[11px] text-gray-400">잠금</span>
                  )}
                </Td>
              </Tr>
            ))
          )}
        </TBody>
      </TableShell>

      {data && (
        <PaginationBar
          page={filter.page}
          totalPages={totalPages}
          total={data.total}
          pageSize={PAGE_SIZE}
          onChange={(p) => setFilter((f) => ({ ...f, page: p }))}
          unit="건"
        />
      )}
    </div>
  )
}

function StatusChip({ status, title }: { status: 'calculated' | 'paid' | 'voided'; title?: string }) {
  const map = {
    calculated: { label: '계산됨', cls: 'bg-gray-100 text-gray-600 border-gray-300' },
    paid:       { label: '지급완료', cls: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
    voided:     { label: '무효', cls: 'bg-rose-50 text-rose-600 border-rose-300' },
  } as const
  const m = map[status]
  return (
    <span
      title={title}
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${m.cls}`}
    >{m.label}</span>
  )
}

function SumPill({ label, amount, highlight }: { label: string; amount: number; highlight?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border ${
        highlight
          ? 'bg-brand-50 text-brand-700 border-brand-200'
          : 'bg-gray-50 text-gray-600 border-gray-200'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${highlight ? 'bg-brand-500' : 'bg-gray-400'}`} />
      <span>{label}</span>
      <span className="font-semibold tabular-nums">{amount.toLocaleString()}원</span>
    </span>
  )
}
