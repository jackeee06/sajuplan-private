import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { api } from '../lib/api'
import {
  Th,
  Td,
  Tr,
  TableShell,
  THead,
  TBody,
  EmptyRow,
  PaginationBar,
  inputCls,
} from '../components/table'

interface Item {
  id: number
  keyword: string
  search_ip: string | null
  result_count: number | null
  member_id: number | null
  member_mb_id: string | null
  member_name: string | null
  created_at: string
}

interface Resp {
  items: Item[]
  total: number
  page: number
  limit: number
}

const PAGE_SIZE = 30

export default function SearchKeywords() {
  const [filter, setFilter] = useState({ fr_date: '', to_date: '', page: 1 })
  const [pending, setPending] = useState({ fr_date: '', to_date: '' })
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams()
    if (filter.fr_date) params.set('fr_date', filter.fr_date)
    if (filter.to_date) params.set('to_date', filter.to_date)
    params.set('page', String(filter.page))
    setLoading(true)
    api<Resp>(`/admin/board-ops/search-keywords?${params}`)
      .then(setData)
      .finally(() => setLoading(false))
  }, [filter])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-3 max-w-[1100px]">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">인기검색어 관리</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">사용자 검색어 로그</p>
      </div>

      {data && (
        <div className="text-xs text-gray-500">
          전체 <span className="text-brand-600 font-semibold">{data.total.toLocaleString()}</span>건
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 w-fit max-w-full">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-[160px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">시작일</label>
            <input type="date" value={pending.fr_date} onChange={(e) => setPending({ ...pending, fr_date: e.target.value })} className={inputCls} />
          </div>
          <div className="w-[160px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">종료일</label>
            <input type="date" value={pending.to_date} onChange={(e) => setPending({ ...pending, to_date: e.target.value })} className={inputCls} />
          </div>
          <div className="ml-auto">
            <button
              onClick={() => setFilter({ ...filter, ...pending, page: 1 })}
              className="px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white inline-flex items-center gap-1.5 font-medium"
            >
              <Search className="w-4 h-4" /> 검색
            </button>
          </div>
        </div>
      </div>

      <TableShell>
        <THead>
          <Th align="left">시간</Th>
          <Th align="left">검색어</Th>
          <Th align="left">회원</Th>
          <Th align="right">결과수</Th>
          <Th align="left">IP</Th>
        </THead>
        <TBody>
          {loading && !data ? (
            <EmptyRow colSpan={5} loading />
          ) : !data || data.items.length === 0 ? (
            <EmptyRow colSpan={5} />
          ) : (
            data.items.map((i) => (
              <Tr key={i.id}>
                <Td align="left" className="text-xs text-gray-600 tabular-nums">{formatDT(i.created_at)}</Td>
                <Td align="left" className="font-medium">{i.keyword}</Td>
                <Td align="left" className="text-gray-500">{i.member_mb_id ?? <span className="text-gray-300">-</span>}</Td>
                <Td align="right" className="tabular-nums text-gray-700">{i.result_count ?? <span className="text-gray-300">-</span>}</Td>
                <Td align="left" className="text-xs text-gray-400 font-mono">{i.search_ip ?? <span className="text-gray-300">-</span>}</Td>
              </Tr>
            ))
          )}
        </TBody>
      </TableShell>

      {data && (
        <PaginationBar page={filter.page} totalPages={totalPages} total={data.total} pageSize={PAGE_SIZE} onChange={(p) => setFilter((f) => ({ ...f, page: p }))} unit="건" />
      )}
    </div>
  )
}

function formatDT(s: string): string {
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
