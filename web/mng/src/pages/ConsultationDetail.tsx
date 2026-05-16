import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'

/**
 * 어드민 — 상담 단건 상세 (Phase 9).
 *
 * 분쟁 추적용. 통화 시점 단가/등급 스냅샷 노출 + 회원·상담사 양쪽 링크.
 */

interface Detail {
  id: number
  no: number | null
  eventtm: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
  csrid: string | null
  membid: string | null
  caller_phone: string | null
  callee_phone: string | null
  callid: string | null
  roomid: string | null
  reason: string | null
  preflag: string | null
  usetm: number
  amt: number
  amt_free: number
  amt_pro: number
  is_paid: boolean
  is_settled: boolean
  is_absent_disconnect: boolean
  skip_charge: boolean
  member_id: number | null
  member_mb_id: string | null
  member_name: string | null
  counselor_id: number | null
  counselor_mb_id: string | null
  counselor_name: string | null
  counselor_nickname: string | null
  counselor_category: string | null
  counselor_unit_cost: number | null
  unit_cost_snapshot?: number | null
  grade_at_session?: string | null
  refunded_amount?: number
  refund_status?: string | null
}

const GRADE_LABEL: Record<string, string> = {
  preliminary: '예비파트너',
  partner1: '파트너1',
  partner2: '파트너2',
  partner3: '파트너3',
  partner4: '파트너4',
  partner5: '파트너5',
}

const fmtTime = (s: string | null) => (s ? s.slice(0, 19).replace('T', ' ') : '—')
const fmtDuration = (sec: number) => {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h > 0 ? `${h}시간 ${m}분 ${s}초` : `${m}분 ${s}초`
}

