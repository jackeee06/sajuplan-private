import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  NumCell,
  PaginationBar,
  inputCls,
} from '../components/table'

interface Room {
  id: number
  roomid: string | null
  member_id: number | null
  member_mb_id: string | null
  member_name: string | null
  counselor_id: number | null
  counselor_mb_id: string | null
  counselor_name: string | null
  counselor_nickname: string | null
  status: string | null
  message_count: number
  last_message: string | null
  started_at: string | null
  ended_at: string | null
}

interface Resp {
  items: Room[]
  total: number
  page: number
  limit: number
}

const PAGE_SIZE = 20

export default function ChatHistoryList() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState({ q: '', fr_date: '', to_date: '', page: 1 })
  const [pending, setPending] = useState({ q: '', fr_date: '', to_date: '' })
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (filter.q) params.set('q', filter.q)
    if (filter.fr_date) params.set('fr_date', filter.fr_date)
    if (filter.to_date) params.set('to_date', filter.to_date)
    params.set('page', String(filter.page))
    params.set('limit', String(PAGE_SIZE))
    setLoading(true)
    setError(null)
    api<Resp>(`/admin/chat-history?${params}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [filter])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-3 max-w-[1100px]">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">채팅내역 리스트</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">상담사-회원 채팅 룸 이력</p>
      </div>

      {data && (
        <div className="text-xs text-gray-500">
          전체 <span className="text-brand-600 font-semibold">{data.total.toLocaleString()}</span>건
        </div>
      )}

      {/* 검색 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 w-fit max-w-full">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-[260px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">검색</label>
            <input
              type="text"
              value={pending.q}
              onChange={(e) => setPending({ ...pending, q: e.target.value })}
              placeholder="회원 / 상담사 / 룸ID"
              className={inputCls}
              onKeyDown={(e) => e.key === 'Enter' && setFilter({ ...filter, ...pending, page: 1 })}
            />
          </div>
          <div className="w-[160px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">시작일</label>
            <input
              type="date"
              value={pending.fr_date}
              onChange={(e) => setPending({ ...pending, fr_date: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="w-[160px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">종료일</label>
            <input
              type="date"
              value={pending.to_date}
              onChange={(e) => setPending({ ...pending, to_date: e.target.value })}
              className={inputCls}
            />
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

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}

      {/* 테이블 */}
      <TableShell>
        <THead>
          <Th align="left">시작일시</Th>
          <Th align="left">회원</Th>
          <Th align="left">상담사</Th>
          <Th align="left">룸 토큰</Th>
          <Th align="right">메시지수</Th>
          <Th align="left">마지막 메시지</Th>
        </THead>
        <TBody>
          {loading && !data ? (
            <EmptyRow colSpan={6} loading />
          ) : !data || data.items.length === 0 ? (
            <EmptyRow colSpan={6} />
          ) : (
            data.items.map((r) => (
              <Tr key={r.id} onClick={() => navigate(`/chat-history/${r.id}`)}>
                <Td align="left" className="text-xs text-gray-600 tabular-nums">
                  {formatDT(r.started_at)}
                </Td>
                <Td align="left">
                  {r.member_id && r.member_mb_id ? (
                    <Link
                      to={`/members/customers/${r.member_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-brand-600 hover:underline font-medium"
                    >
                      {r.member_mb_id}
                    </Link>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </Td>
                <Td align="left">
                  {r.counselor_id ? (
                    <Link
                      to={`/members/counselors/${r.counselor_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-brand-600 hover:underline font-medium"
                    >
                      {r.counselor_nickname || r.counselor_mb_id || `#${r.counselor_id}`}
                    </Link>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </Td>
                <Td align="left" className="font-mono text-[10px] text-gray-500">
                  {r.roomid || <span className="text-gray-300">-</span>}
                </Td>
                <Td align="right"><NumCell value={r.message_count} bold /></Td>
                <Td align="left" className="max-w-[300px] truncate text-gray-500">
                  {r.last_message || <span className="text-gray-300">-</span>}
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

function formatDT(s: string | null): string {
  if (!s) return '-'
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
