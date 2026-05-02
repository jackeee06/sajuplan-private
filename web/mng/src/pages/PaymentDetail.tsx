import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'
import {
  TONE_BADGE_CLS,
  labelCancelMethod,
  labelPayMethod,
  labelPaymentStatus,
  labelPgReqResult,
} from '../lib/labels'

interface CancelLog {
  id: number
  log_date: string
  started_at: string
  finished_at: string | null
  duration_ms: number | null
  is_success: boolean
  req_result: string | null
  result_message: string | null
  http_status: number | null
  oid: string | null
  tid: string | null
  refund_amount: number
  refund_coin: number
  refund_reason: string | null
  is_partial: boolean
  cancel_method: string
  actor_admin_id: number | null
  actor_admin_mb_id: string | null
  actor_ip: string | null
}

interface Detail {
  id: number
  member_id: number | null
  mb_id: string | null
  member_name: string | null
  oid: string
  tid: string | null
  pay_method: string | null
  amount: number
  coin_amount: number
  cancelled_amount: number
  cancel_count: number
  status: string
  req_result: string | null
  result_message: string | null
  bank_name: string | null
  vr_account: string | null
  deposit_name: string | null
  deposit_time: string | null
  cancelled_at: string | null
  created_at: string
  cancel_logs: CancelLog[]
}

