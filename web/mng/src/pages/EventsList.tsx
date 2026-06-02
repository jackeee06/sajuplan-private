import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { api } from '../lib/api'
import UploadedImage from '../components/UploadedImage'
import { Th, Td, Tr, IdCell, TableShell, THead, TBody, EmptyRow, Badge, BadgeColor, PaginationBar, inputCls } from '../components/table'

interface EventItem {
  id: number
  title: string
  content: string | null
  thumbnail_url: string | null
  thumbnail_url_webp: string | null
  starts_at: string | null
  ends_at: string | null
  view_count: number
  created_at: string
  updated_at: string
}

const PAGE_SIZE = 20

export default function EventsList() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState({ q: '', page: 1 })
  const [pending, setPending] = useState({ q: '' })
  const [data, setData] = useState<{ items: EventItem[]; total: number } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const p = new URLSearchParams()
    if (filter.q) p.set('q', filter.q)
    p.set('page', String(filter.page))
    setLoading(true)
    api<{ items: EventItem[]; total: number }>(`/admin/events?${p}`)
      .then(setData)
      .finally(() => setLoading(false))
  }, [filter])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-3 max-w-[1100px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">이벤트 관리</h1>
          {data && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            총 <span className="text-brand-600 font-semibold tabular-nums">{data.total.toLocaleString()}</span>건
          </p>}
        </div>
        <Link to="/events/new" className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium">
          <Plus className="w-4 h-4" /> 이벤트 추가
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 w-fit max-w-full">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-[260px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">검색</label>
            <input type="text" value={pending.q} onChange={(e) => setPending({ q: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && setFilter({ q: pending.q, page: 1 })} placeholder="제목/본문 검색" className={inputCls} />
          </div>
          <div className="ml-auto">
            <button onClick={() => setFilter({ q: pending.q, page: 1 })} className="px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white inline-flex items-center gap-1.5 font-medium">
              <Search className="w-4 h-4" /> 검색
            </button>
          </div>
        </div>
      </div>

      <TableShell>
        <THead>
          <Th align="right">번호</Th>
          <Th align="left">썸네일</Th>
          <Th align="left">제목</Th>
          <Th align="center">상태</Th>
          <Th align="left">진행 기간</Th>
          <Th align="right">조회수</Th>
          <Th align="left">작성일</Th>
        </THead>
        <TBody>
          {loading && !data ? (
            <EmptyRow colSpan={7} loading />
          ) : !data || data.items.length === 0 ? (
            <EmptyRow colSpan={7} />
          ) : data.items.map((n) => {
            const status = computeStatus(n.starts_at, n.ends_at)
            return (
              <Tr key={n.id} onClick={() => navigate(`/events/${n.id}`)}>
                <IdCell id={n.id} />
                <Td align="left">
                  {n.thumbnail_url ? (
                    <UploadedImage src={n.thumbnail_url} srcWebp={n.thumbnail_url_webp} alt="" className="w-12 h-12 object-cover rounded border border-gray-200 dark:border-gray-700" />
                  ) : (
                    <span className="text-[10px] text-gray-300">—</span>
                  )}
                </Td>
                <Td align="left" className="font-medium text-gray-900 dark:text-gray-100">{n.title}</Td>
                <Td align="center"><Badge color={status.color}>{status.label}</Badge></Td>
                <Td align="left" className="text-xs text-gray-500 tabular-nums">{formatDT(n.starts_at)} ~ {formatDT(n.ends_at)}</Td>
                <Td align="right" className="text-xs text-gray-500 tabular-nums">
                  {n.view_count === 0 ? <span className="text-gray-300">0</span> : n.view_count.toLocaleString()}
                </Td>
                <Td align="left" className="text-xs text-gray-500 tabular-nums">{formatDT(n.created_at)}</Td>
              </Tr>
            )
          })}
        </TBody>
      </TableShell>

      {data && (
        <PaginationBar page={filter.page} totalPages={totalPages} total={data.total} pageSize={PAGE_SIZE} onChange={(p) => setFilter((f) => ({ ...f, page: p }))} unit="건" />
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

function computeStatus(starts: string | null, ends: string | null): { label: string; color: BadgeColor } {
  const now = Date.now()
  const s = starts ? new Date(starts).getTime() : null
  const e = ends ? new Date(ends).getTime() : null
  if (s && now < s) return { label: '예정', color: 'amber' }
  if (e && now > e) return { label: '종료', color: 'gray' }
  return { label: '진행중', color: 'emerald' }
}
