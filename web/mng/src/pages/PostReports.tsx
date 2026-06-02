import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import {
  Th,
  Td,
  Tr,
  TableShell,
  THead,
  TBody,
  EmptyRow,
  Chip,
  Badge,
  BadgeColor,
  PaginationBar,
} from '../components/table'

interface Item {
  id: number
  board_slug: string
  post_id: number
  reporter_id: number | null
  reporter_mb_id: string | null
  reporter_name: string | null
  target_member_id: number | null
  target_mb_id: string | null
  target_name: string | null
  mode: string | null
  reason: string | null
  status: number
  created_at: string
}

interface Resp {
  items: Item[]
  total: number
  page: number
  limit: number
}

const STATUS_MAP: Record<number, { label: string; color: BadgeColor }> = {
  0: { label: '대기', color: 'amber' },
  1: { label: '처리됨', color: 'emerald' },
  2: { label: '반려', color: 'gray' },
}

const FILTER_DOT: Record<string, BadgeColor | undefined> = {
  '': undefined,
  '0': 'amber',
  '1': 'emerald',
  '2': 'gray',
}

const PAGE_SIZE = 30

export default function PostReports() {
  const [filter, setFilter] = useState<{ status: string; page: number }>({ status: '', page: 1 })
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)

  const load = () => {
    const params = new URLSearchParams()
    if (filter.status !== '') params.set('status', filter.status)
    params.set('page', String(filter.page))
    setLoading(true)
    api<Resp>(`/admin/board-ops/reports?${params}`)
      .then(setData)
      .finally(() => setLoading(false))
  }
  useEffect(load, [filter])

  const update = async (id: number, status: number) => {
    if (!confirm(`상태를 [${STATUS_MAP[status].label}](으)로 변경하시겠습니까?`)) return
    await api(`/admin/board-ops/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    load()
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-3 max-w-[1100px]">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">게시판 신고 관리</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">게시글 신고 — 검토 후 처리/반려</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip label="전체" active={filter.status === ''} onClick={() => setFilter({ status: '', page: 1 })} />
        <Chip label="대기" dotColor="amber" active={filter.status === '0'} onClick={() => setFilter({ status: '0', page: 1 })} />
        <Chip label="처리됨" dotColor="emerald" active={filter.status === '1'} onClick={() => setFilter({ status: '1', page: 1 })} />
        <Chip label="반려" dotColor="gray" active={filter.status === '2'} onClick={() => setFilter({ status: '2', page: 1 })} />
      </div>

      <TableShell>
        <THead>
          <Th align="left">신고일시</Th>
          <Th align="left">게시판</Th>
          <Th align="right">대상글</Th>
          <Th align="left">신고자</Th>
          <Th align="left">대상회원</Th>
          <Th align="left">사유</Th>
          <Th align="center">상태</Th>
          <Th align="center">처리</Th>
        </THead>
        <TBody>
          {loading && !data ? (
            <EmptyRow colSpan={8} loading />
          ) : !data || data.items.length === 0 ? (
            <EmptyRow colSpan={8} />
          ) : (
            data.items.map((r) => {
              const s = STATUS_MAP[r.status] ?? { label: `상태${r.status}`, color: 'gray' as BadgeColor }
              return (
                <Tr key={r.id}>
                  <Td align="left" className="text-xs text-gray-600 tabular-nums">{formatDT(r.created_at)}</Td>
                  <Td align="left" className="font-mono text-xs text-gray-600">{r.board_slug}</Td>
                  <Td align="right" className="text-gray-500 tabular-nums">#{r.post_id}</Td>
                  <Td align="left">{r.reporter_mb_id ?? <span className="text-gray-300">-</span>}</Td>
                  <Td align="left">{r.target_mb_id ?? <span className="text-gray-300">-</span>}</Td>
                  <Td align="left" className="text-gray-600 max-w-[280px] truncate">{r.reason ?? <span className="text-gray-300">-</span>}</Td>
                  <Td align="center"><Badge color={s.color}>{s.label}</Badge></Td>
                  <Td align="center">
                    {r.status === 0 && (
                      <div className="inline-flex gap-1">
                        <button onClick={() => update(r.id, 1)} className="text-[11px] px-2 py-1 rounded-md border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-medium">처리</button>
                        <button onClick={() => update(r.id, 2)} className="text-[11px] px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">반려</button>
                      </div>
                    )}
                  </Td>
                </Tr>
              )
            })
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
