import { useEffect, useState } from 'react'
import { api } from '../lib/api'

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

interface Resp { items: Item[]; total: number; page: number; limit: number }

const STATUS_MAP: Record<number, { label: string; cls: string }> = {
  0: { label: '대기', cls: 'bg-amber-100 text-amber-700' },
  1: { label: '처리됨', cls: 'bg-emerald-100 text-emerald-700' },
  2: { label: '반려', cls: 'bg-gray-200 text-gray-600' },
}

export default function PostReports() {
  const [filter, setFilter] = useState<{ status: string; page: number }>({ status: '', page: 1 })
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)

  const load = () => {
    const params = new URLSearchParams()
    if (filter.status !== '') params.set('status', filter.status)
    params.set('page', String(filter.page))
    setLoading(true)
    api<Resp>(`/admin/board-ops/reports?${params}`).then(setData).finally(() => setLoading(false))
  }
  useEffect(load, [filter])

  const update = async (id: number, status: number) => {
    if (!confirm(`상태를 [${STATUS_MAP[status].label}](으)로 변경하시겠습니까?`)) return
    await api(`/admin/board-ops/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    load()
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 30)) : 1

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">게시판 신고 관리</h1>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setFilter({ status: '', page: 1 })} className={tabCls(filter.status === '')}>전체</button>
        <button onClick={() => setFilter({ status: '0', page: 1 })} className={tabCls(filter.status === '0')}>대기</button>
        <button onClick={() => setFilter({ status: '1', page: 1 })} className={tabCls(filter.status === '1')}>처리됨</button>
        <button onClick={() => setFilter({ status: '2', page: 1 })} className={tabCls(filter.status === '2')}>반려</button>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-brand-600 dark:bg-brand-700 text-[11px] text-white">
              <tr>
                <th className="px-3 py-2 text-left font-medium">신고일시</th>
                <th className="px-3 py-2 text-left font-medium">게시판</th>
                <th className="px-3 py-2 text-right font-medium">대상글</th>
                <th className="px-3 py-2 text-left font-medium">신고자</th>
                <th className="px-3 py-2 text-left font-medium">대상회원</th>
                <th className="px-3 py-2 text-left font-medium">사유</th>
                <th className="px-3 py-2 text-center font-medium">상태</th>
                <th className="px-3 py-2 text-right font-medium">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading && !data ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">로딩...</td></tr>
              ) : !data || data.items.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">자료가 없습니다.</td></tr>
              ) : data.items.map((r) => {
                const s = STATUS_MAP[r.status] ?? { label: `상태${r.status}`, cls: 'bg-gray-100' }
                return (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{formatDT(r.created_at)}</td>
                    <td className="px-3 py-2 font-mono text-gray-600">{r.board_slug}</td>
                    <td className="px-3 py-2 text-right text-gray-500">#{r.post_id}</td>
                    <td className="px-3 py-2">{r.reporter_mb_id ?? '-'}</td>
                    <td className="px-3 py-2">{r.target_mb_id ?? '-'}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-[280px] truncate">{r.reason ?? '-'}</td>
                    <td className="px-3 py-2 text-center"><span className={`text-[10px] px-1.5 py-0.5 rounded ${s.cls}`}>{s.label}</span></td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {r.status === 0 && (
                        <>
                          <button onClick={() => update(r.id, 1)} className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 mr-1">처리</button>
                          <button onClick={() => update(r.id, 2)} className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">반려</button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {data && data.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-gray-500">
            <div>총 {data.total.toLocaleString()}건 · {filter.page} / {totalPages}</div>
            <div className="flex gap-1">
              <button onClick={() => setFilter((f) => ({ ...f, page: Math.max(1, f.page - 1) }))} disabled={filter.page <= 1} className="px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-40">이전</button>
              <button onClick={() => setFilter((f) => ({ ...f, page: Math.min(totalPages, f.page + 1) }))} disabled={filter.page >= totalPages} className="px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-40">다음</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const tabCls = (a: boolean) => `px-3 py-1.5 rounded-md text-xs font-medium ${a ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`
function formatDT(s: string): string { const dt = new Date(s); if (isNaN(dt.getTime())) return s; const pad = (n: number) => String(n).padStart(2, '0'); return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}` }