export default function PaymentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // cancel form
  const [refundAmount, setRefundAmount] = useState('')
  const [refundCoin, setRefundCoin] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    api<Detail>(`/admin/payments/${id}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [id])

  const onPrefillFull = () => {
    if (!data) return
    setRefundAmount(String(data.amount - data.cancelled_amount))
    setRefundCoin(String(data.coin_amount))
  }

  const onCancelSubmit = async () => {
    setCancelError(null)
    if (!data) return
    const amt = Number(refundAmount || 0)
    const coin = Number(refundCoin || 0)
    if (amt === 0 && coin === 0) {
      setCancelError('환불 금액 또는 환불 코인 중 하나는 0보다 커야 합니다.')
      return
    }
    if (amt < 0 || coin < 0) {
      setCancelError('음수는 입력할 수 없습니다.')
      return
    }
    if (!refundReason.trim()) {
      setCancelError('환불 사유는 필수입니다.')
      return
    }
    const remaining = data.amount - data.cancelled_amount
    if (amt > remaining) {
      setCancelError(`환불 가능 금액 ${remaining.toLocaleString()}원을 초과합니다.`)
      return
    }
    setCancelOpen(true)
  }

  const onConfirm = async () => {
    setCancelOpen(false)
    setSubmitting(true)
    setCancelError(null)
    try {
      const res = await api<{
        ok: boolean
        refundAmount: number
        refundCoin: number
        newStatus: string
      }>(`/admin/payments/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({
          refundAmount: Number(refundAmount || 0),
          refundCoin: Number(refundCoin || 0),
          refundReason: refundReason.trim(),
        }),
      })
      setSuccess(`환불 완료: ${res.refundAmount.toLocaleString()}원 / 코인 ${res.refundCoin.toLocaleString()}P · 상태: ${res.newStatus}`)
      setRefundAmount('')
      setRefundCoin('')
      setRefundReason('')
      load()
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : '환불 실패')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">로딩...</div>
  if (error) return <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>
  if (!data) return null

  const remaining = data.amount - data.cancelled_amount
  const canCancel = data.status === 'completed' && remaining > 0

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/payments')}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">결제 상세 #{id}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">주문번호 {data.oid}</p>
        </div>
      </div>

      {success && (
        <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-sm">
          {success}
        </div>
      )}

      {/* 결제 요약 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-200">
          결제 정보
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
          <Field label="회원">
            {data.member_id ? (
              <Link to={`/members/customers/${data.member_id}`} className="text-brand-600 hover:underline">
                {data.member_name || data.mb_id || `#${data.member_id}`}
              </Link>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </Field>
          <Field label="결제일">{formatDate(data.created_at)}</Field>
          <Field label="결제 수단">{labelPayMethod(data.pay_method)}</Field>
          <Field label="거래코드">{data.tid || '-'}</Field>
          <Field label="결제 금액">
            <span className="text-base font-semibold">{data.amount.toLocaleString()}원</span>
          </Field>
          <Field label="지급 코인">
            <span className="text-base font-semibold">{data.coin_amount.toLocaleString()}P</span>
          </Field>
          <Field label="상태">
            <StatusBadge status={data.status} />
          </Field>
          <Field label="환불 누계">
            {data.cancelled_amount > 0 ? (
              <span className="text-rose-600 dark:text-rose-400">
                {data.cancelled_amount.toLocaleString()}원 ({data.cancel_count}회)
              </span>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </Field>
          {data.bank_name && <Field label="은행">{data.bank_name}</Field>}
          {data.vr_account && <Field label="가상계좌">{data.vr_account}</Field>}
          {data.deposit_name && <Field label="입금자">{data.deposit_name}</Field>}
          {data.deposit_time && <Field label="입금 시각">{data.deposit_time}</Field>}
          {data.req_result && (
            <Field label="결제 응답코드">
              <span className="font-mono text-xs text-gray-500 mr-2">{data.req_result}</span>
              <span>{labelPgReqResult(data.req_result)}</span>
            </Field>
          )}
          {data.result_message && (
            <Field label="결제 응답메시지">
              <span className="text-gray-500 text-xs">{data.result_message}</span>
            </Field>
          )}
          {data.cancelled_at && <Field label="최초 취소 시각">{formatDate(data.cancelled_at)}</Field>}
        </div>
      </div>

      {/* 취소 폼 */}
      {canCancel && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center justify-between">
            <span>환불/취소</span>
            <span className="text-xs font-normal text-gray-500">
              환불 가능 금액: {remaining.toLocaleString()}원
            </span>
          </div>
          <div className="p-5 space-y-3">
            {cancelError && (
              <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm">
                {cancelError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">환불 금액 (원)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder={`최대 ${remaining.toLocaleString()}`}
                  className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">환불 코인 (P) — 회원 잔액에서 회수</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={refundCoin}
                  onChange={(e) => setRefundCoin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder={`예: ${data.coin_amount.toLocaleString()}`}
                  className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">환불 사유 *</label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  maxLength={500}
                  placeholder="고객 요청, 시스템 오류 등"
                  className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={onPrefillFull}
                className="text-xs text-brand-600 hover:underline"
              >
                전액 환불로 미리채우기
              </button>
              <button
                type="button"
                onClick={onCancelSubmit}
                disabled={submitting}
                className="px-4 py-2 text-sm rounded-lg bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
              >
                {submitting ? '처리 중...' : '환불 적용'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 취소 이력 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-200">
          취소/환불 로그 ({data.cancel_logs.length}건)
        </div>
        {data.cancel_logs.length === 0 ? (
          <div className="p-6 text-sm text-gray-400">취소 내역 없음.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-600 dark:bg-brand-700 text-xs text-white">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">시각</th>
                  <th className="px-4 py-2 text-left font-medium">결과</th>
                  <th className="px-4 py-2 text-right font-medium">환불액</th>
                  <th className="px-4 py-2 text-right font-medium">코인 회수</th>
                  <th className="px-4 py-2 text-left font-medium">방식</th>
                  <th className="px-4 py-2 text-left font-medium">사유</th>
                  <th className="px-4 py-2 text-left font-medium">처리자</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.cancel_logs.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{formatDate(l.started_at)}</td>
                    <td className="px-4 py-2 text-xs">
                      {l.is_success ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px]">
                          성공
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-[10px]">
                          실패
                        </span>
                      )}
                      <span className="ml-1.5 text-[10px] text-gray-500">
                        {labelPgReqResult(l.req_result)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {l.refund_amount > 0 ? `${l.refund_amount.toLocaleString()}원` : '-'}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {l.refund_coin > 0 ? `${l.refund_coin.toLocaleString()}P` : '-'}
                    </td>
                    <td className="px-4 py-2 text-xs">{labelCancelMethod(l.cancel_method)}</td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300 max-w-[200px] truncate">
                      {l.refund_reason || '-'}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                      {l.actor_admin_mb_id || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 확인 모달 */}
      {cancelOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setCancelOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-[90%] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3">환불 확인</h3>
            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <div>
                환불 금액: <span className="font-semibold text-rose-600 dark:text-rose-400">
                  {Number(refundAmount || 0).toLocaleString()}원
                </span>
              </div>
              <div>
                코인 회수: <span className="font-semibold">{Number(refundCoin || 0).toLocaleString()}P</span>
              </div>
              <div className="text-xs text-gray-500 break-words">사유: {refundReason}</div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setCancelOpen(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                취소
              </button>
              <button
                onClick={onConfirm}
                className="px-4 py-2 text-sm rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
              >
                환불 적용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 items-baseline">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm text-gray-800 dark:text-gray-200">{children}</div>
    </div>
  )
}

function formatDate(s: string): string {
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

function StatusBadge({ status }: { status: string }) {
  const m = labelPaymentStatus(status)
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${TONE_BADGE_CLS[m.tone]}`}>{m.label}</span>
}
