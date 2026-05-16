import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'

/**
 * 어드민 — 상담사 등급/단가 상세 + 강제 수정 + 이력 (Phase 8).
 *
 * 분쟁/예외 대응 도구. 정상 흐름은 매월 1일 크론.
 */

interface GradeDetail {
  member: { id: number; mb_id: string | null; nickname: string | null }
  grade: string
  grade_label: string
  last_month_seconds: number
  last_month_hours: number
  current_unit_cost: number
  call_070_unit_cost: number
  chat_unit_cost: number
  unit_cost_changeable_at: string | null
  grade_recalculated_at: string | null
  available_options: number[]
}

interface UnitCostHistoryRow {
  id: number
  grade_at_change: string
  unit_cost_before: number | null
  unit_cost_after: number | null
  changed_by: string
  reason: string | null
  created_at: string
}

interface GradeHistoryRow {
  id: number
  grade_before: string | null
  grade_after: string
  last_month_seconds: string | null
  change_type: string
  changed_by: string
  reason: string | null
  created_at: string
}

const GRADES = ['preliminary', 'partner1', 'partner2', 'partner3', 'partner4', 'partner5']
const GRADE_LABELS: Record<string, string> = {
  preliminary: '예비파트너',
  partner1: '파트너1',
  partner2: '파트너2',
  partner3: '파트너3',
  partner4: '파트너4',
  partner5: '파트너5',
}

