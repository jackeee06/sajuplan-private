import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Download } from 'lucide-react'
import { api } from '../lib/api'

/**
 * sample/adm/settlement_list.php (메뉴 350450 "정산이력") 정확 매핑.
 *
 * 컬럼: 아이디 / 이름 / 닉네임 / 해당월 / 무료R% / 유료R% / 무료정산비 / 유료정산비 /
 *      기타정산비 / 정산비전체 / 부가세공제 / 원천세공제 / 회선비 / 총정산금액
 * 검색: 회원아이디 (sfl=mb_id, like %stx%)
 * 기간: month BETWEEN YYYY-MM AND YYYY-MM
 * 액션: 월정산하기 (pay_month.php — 추후 cron 트리거 연결), 엑셀다운로드
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
  const [filter, setFilter] = useState<Filter>({
    sfl: 'mb_id', stx: '', fr_date: '', to_date: '', page: 1,
  })
  const [pending, setPending] = useState<Omit<Filter, 'page'>>({
    sfl: 'mb_id', stx: '', fr_date: '', to_date: '',
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

    setLoading(true); setError(null)
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

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">정산 이력</h1>
        <button
          type="button" disabled
          title="엑셀 다운로드는 추후 단계"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-emerald-600 text-white opacity-50 cursor-not-allowed"
        >
          <Download className="w-4 h-4" /> 엑셀다운로드
        </button>
      </div>

      {/* 상단 요약 */}
      {data && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={onReset} className="px-3 py-1.5 rounded-md bg-brand-600 text-white text-xs font-medium">전체목록</button>
          <Chip label="총건수" value={`${data.total.toLocaleString()}건`} />
          <Chip label="총정산금액" value={`${data.summary.total_price.toLocaleString()}원`} highlight />
          <Chip label="정산비전체" value={`${data.summary.total_price_tot.toLocaleString()}원`} />
          <Chip label="부가세" value={`${data.summary.total_vat.toLocaleString()}원`} />
          <Chip label="원천세" value={`${data.summary.total_withholding.toLocaleString()}원`} />
          <Chip label="회선비" value={`${data.summary.total_reply_fee.toLocaleString()}원`} />
        </div>
      )}

      {/* 검색 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <select className={`w-28 ${searchInputCls}`} value={pending.sfl} onChange={() => {}}>
            <option value="mb_id">회원아이디</option>
          </select>
          <input
            type="text" value={pending.stx}
            onChange={(e) => setPending({ ...pending, stx: e.target.value })}
            placeholder="검색어"
            className={`w-44 md:w-56 ${searchInputCls}`}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          />
          <span className="mx-1 text-xs text-gray-400">|</span>
          <input type="date" value={pending.fr_date} onChange={(e) => setPending({ ...pending, fr_date: e.target.value })} className={`w-36 ${searchInputCls}`} title="시작 월" />
          <span className="text-gray-400">~</span>
          <input type="date" value={pending.to_date} onChange={(e) => setPending({ ...pending, to_date: e.target.value })} className={`w-36 ${searchInputCls}`} title="종료 월" />
          <button onClick={onSearch} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white ml-auto md:ml-0">
            <Search className="w-4 h-4" /> 검색
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm">{error}</div>}

      {/* 14컬럼 (sample) */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-brand-600 dark:bg-brand-700 text-[11px] text-white">
              <tr>
                <Th>아이디</Th>
                <Th>이름</Th>
                <Th>닉네임</Th>
                <Th>해당월</Th>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading && !data ? (
                <tr><td colSpan={14} className="px-4 py-8 text-center text-sm text-gray-500">로딩...</td></tr>
              ) : !data || data.items.length === 0 ? (
                <tr><td colSpan={14} className="px-4 py-8 text-center text-sm text-gray-400">자료가 없습니다.</td></tr>
              ) : (
                data.items.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <Td>
                      {s.member_id && s.mb_id ? (
                        <Link to={`/members/counselors/${s.member_id}`} className="text-brand-600 hover:underline">{s.mb_id}</Link>
                      ) : <span className="text-gray-500">{s.mb_id || '-'}</span>}
                    </Td>
                    <Td>{s.member_name || '-'}</Td>
                    <Td>{s.member_nickname || '-'}</Td>
                    <Td>{s.month}</Td>
                    <Td align="right">{s.free_royalty_pct ?? '-'}%</Td>
                    <Td align="right">{s.paid_royalty_pct ?? '-'}%</Td>
                    <Td align="right">{s.price_free.toLocaleString()}</Td>
                    <Td align="right">{s.price_paid.toLocaleString()}</Td>
                    <Td align="right">{s.price_other.toLocaleString()}</Td>
                    <Td align="right" className="font-medium">{s.price_tot.toLocaleString()}</Td>
                    <Td align="right" className="text-gray-500">{s.vat_amount.toLocaleString()}</Td>
                    <Td align="right" className="text-gray-500">{s.withholding_tax.toLocaleString()}</Td>
                    <Td align="right" className="text-gray-500">{s.reply_fee.toLocaleString()}</Td>
                    <Td align="right" className="font-bold text-brand-700 dark:text-brand-300">{s.price.toLocaleString()}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && data.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500">
            <div>총 {data.total.toLocaleString()}건 · {filter.page} / {totalPages} 페이지</div>
            <div className="flex gap-1">
              <button onClick={() => setFilter((f) => ({ ...f, page: Math.max(1, f.page - 1) }))} disabled={filter.page <= 1} className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">이전</button>
              <button onClick={() => setFilter((f) => ({ ...f, page: Math.min(totalPages, f.page + 1) }))} disabled={filter.page >= totalPages} className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">다음</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const searchInputCls = 'px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none'

function Chip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const cls = highlight
    ? 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-800'
    : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700'
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border ${cls}`}>
      <span>{label}</span>
      <span className="opacity-90">{value}</span>
    </span>
  )
}

function Th({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <th scope="col" className={`px-3 py-2 ${align === 'right' ? 'text-right' : 'text-left'} font-medium whitespace-nowrap`}>{children}</th>
}

function Td({ children, align, className }: { children: React.ReactNode; align?: 'left' | 'right'; className?: string }) {
  return <td className={`px-3 py-2 ${align === 'right' ? 'text-right' : 'text-left'} whitespace-nowrap ${className ?? 'text-gray-700 dark:text-gray-300'}`}>{children}</td>
}