export default function ConsultationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [d, setD] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [refundSubmitting, setRefundSubmitting] = useState(false)

  const refresh = () => {
    setLoading(true)
    api<Detail>(`/admin/consultations/${id}`)
      .then((r) => setD(r))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api<Detail>(`/admin/consultations/${id}`)
      .then((r) => !cancelled && setD(r))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id])

  const submitRefund = async () => {
    if (!d) return
    const amount = Number(refundAmount)
    if (!Number.isFinite(amount) || amount <= 0 || !refundReason.trim()) return
    setRefundSubmitting(true)
    try {
      await api('/admin/refunds', {
        method: 'POST',
        body: JSON.stringify({
          consultation_id: d.id,
          amount,
          reason: refundReason.trim(),
        }),
      })
      setRefundOpen(false)
      setRefundAmount('')
      setRefundReason('')
      refresh()
      alert('환불 처리 완료 — 회원에게 포인트 환원됨')
    } catch (e) {
      alert(e instanceof Error ? e.message : '환불 처리 실패')
    } finally {
      setRefundSubmitting(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">로딩...</div>
  if (error) return <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>
  if (!d) return null

  const isChat = d.reason === 'END_CHAT' || d.reason === 'END_CHAT_LOCAL'
  const typeBadge = isChat ? '채팅' : d.preflag === 'Y' ? '선불(070)' : '후불(060)'
  const snapshotUnit = d.unit_cost_snapshot
  const snapshotGrade = d.grade_at_session

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">상담 상세 #{d.id}</h1>
          <p className="text-xs text-gray-500 mt-1">분쟁 추적용 — 통화 시점 단가/등급 + 정산 정보</p>
        </div>
        <div className="flex gap-2">
          {d.member_id && d.amt > (d.refunded_amount ?? 0) && (
            <button
              onClick={() => setRefundOpen(true)}
              className="px-3 py-2 text-sm rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
            >
              환불 처리
            </button>
          )}
          <button
            onClick={() => navigate(-1)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            ← 목록으로
          </button>
        </div>
      </div>

      {(d.refunded_amount ?? 0) > 0 && (
        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-sm">
          ⚠ <span className="font-medium">환불 발생</span>:{' '}
          {(d.refunded_amount ?? 0).toLocaleString()}P 환불 처리됨 ({d.refund_status === 'full' ? '전액' : '부분'}).
          정산 시 해당 금액만큼 차감됨.
        </div>
      )}

      {/* 상단: 상태 + 기본정보 */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card label="유형" value={typeBadge} accent={isChat ? 'purple' : d.preflag === 'Y' ? 'amber' : 'gray'} />
        <Card label="통화 시간" value={fmtDuration(d.usetm)} />
        <Card
          label="결제 금액 (포인트)"
          value={`${d.amt.toLocaleString()}원`}
          subline={`무료 ${d.amt_free.toLocaleString()} / 유료 ${d.amt_pro.toLocaleString()}`}
        />
        <Card
          label="정산 상태"
          value={d.is_settled ? '정산 완료' : '대기'}
          accent={d.is_settled ? 'green' : 'gray'}
        />
      </section>

      {/* 통화 시점 스냅샷 — 분쟁 추적 핵심 */}
      <section className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-3">
          ⭐ 통화 시점 등급/단가 스냅샷 (분쟁 시 증거)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-gray-500">통화 시점 단가 (30초)</div>
            <div className="font-bold mt-1">
              {snapshotUnit ? `${snapshotUnit.toLocaleString()}원` : '— (Phase 2 이전 통화)'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">통화 시점 등급</div>
            <div className="font-bold mt-1">
              {snapshotGrade ? GRADE_LABEL[snapshotGrade] ?? snapshotGrade : '— (Phase 2 이전 통화)'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">현재 상담사 단가 (참고)</div>
            <div className="text-gray-700 mt-1">
              {d.counselor_unit_cost ? `${d.counselor_unit_cost.toLocaleString()}원` : '—'}
            </div>
          </div>
        </div>
        {snapshotUnit && d.counselor_unit_cost && snapshotUnit !== d.counselor_unit_cost && (
          <p className="text-xs text-amber-700 mt-3">
            ⚠ 통화 시점 단가({snapshotUnit.toLocaleString()}원)와 현재 단가({d.counselor_unit_cost.toLocaleString()}원)가 다릅니다. 분쟁 시 통화 시점 단가 기준으로 처리.
          </p>
        )}
      </section>

      {/* 양방 정보 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <h2 className="text-sm font-semibold mb-3">회원</h2>
          {d.member_id && d.member_mb_id ? (
            <Link
              to={`/members/customers/${d.member_id}`}
              className="text-brand-600 hover:underline font-medium"
            >
              {d.member_mb_id}
            </Link>
          ) : (
            <span className="text-gray-400">(회원 없음 — 전화 매칭 미연결)</span>
          )}
          <dl className="mt-3 space-y-1 text-xs">
            <Row label="이름" value={d.member_name} />
            <Row label="전화 (caller)" value={d.caller_phone} />
            <Row label="membid" value={d.membid} mono />
          </dl>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <h2 className="text-sm font-semibold mb-3">상담사</h2>
          {d.counselor_id && d.counselor_mb_id ? (
            <Link
              to={`/members/counselors/${d.counselor_id}/grade-detail`}
              className="text-brand-600 hover:underline font-medium"
            >
              {d.counselor_nickname || d.counselor_name || d.counselor_mb_id}
            </Link>
          ) : (
            <span className="text-gray-400">—</span>
          )}
          <dl className="mt-3 space-y-1 text-xs">
            <Row label="아이디" value={d.counselor_mb_id} />
            <Row label="분야" value={d.counselor_category} />
            <Row label="csrid" value={d.csrid} mono />
            <Row label="callee (콜백 번호)" value={d.callee_phone} />
          </dl>
        </section>
      </div>

      {/* 시간 + 식별자 */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
        <h2 className="text-sm font-semibold mb-3">시간 / 식별자</h2>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <Row label="시작" value={fmtTime(d.started_at)} block />
          <Row label="종료" value={fmtTime(d.ended_at)} block />
          <Row label="m2net eventtm" value={fmtTime(d.eventtm)} block />
          <Row label="기록 created_at" value={fmtTime(d.created_at)} block />
          <Row label="reason" value={d.reason} mono block />
          <Row label="callid" value={d.callid} mono block />
          <Row label="roomid" value={d.roomid} mono block />
          <Row label="consultation.no" value={d.no?.toString() ?? null} block />
        </dl>
      </section>

      {/* 플래그 */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
        <h2 className="text-sm font-semibold mb-3">플래그</h2>
        <div className="flex flex-wrap gap-2 text-xs">
          <Flag on={d.is_paid} label="유료" />
          <Flag on={d.is_settled} label="정산완료" />
          <Flag on={d.is_absent_disconnect} label="부재중연결" />
          <Flag on={d.skip_charge} label="차감스킵" />
          {d.preflag === 'Y' && <Flag on={true} label="선불(preflag=Y)" />}
        </div>
      </section>

      {isChat && d.roomid && (
        <Link
          to={`/chat-history/by-roomid?roomid=${encodeURIComponent(d.roomid)}`}
          className="inline-block px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white"
        >
          채팅 내역 보기 →
        </Link>
      )}

      {/* 환불 처리 모달 */}
      {refundOpen && d && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md mx-4 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">환불 처리</h3>
              <button onClick={() => setRefundOpen(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div className="p-3 rounded bg-gray-50 dark:bg-gray-700 text-xs">
                <div>상담 #{d.id} · 통화 시간 {fmtDuration(d.usetm)}</div>
                <div className="mt-1">
                  총 결제: <span className="font-medium">{d.amt.toLocaleString()}P</span>
                  {(d.refunded_amount ?? 0) > 0 && (
                    <span className="ml-2 text-amber-600">
                      (기환불 {(d.refunded_amount ?? 0).toLocaleString()}P · 잔여{' '}
                      {(d.amt - (d.refunded_amount ?? 0)).toLocaleString()}P)
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">환불 금액 (P, 양수)</label>
                <input
                  type="number"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder={`최대 ${(d.amt - (d.refunded_amount ?? 0)).toLocaleString()}`}
                  className="w-full mt-1 px-3 py-2 border rounded text-sm bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">사유 (필수, 이력에 기록됨)</label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                  placeholder="예: 상담사 일방적 종료, 통화 품질 문제, ..."
                  className="w-full mt-1 px-3 py-2 border rounded text-sm bg-white dark:bg-gray-700"
                />
              </div>
              <div className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300 p-2 rounded">
                ⚠ 환불 즉시 회원에게 포인트 환원됩니다. 정산 시 상담사 정산금에서도 차감됩니다. 되돌릴 수 없습니다.
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => setRefundOpen(false)}
                  className="px-4 py-2 text-sm border rounded"
                >
                  취소
                </button>
                <button
                  disabled={!refundAmount || !refundReason.trim() || refundSubmitting}
                  onClick={() => void submitRefund()}
                  className="px-4 py-2 text-sm rounded bg-rose-600 text-white disabled:opacity-50"
                >
                  {refundSubmitting ? '처리 중...' : '환불 확정'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Card({
  label,
  value,
  subline,
  accent,
}: {
  label: string
  value: string
  subline?: string
  accent?: 'gray' | 'purple' | 'amber' | 'green'
}) {
  const bg =
    accent === 'purple'
      ? 'bg-purple-50 dark:bg-purple-900/20'
      : accent === 'amber'
        ? 'bg-amber-50 dark:bg-amber-900/20'
        : accent === 'green'
          ? 'bg-emerald-50 dark:bg-emerald-900/20'
          : 'bg-white dark:bg-gray-800'
  return (
    <div className={`rounded-lg shadow p-4 ${bg}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
      {subline && <div className="text-[11px] text-gray-400 mt-1">{subline}</div>}
    </div>
  )
}

function Row({
  label,
  value,
  mono,
  block,
}: {
  label: string
  value: string | null
  mono?: boolean
  block?: boolean
}) {
  return (
    <div className={block ? '' : 'flex items-center gap-2'}>
      <dt className="text-gray-500">{label}</dt>
      <dd className={`text-gray-800 dark:text-gray-200 ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</dd>
    </div>
  )
}

function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`px-2 py-1 rounded ${
        on
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
          : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
      }`}
    >
      {on ? '✓ ' : '✗ '}
      {label}
    </span>
  )
}
