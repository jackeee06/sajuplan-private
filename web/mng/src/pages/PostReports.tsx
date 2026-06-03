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

const PAGE_SIZE = 30

// counselor_qna 신고 횟수 캐시 (post_id → count)
type HiddenMap = Record<number, boolean>

export default function PostReports() {
  const [filter, setFilter] = useState<{ status: string; board: string; page: number }>({ status: '', board: '', page: 1 })
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)
  const [hiddenMap, setHiddenMap] = useState<HiddenMap>({})

  const load = () => {
    const params = new URLSearchParams()
    if (filter.status !== '') params.set('status', filter.status)
    if (filter.board !== '') params.set('board_slug', filter.board)
    params.set('page', String(filter.page))
    setLoading(true)
    api<Resp>(`/admin/board-ops/reports?${params}`)
      .then((d) => {
        setData(d)
        // counselor_qna 항목의 현재 숨김 여부 조회
        const qnaIds = [...new Set(d.items.filter((r) => r.board_slug === 'counselor_qna').map((r) => r.post_id))]
        if (qnaIds.length > 0) loadHiddenMap(qnaIds)
      })
      .finally(() => setLoading(false))
  }

  const loadHiddenMap = async (qnaIds: number[]) => {
    try {
      const res = await api<{ items: { id: number; is_hidden: boolean }[] }>(
        `/admin/board-ops/qna-hidden-status?ids=${qnaIds.join(',')}`
      )
      const map: HiddenMap = {}
      res.items.forEach((r) => { map[r.id] = r.is_hidden })
      setHiddenMap((prev) => ({ ...prev, ...map }))
    } catch { /* 무시 */ }
  }

  useEffect(load, [filter])

  const update = async (id: number, status: number) => {
    if (!confirm(`상태를 [${STATUS_MAP[status].label}](으)로 변경하시겠습니까?`)) return
    await api(`/admin/board-ops/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    load()
  }

  const toggleQnaHidden = async (qnaId: number, hide: boolean) => {
    const label = hide ? '숨김' : '복원'
    if (!confirm(`문의 #${qnaId}를 [${label}] 처리하시겠습니까?`)) return
    await api(`/admin/board-ops/qna/${qnaId}/hidden`, { method: 'PATCH', body: JSON.stringify({ hidden: hide }) })
    setHiddenMap((prev) => ({ ...prev, [qnaId]: hide }))
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-3 max-w-[1200px]">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">게시판 신고 관리</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">게시글 신고 — 검토 후 처리/반려 · 문의글 숨김/복원</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-400 font-medium">상태</span>
        <Chip label="전체" active={filter.status === ''} onClick={() => setFilter((f) => ({ ...f, status: '', page: 1 }))} />
        <Chip label="대기" dotColor="amber" active={filter.status === '0'} onClick={() => setFilter((f) => ({ ...f, status: '0', page: 1 }))} />
        <Chip label="처리됨" dotColor="emerald" active={filter.status === '1'} onClick={() => setFilter((f) => ({ ...f, status: '1', page: 1 }))} />
        <Chip label="반려" dotColor="gray" active={filter.status === '2'} onClick={() => setFilter((f) => ({ ...f, status: '2', page: 1 }))} />

        <span className="ml-4 text-xs text-gray-400 font-medium">게시판</span>
        <Chip label="전체" active={filter.board === ''} onClick={() => setFilter((f) => ({ ...f, board: '', page: 1 }))} />
        <Chip label="상담사 문의" active={filter.board === 'counselor_qna'} onClick={() => setFilter((f) => ({ ...f, board: 'counselor_qna', page: 1 }))} />
      </div>

      <TableShell>
        <THead>
          <Th align="left">신고일시</Th>
          <Th align="left">게시판</Th>
          <Th align="left">대상글</Th>
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
              const isQna = r.board_slug === 'counselor_qna'
              const isHidden = isQna ? (hiddenMap[r.post_id] ?? false) : false
              return (
                <Tr key={r.id}>
                  <Td align="left" className="text-xs text-gray-600 tabular-nums whitespace-nowrap">{formatDT(r.created_at)}</Td>
                  <Td align="left" className="font-mono text-xs text-gray-600">{r.board_slug}</Td>
                  <Td align="left">
                    {isQna ? (
                      <a
                        href={`https://sajuplan.com/counselors/${r.target_member_id ?? 0}/qna/${r.post_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12px] text-blue-600 hover:underline tabular-nums"
                      >
                        #{r.post_id}
                        {isHidden && <span className="ml-1 text-[10px] px-1 py-0.5 bg-red-50 text-red-500 rounded">숨김</span>}
                      </a>
                    ) : (
                      <span className="text-gray-500 tabular-nums text-xs">#{r.post_id}</span>
                    )}
                  </Td>
                  <Td align="left" className="text-xs">{r.reporter_mb_id ?? <span className="text-gray-300">-</span>}</Td>
                  <Td align="left" className="text-xs">{r.target_mb_id ?? <span className="text-gray-300">-</span>}</Td>
                  <Td align="left" className="text-gray-600 max-w-[220px] truncate text-xs">{r.reason ?? <span className="text-gray-300">-</span>}</Td>
                  <Td align="center"><Badge color={s.color}>{s.label}</Badge></Td>
                  <Td align="center">
                    <div className="inline-flex gap-1 flex-wrap justify-center">
                      {r.status === 0 && (
                        <>
                          <button onClick={() => update(r.id, 1)} className="text-[11px] px-2 py-1 rounded-md border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-medium">처리</button>
                          <button onClick={() => update(r.id, 2)} className="text-[11px] px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">반려</button>
                        </>
                      )}
                      {isQna && (
                        isHidden
                          ? <button onClick={() => toggleQnaHidden(r.post_id, false)} className="text-[11px] px-2 py-1 rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50">복원</button>
                          : <button onClick={() => toggleQnaHidden(r.post_id, true)} className="text-[11px] px-2 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50">숨김</button>
                      )}
                    </div>
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
