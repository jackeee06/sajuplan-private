import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

/**
 * 어드민 — 등급/단가 관리 (Phase 8).
 *
 * 3 영역:
 *  1) 등급별 상담사 분포 (6 등급 카드)
 *  2) 최근 등급 변동 이력 (cron + 어드민 수동)
 *  3) 정책 변경 이력 (setting_history 전체)
 *
 * 개별 상담사 등급/단가 강제 수정은 회원 상세(CounselorForm) 페이지에서.
 */

interface DistRow {
  grade: string
  grade_label: string
  count: number
}

interface GradeChangeRow {
  id: number
  member_id: number
  mb_id: string | null
  nickname: string | null
  grade_before: string | null
  grade_after: string
  change_type: string
  changed_by: string
  created_at: string
}

interface SettingHistoryRow {
  id: number
  namespace: string
  key: string
  value_before: string | null
  value_after: string | null
  changed_by: string
  created_at: string
}

const GRADE_COLORS: Record<string, string> = {
  preliminary: 'bg-gray-100 text-gray-700',
  partner1: 'bg-blue-50 text-blue-700',
  partner2: 'bg-indigo-50 text-indigo-700',
  partner3: 'bg-purple-50 text-purple-700',
  partner4: 'bg-pink-50 text-pink-700',
  partner5: 'bg-rose-100 text-rose-700',
}

const CHANGE_TYPE_LABEL: Record<string, string> = {
  promote: '⬆ 승급',
  demote: '⬇ 강등',
  manual: '✋ 수동',
  initial: '🆕 신규',
  unchanged: '— 유지',
}

export default function GradeManagement() {
  const [dist, setDist] = useState<DistRow[]>([])
  const [changes, setChanges] = useState<GradeChangeRow[]>([])
  const [settings, setSettings] = useState<SettingHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      api<{ items: DistRow[] }>('/admin/grade/distribution'),
      api<{ items: GradeChangeRow[] }>('/admin/grade/recent-changes?limit=50'),
      api<{ items: SettingHistoryRow[] }>('/admin/settings/history/list?namespace=grade&limit=50'),
    ])
      .then(([d, c, s]) => {
        if (cancelled) return
        setDist(d.items)
        setChanges(c.items)
        setSettings(s.items)
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const total = dist.reduce((s, r) => s + r.count, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">등급 관리</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          상담사 등급 분포 + 최근 등급 변동 + 정책 변경 이력. 개별 상담사 수정은 상담사 상세 페이지에서.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">로딩...</div>
      ) : (
        <>
          {/* 1) 분포 카드 */}
          <section>
            <h2 className="text-base font-medium text-gray-700 dark:text-gray-200 mb-3">
              등급별 분포 <span className="text-xs text-gray-400">(활동 상담사 {total}명)</span>
            </h2>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {dist.map((r) => (
                <div
                  key={r.grade}
                  className={`rounded-lg px-4 py-3 ${GRADE_COLORS[r.grade] ?? 'bg-gray-50 text-gray-700'}`}
                >
                  <div className="text-xs opacity-70">{r.grade_label}</div>
                  <div className="text-2xl font-bold mt-1 tabular-nums">{r.count}</div>
                  <div className="text-[10px] opacity-60 mt-0.5">
                    {total > 0 ? `${Math.round((r.count / total) * 100)}%` : '0%'}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 2) 최근 등급 변동 */}
            <section>
              <h2 className="text-base font-medium text-gray-700 dark:text-gray-200 mb-3">
                최근 등급 변동 <span className="text-xs text-gray-400">({changes.length}건)</span>
              </h2>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                {changes.length === 0 ? (
                  <div className="p-6 text-sm text-gray-500 text-center">아직 변동 없음</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">
                      <tr>
                        <th className="px-3 py-2 text-left">시각</th>
                        <th className="px-3 py-2 text-left">상담사</th>
                        <th className="px-3 py-2 text-left">변경</th>
                        <th className="px-3 py-2 text-left">유형</th>
                        <th className="px-3 py-2 text-left">주체</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {changes.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-3 py-2 text-xs text-gray-500">
                            {c.created_at.slice(0, 16).replace('T', ' ')}
                          </td>
                          <td className="px-3 py-2">
                            <Link
                              to={`/members/counselors/${c.member_id}`}
                              className="text-brand-600 hover:underline"
                            >
                              {c.nickname || c.mb_id || `#${c.member_id}`}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <span className="text-gray-500">{c.grade_before ?? '—'}</span>
                            <span className="mx-1">→</span>
                            <span className="font-medium">{c.grade_after}</span>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {CHANGE_TYPE_LABEL[c.change_type] ?? c.change_type}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">{c.changed_by}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            {/* 3) 정책 변경 이력 */}
            <section>
              <h2 className="text-base font-medium text-gray-700 dark:text-gray-200 mb-3">
                정책 변경 이력{' '}
                <span className="text-xs text-gray-400">(grade ns, {settings.length}건)</span>
              </h2>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                {settings.length === 0 ? (
                  <div className="p-6 text-sm text-gray-500 text-center">아직 변경 없음</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">
                      <tr>
                        <th className="px-3 py-2 text-left">시각</th>
                        <th className="px-3 py-2 text-left">키</th>
                        <th className="px-3 py-2 text-left">변경</th>
                        <th className="px-3 py-2 text-left">주체</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {settings.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-3 py-2 text-xs text-gray-500">
                            {s.created_at.slice(0, 16).replace('T', ' ')}
                          </td>
                          <td className="px-3 py-2 text-xs font-mono">{s.key}</td>
                          <td className="px-3 py-2 text-xs">
                            <span className="text-gray-500">
                              {s.value_before ? s.value_before.slice(0, 20) : '—'}
                            </span>
                            <span className="mx-1">→</span>
                            <span className="font-medium">{s.value_after ?? '—'}</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">{s.changed_by}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
