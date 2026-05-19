import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

/**
 * 어드민 — 환불 이력 (Phase 10).
 *
 * 환불 신청은 ConsultationDetail 페이지의 "환불 처리" 버튼에서. 여기선 조회만.
 */

interface RefundRow {
  id: number
  consultation_id: number
  member_id: number
  counselor_id: number | null
  amount: number
  reason: string
  status: string
  requested_by: string
  decided_by: string | null
  created_at: string
  decided_at: string | null
  member_mb_id: string | null
  counselor_mb_id: string | null
  counselor_nickname: string | null
}

interface Resp {
  items: RefundRow[]
  total: number
  limit: number
  offset: number
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: '대기', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: '승인', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '반려', cls: 'bg-gray-200 text-gray-700' },
}

export default function RefundList() {
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [memberMbId, setMemberMbId] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams({
      limit: '30',
      offset: String(page * 30),
    })
    if (memberMbId) params.set('member_mb_id', memberMbId)
    if (status) params.set('status', status)
    api<Resp>(`/admin/refunds?${params.toString()}`)
      .then((r) => !cancelled && setData(r))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, memberMbId, status])

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-semibold">환불 이력</h1>
        <p className="text-xs text-gray-500 mt-1">
          상담별 환불 처리 이력. 환불 신청은 상담 상세에서 처리.
        </p>
      </div>

      <div className="flex gap-2 items-end">
        <div>
          <label className="text-xs text-gray-500">회원 아이디</label>
          <input
            value={memberMbId}
            onChange={(e) => {
              setMemberMbId(e.target.value)
              setPage(0)
            }}
            placeholder="mb_id"
            className="block mt-1 px-3 py-2 border rounded text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">상태</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(0)
            }}
            className="block mt-1 px-3 py-2 border rounded text-sm"
          >
            <option value="">전체</option>
            <option value="approved">승인</option>
            <option value="pending">대기</option>
            <option value="rejected">반려</option>
          </select>
        </div>
        {data && (
          <span className="text-xs text-gray-500 pb-2">
            총 {data.total.toLocaleString()}건
          </span>
        )}
      </div>

      {error && <div className="p-3 rounded bg-rose-50 text-rose-700 text-sm">{error}</div>}

      {loading ? (
        <div className="text-sm text-gray-500">로딩...</div>
      ) : !data || data.items.length === 0 ? (
        <div className="p-6 text-sm text-gray-500 text-center bg-white rounded-lg">
          환불 이력 없음
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 text-xs">
              <tr>
                <th className="px-3 py-2 text-left">시각</th>
                <th className="px-3 py-2 text-left">상담</th>
                <th className="px-3 py-2 text-left">회원</th>
                <th className="px-3 py-2 text-left">상담사</th>
                <th className="px-3 py-2 text-right">금액</th>
                <th className="px-3 py-2 text-left">상태</th>
                <th className="px-3 py-2 text-left">사유</th>
                <th className="px-3 py-2 text-left">처리자</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.items.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {r.created_at.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <Link
                      to={`/consultations/${r.consultation_id}`}
                      className="text-brand-600 hover:underline"
                    >
                      #{r.consultation_id}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.member_mb_id ? (
                      <Link
                        to={`/members/customers/${r.member_id}`}
                        className="text-brand-600 hover:underline"
                      >
                        {r.member_mb_id}
                      </Link>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.counselor_id && r.counselor_mb_id ? (
                      <Link
                        to={`/members/counselors/${r.counselor_id}`}
                        className="text-brand-600 hover:underline"
                      >
                        {r.counselor_nickname || r.counselor_mb_id}
                      </Link>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-right font-medium tabular-nums">
                    {r.amount.toLocaleString()}P
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${
                        STATUS_LABEL[r.status]?.cls ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {STATUS_LABEL[r.status]?.label ?? r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600 max-w-[200px] truncate" title={r.reason}>
                    {r.reason}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{r.decided_by ?? r.requested_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > 30 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-xs text-gray-500">
            {page + 1} / {Math.ceil(data.total / 30)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={(page + 1) * 30 >= data.total}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}
    </div>
  )
}
