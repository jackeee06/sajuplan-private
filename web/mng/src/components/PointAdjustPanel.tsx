import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { TONE_BADGE_CLS, labelActorType } from '../lib/labels'

interface PointHistoryItem {
  id: number
  earn_point: number
  use_point: number
  balance_after: number
  is_paid: boolean
  content: string | null
  rel_action: string | null
  actor_admin_login_id: string | null
  actor_type: string
  created_at: string
}

interface Props {
  memberId: number
  currentPoint: number
  onAdjusted: (newBalance: number) => void
}

export default function PointAdjustPanel({ memberId, currentPoint, onAdjusted }: Props) {
  const [history, setHistory] = useState<PointHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('')
  const [isPaid, setIsPaid] = useState(false)
  const [expireDate, setExpireDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await api<{ items: PointHistoryItem[]; total: number }>(
        `/admin/members/customers/${memberId}/point-history?limit=10`,
      )
      setHistory(res.items)
    } catch (e) {
      console.error('포인트 이력 로드 실패', e)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    void loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId])

  const onSubmitClick = () => {
    setError(null)
    const num = Number(delta)
    if (!Number.isInteger(num) || num === 0) {
      setError('변동값은 0이 아닌 정수여야 합니다. (양수 = 적립, 음수 = 차감)')
      return
    }
    if (!reason.trim()) {
      setError('사유를 입력하세요.')
      return
    }
    if (reason.trim().length > 500) {
      setError('사유는 500자 이하로 입력해주세요.')
      return
    }
    setConfirmOpen(true)
  }

  const onConfirm = async () => {
    setConfirmOpen(false)
    setSubmitting(true)
    setError(null)
    try {
      const res = await api<{
        balanceAfter: number
        freeBalance: number
        paidBalance: number
      }>(`/admin/members/customers/${memberId}/point-adjust`, {
        method: 'POST',
        body: JSON.stringify({
          delta: Number(delta),
          reason: reason.trim(),
          isPaid,
          expireDate: expireDate || undefined,
        }),
      })
      onAdjusted(res.balanceAfter)
      setDelta('')
      setReason('')
      setIsPaid(false)
      setExpireDate('')
      await loadHistory()
    } catch (e) {
      setError(e instanceof Error ? e.message : '포인트 조정 실패')
    } finally {
      setSubmitting(false)
    }
  }

  const numDelta = Number(delta)
  const isValidNum = Number.isInteger(numDelta) && numDelta !== 0
  const balanceAfter = isValidNum ? currentPoint + numDelta : currentPoint

  return (
    <>
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-200">
          포인트 조정
          <span className="ml-2 text-xs font-normal text-gray-400">트랜잭션 + 감사로그 (관리자 ID/IP 자동 기록)</span>
        </div>

        <div className="p-5 space-y-3">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">현재 잔액</label>
              <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                {currentPoint.toLocaleString()} P
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">조정 후 예상 잔액</label>
              <div
                className={`text-lg font-semibold ${
                  isValidNum
                    ? numDelta > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                    : 'text-gray-400'
                }`}
              >
                {balanceAfter.toLocaleString()} P
                {isValidNum && (
                  <span className="ml-2 text-xs">
                    ({numDelta > 0 ? '+' : ''}
                    {numDelta.toLocaleString()})
                  </span>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">변동값 (양수=적립 / 음수=차감)</label>
              <input
                type="text"
                inputMode="numeric"
                value={delta}
                onChange={(e) => setDelta(e.target.value.replace(/[^\-0-9]/g, ''))}
                placeholder="예: 1000 또는 -500"
                className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">
                사유 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                placeholder="예: 이벤트 보상, 시스템 오류 보정, 환불 처리 등"
                className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">포인트 종류</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaid(false)}
                  className={`px-3 py-2 text-sm rounded-md border ${
                    !isPaid
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  무료
                </button>
                <button
                  type="button"
                  onClick={() => setIsPaid(true)}
                  className={`px-3 py-2 text-sm rounded-md border ${
                    isPaid
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  유료
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">소멸 예정일 (옵션)</label>
              <input
                type="date"
                value={expireDate}
                onChange={(e) => setExpireDate(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onSubmitClick}
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50"
            >
              {submitting ? '처리 중...' : '조정 적용'}
            </button>
          </div>
        </div>
      </div>

      {/* 최근 이력 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">최근 포인트 이력</div>
          <Link
            to={`/points/history?member=${memberId}`}
            className="text-xs text-brand-600 hover:underline"
          >
            전체 이력 보기 →
          </Link>
        </div>

        {historyLoading && history.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">로딩...</div>
        ) : history.length === 0 ? (
          <div className="p-6 text-sm text-gray-400">변동 이력이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-600 dark:bg-brand-700 text-xs text-white">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">일시</th>
                  <th className="px-4 py-2 text-right font-medium">변동</th>
                  <th className="px-4 py-2 text-right font-medium">잔액</th>
                  <th className="px-4 py-2 text-left font-medium">사유</th>
                  <th className="px-4 py-2 text-left font-medium">출처</th>
                  <th className="px-4 py-2 text-left font-medium">처리자</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {history.map((h) => {
                  const variation = h.earn_point - h.use_point
                  return (
                    <tr key={h.id}>
                      <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(h.created_at)}
                      </td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <span
                          className={
                            variation > 0
                              ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                              : 'text-rose-600 dark:text-rose-400 font-medium'
                          }
                        >
                          {variation > 0 ? '+' : ''}
                          {variation.toLocaleString()}
                        </span>
                        {h.is_paid && (
                          <span className="ml-1 inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px]">
                            유료
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {h.balance_after.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300 max-w-[300px] truncate">
                        {h.content || '-'}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        <ActorTypeBadge type={h.actor_type} />
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                        {h.actor_admin_login_id || '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 확인 모달 */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-[90%] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3">
              포인트 조정 확인
            </h3>
            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <div>
                변동:{' '}
                <span
                  className={
                    numDelta > 0
                      ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                      : 'font-semibold text-rose-600 dark:text-rose-400'
                  }
                >
                  {numDelta > 0 ? '+' : ''}
                  {numDelta.toLocaleString()} P ({isPaid ? '유료' : '무료'})
                </span>
              </div>
              <div>
                예상 잔액:{' '}
                <span className="font-semibold">{balanceAfter.toLocaleString()} P</span>
              </div>
              <div className="text-xs text-gray-500 break-words">사유: {reason}</div>
              {expireDate && <div className="text-xs text-gray-500">소멸 예정일: {expireDate}</div>}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                취소
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white"
              >
                확인 적용
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function formatDate(s: string): string {
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

function ActorTypeBadge({ type }: { type: string }) {
  const m = labelActorType(type)
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${TONE_BADGE_CLS[m.tone]}`}>{m.label}</span>
}
