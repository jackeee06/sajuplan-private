import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { defaultLast7Days } from '../lib/dateRange'
import { DateRangeChips } from '../components/DateRangeChips'
import { Th, Td, Tr, TableShell, THead, TBody, EmptyRow, Badge, BadgeColor, inputCls } from '../components/table'

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

const STATUS_LABEL: Record<string, { label: string; color: BadgeColor }> = {
  pending: { label: '대기', color: 'amber' },
  approved: { label: '승인', color: 'emerald' },
  rejected: { label: '반려', color: 'gray' },
}

export default function RefundList() {
  const navigate = useNavigate()
  const _init = defaultLast7Days()
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [memberMbId, setMemberMbId] = useState('')
  const [status, setStatus] = useState('')
  const [frDate, setFrDate] = useState(_init.from)
  const [toDate, setToDate] = useState(_init.to)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams({
      limit: '30',
      offset: String(page * 30),
    })
    if (memberMbId) params.set('member_mb_id', memberMbId)
    if (status) params.set('status', status)
    if (frDate) params.set('fr_date', frDate)
    if (toDate) params.set('to_date', toDate)
    api<Resp>(`/admin/refunds?${params.toString()}`)
      .then((r) => !cancelled && setData(r))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, memberMbId, status, frDate, toDate])

  return (
    <div className="space-y-3 max-w-[1100px]">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">환불 이력</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          상담별 환불 처리 이력. 환불 신청은 상담 상세에서 처리.
        </p>
      </div>

      {/* 검색 영역 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 w-fit max-w-full">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-[180px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">회원 아이디</label>
            <input
              value={memberMbId}
              onChange={(e) => {
                setMemberMbId(e.target.value)
                setPage(0)
              }}
              placeholder="mb_id"
              className={inputCls}
            />
          </div>
          <div className="w-[120px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">상태</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(0)
              }}
              className={inputCls}
            >
              <option value="">전체</option>
              <option value="approved">승인</option>
              <option value="pending">대기</option>
              <option value="rejected">반려</option>
            </select>
          </div>
          <div className="w-[150px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">기간 시작</label>
            <input type="date" value={frDate} onChange={(e) => { setFrDate(e.target.value); setPage(0) }} className={inputCls} />
          </div>
          <div className="w-[150px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">기간 종료</label>
            <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(0) }} className={inputCls} />
          </div>
          {data && (
            <span className="text-xs text-gray-500 pb-2">
              총 <span className="text-brand-600 font-semibold tabular-nums">{data.total.toLocaleString()}</span>건
            </span>
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <DateRangeChips
            from={frDate}
            to={toDate}
            onPick={(r) => { setFrDate(r.from); setToDate(r.to); setPage(0) }}
          />
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm w-fit max-w-full">{error}</div>}

      {loading ? (
        <div className="text-xs text-gray-500">로딩...</div>
      ) : !data || data.items.length === 0 ? (
        <div className="px-4 py-3 text-xs text-gray-500 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl w-fit">
          환불 이력 없음
        </div>
      ) : (
        <TableShell>
          <THead>
            <Th align="left">시각</Th>
            <Th align="left">상담</Th>
            <Th align="left">회원</Th>
            <Th align="left">상담사</Th>
            <Th align="right">금액</Th>
            <Th align="center">상태</Th>
            <Th align="left">사유</Th>
            <Th align="left">처리자</Th>
          </THead>
          <TBody>
            {data.items.map((r) => {
              const s = STATUS_LABEL[r.status] ?? { label: r.status, color: 'gray' as BadgeColor }
              return (
                <Tr key={r.id} onClick={() => navigate(`/consultations/${r.consultation_id}`)}>
                  <Td align="left" className="text-xs text-gray-500 tabular-nums">{r.created_at.slice(0, 16).replace('T', ' ')}</Td>
                  <Td align="left">
                    <Link to={`/consultations/${r.consultation_id}`} onClick={(e) => e.stopPropagation()} className="text-brand-600 hover:underline font-medium">#{r.consultation_id}</Link>
                  </Td>
                  <Td align="left">
                    {r.member_mb_id ? (
                      <Link to={`/members/customers/${r.member_id}`} onClick={(e) => e.stopPropagation()} className="text-brand-600 hover:underline font-medium">{r.member_mb_id}</Link>
                    ) : <span className="text-gray-300">—</span>}
                  </Td>
                  <Td align="left">
                    {r.counselor_id && r.counselor_mb_id ? (
                      <Link to={`/members/counselors/${r.counselor_id}`} onClick={(e) => e.stopPropagation()} className="text-brand-600 hover:underline font-medium">{r.counselor_nickname || r.counselor_mb_id}</Link>
                    ) : <span className="text-gray-300">—</span>}
                  </Td>
                  <Td align="right" className="font-medium tabular-nums">{r.amount.toLocaleString()}P</Td>
                  <Td align="center"><Badge color={s.color}>{s.label}</Badge></Td>
                  <Td align="left" className="text-xs text-gray-600 max-w-[200px] truncate"><span title={r.reason}>{r.reason}</span></Td>
                  <Td align="left" className="text-xs text-gray-500">{r.decided_by ?? r.requested_by}</Td>
                </Tr>
              )
            })}
          </TBody>
        </TableShell>
      )}

      {data && data.total > 30 && (
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-2.5 py-1 border border-gray-200 dark:border-gray-700 rounded-md disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            이전
          </button>
          <span className="text-gray-500 tabular-nums">
            {page + 1} / {Math.ceil(data.total / 30)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={(page + 1) * 30 >= data.total}
            className="px-2.5 py-1 border border-gray-200 dark:border-gray-700 rounded-md disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            다음
          </button>
        </div>
      )}
    </div>
  )
}