export default function CounselorGradeDetail() {
  const { id } = useParams<{ id: string }>()
  const memberId = Number(id)
  const navigate = useNavigate()

  const [detail, setDetail] = useState<GradeDetail | null>(null)
  const [unitHist, setUnitHist] = useState<UnitCostHistoryRow[]>([])
  const [gradeHist, setGradeHist] = useState<GradeHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 모달 상태
  const [gradeModal, setGradeModal] = useState(false)
  const [unitModal, setUnitModal] = useState(false)
  const [newGrade, setNewGrade] = useState<string>('')
  const [newUnit, setNewUnit] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const refresh = async () => {
    if (!Number.isFinite(memberId) || memberId <= 0) {
      setError('잘못된 회원 ID')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [d, u, g] = await Promise.all([
        api<GradeDetail>(`/admin/grade/counselor/${memberId}`),
        api<{ items: UnitCostHistoryRow[] }>(`/admin/grade/counselor/${memberId}/unit-cost-history`),
        api<{ items: GradeHistoryRow[] }>(`/admin/grade/counselor/${memberId}/grade-history`),
      ])
      setDetail(d)
      setUnitHist(u.items)
      setGradeHist(g.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : '로딩 실패')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId])

  const submitGrade = async () => {
    if (!newGrade || !reason.trim()) return
    setSubmitting(true)
    try {
      await api(`/admin/grade/counselor/${memberId}/grade`, {
        method: 'PATCH',
        body: JSON.stringify({ grade: newGrade, reason: reason.trim() }),
      })
      setGradeModal(false)
      setReason('')
      setNewGrade('')
      await refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : '실패')
    } finally {
      setSubmitting(false)
    }
  }

  const submitUnit = async () => {
    const n = Number(newUnit)
    if (!Number.isFinite(n) || n < 0 || !reason.trim()) return
    setSubmitting(true)
    try {
      await api(`/admin/grade/counselor/${memberId}/unit-cost`, {
        method: 'PATCH',
        body: JSON.stringify({ unit_cost: n, reason: reason.trim() }),
      })
      setUnitModal(false)
      setReason('')
      setNewUnit('')
      await refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : '실패')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">로딩...</div>
  if (error) return <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>
  if (!detail) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            등급/단가 상세 · {detail.member.nickname || detail.member.mb_id || `#${detail.member.id}`}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            분쟁/예외 대응용 강제 수정 도구. 정상 흐름은 매월 1일 크론에서 자동 처리됨.
          </p>
        </div>
        <button
          onClick={() => navigate(`/members/counselors/${memberId}`)}
          className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          ← 상담사 정보로
        </button>
      </div>

      {/* 현재 상태 카드 */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="text-xs text-gray-500">현재 등급</div>
          <div className="text-2xl font-bold mt-1">{detail.grade_label}</div>
          <button
            onClick={() => setGradeModal(true)}
            className="mt-2 text-xs text-brand-600 hover:underline"
          >
            강제 등급 변경
          </button>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="text-xs text-gray-500">직전 1개월 시간</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{detail.last_month_hours}h</div>
          <div className="text-xs text-gray-400 mt-2">({detail.last_month_seconds.toLocaleString()}초)</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="text-xs text-gray-500">현재 단가 (30초)</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{detail.current_unit_cost.toLocaleString()}원</div>
          <button
            onClick={() => setUnitModal(true)}
            className="mt-2 text-xs text-brand-600 hover:underline"
          >
            강제 단가 변경
          </button>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="text-xs text-gray-500">단가 변경 가능</div>
          <div className="text-sm font-medium mt-1">
            {detail.unit_cost_changeable_at
              ? new Date(detail.unit_cost_changeable_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }).slice(0, 17)
              : '즉시 가능'}
          </div>
          <div className="text-xs text-gray-400 mt-2">
            마지막 등급 재산정:{' '}
            {detail.grade_recalculated_at
              ? new Date(detail.grade_recalculated_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }).slice(0, 17)
              : '없음'}
          </div>
        </div>
      </section>

      <div className="text-xs text-gray-500">
        현재 등급의 정책 단가 옵션:{' '}
        <span className="font-mono">
          {detail.available_options.length > 0 ? detail.available_options.map((n) => `${n}원`).join(' / ') : '(미설정)'}
        </span>
      </div>

      {/* 이력 2종 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <h2 className="text-base font-medium mb-3">단가 변경 이력</h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            {unitHist.length === 0 ? (
              <div className="p-6 text-sm text-gray-500 text-center">이력 없음</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">
                  <tr>
                    <th className="px-3 py-2 text-left">시각</th>
                    <th className="px-3 py-2 text-left">등급</th>
                    <th className="px-3 py-2 text-left">변경</th>
                    <th className="px-3 py-2 text-left">주체</th>
                    <th className="px-3 py-2 text-left">사유</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {unitHist.map((h) => (
                    <tr key={h.id}>
                      <td className="px-3 py-2 text-xs text-gray-500">{h.created_at.slice(0, 16).replace('T', ' ')}</td>
                      <td className="px-3 py-2 text-xs">{GRADE_LABELS[h.grade_at_change] ?? h.grade_at_change}</td>
                      <td className="px-3 py-2 text-xs tabular-nums">
                        {h.unit_cost_before ?? '—'} → <span className="font-medium">{h.unit_cost_after}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">{h.changed_by}</td>
                      <td className="px-3 py-2 text-xs">{h.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-base font-medium mb-3">등급 변동 이력</h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            {gradeHist.length === 0 ? (
              <div className="p-6 text-sm text-gray-500 text-center">이력 없음</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">
                  <tr>
                    <th className="px-3 py-2 text-left">시각</th>
                    <th className="px-3 py-2 text-left">변경</th>
                    <th className="px-3 py-2 text-left">유형</th>
                    <th className="px-3 py-2 text-left">주체</th>
                    <th className="px-3 py-2 text-left">사유</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {gradeHist.map((h) => (
                    <tr key={h.id}>
                      <td className="px-3 py-2 text-xs text-gray-500">{h.created_at.slice(0, 16).replace('T', ' ')}</td>
                      <td className="px-3 py-2 text-xs">
                        {h.grade_before ?? '—'} → <span className="font-medium">{h.grade_after}</span>
                      </td>
                      <td className="px-3 py-2 text-xs">{h.change_type}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{h.changed_by}</td>
                      <td className="px-3 py-2 text-xs">{h.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {/* 강제 등급 변경 모달 */}
      {gradeModal && (
        <Modal title="강제 등급 변경" onClose={() => setGradeModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500">새 등급</label>
              <select
                value={newGrade}
                onChange={(e) => setNewGrade(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded text-sm bg-white dark:bg-gray-700"
              >
                <option value="">선택</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {GRADE_LABELS[g]} ({g})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">사유 (필수, 이력에 기록됨)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="예: 분쟁 처리, 신규 가입 보정, ..."
                className="w-full mt-1 px-3 py-2 border rounded text-sm bg-white dark:bg-gray-700"
              />
            </div>
            <p className="text-xs text-gray-500">
              변경 시 unit_cost_changeable_at = NULL 로 리셋되어 상담사가 즉시 새 단가를 선택할 수 있습니다.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setGradeModal(false)}
                className="px-4 py-2 text-sm border rounded"
              >
                취소
              </button>
              <button
                disabled={!newGrade || !reason.trim() || submitting}
                onClick={() => void submitGrade()}
                className="px-4 py-2 text-sm rounded bg-brand-600 text-white disabled:opacity-50"
              >
                {submitting ? '처리 중...' : '확정'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 강제 단가 변경 모달 */}
      {unitModal && (
        <Modal title="강제 단가 변경" onClose={() => setUnitModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500">새 단가 (30초당, 원)</label>
              <input
                type="number"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                placeholder="예: 1200"
                className="w-full mt-1 px-3 py-2 border rounded text-sm bg-white dark:bg-gray-700"
              />
              <p className="text-xs text-gray-400 mt-1">
                정책 옵션 외 값도 입력 가능 (어드민 권한). call/chat 양쪽 동일 적용.
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500">사유 (필수)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="예: 분쟁 보상, 신규 가입자 임시 조정, ..."
                className="w-full mt-1 px-3 py-2 border rounded text-sm bg-white dark:bg-gray-700"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setUnitModal(false)}
                className="px-4 py-2 text-sm border rounded"
              >
                취소
              </button>
              <button
                disabled={!newUnit || !reason.trim() || submitting}
                onClick={() => void submitUnit()}
                className="px-4 py-2 text-sm rounded bg-brand-600 text-white disabled:opacity-50"
              >
                {submitting ? '처리 중...' : '확정'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md mx-4 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
