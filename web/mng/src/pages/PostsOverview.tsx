import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Th, Td, Tr, TableShell, THead, TBody, EmptyRow, NumCell } from '../components/table'

interface Row {
  slug: string
  post_count: number
  comment_count: number
  latest_at: string | null
}

export default function PostsOverview() {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api<{ items: Row[] }>('/admin/board-ops/posts-overview')
      .then((r) => setItems(r.items))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-3 max-w-[1100px]">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">글·댓글 현황</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">게시판(slug)별 누적 글/댓글 수</p>
      </div>

      <TableShell>
        <THead>
          <Th align="left">게시판 (slug)</Th>
          <Th align="right">게시글 수</Th>
          <Th align="right">댓글 수</Th>
          <Th align="left">최근 작성</Th>
        </THead>
        <TBody>
          {loading ? (
            <EmptyRow colSpan={4} loading />
          ) : items.length === 0 ? (
            <EmptyRow colSpan={4} />
          ) : (
            items.map((r) => (
              <Tr key={r.slug}>
                <Td align="left" className="font-medium font-mono">{r.slug}</Td>
                <Td align="right"><NumCell value={r.post_count} bold /></Td>
                <Td align="right"><NumCell value={r.comment_count} /></Td>
                <Td align="left" className="text-xs text-gray-500 tabular-nums">
                  {r.latest_at ? formatDT(r.latest_at) : <span className="text-gray-300">-</span>}
                </Td>
              </Tr>
            ))
          )}
        </TBody>
      </TableShell>
    </div>
  )
}

function formatDT(s: string): string {
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
