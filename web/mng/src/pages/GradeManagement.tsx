import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { Th, Td, Tr, TableShell, THead, TBody, EmptyRow } from '../components/table'

/**
 * 어드민 — 등급/단가 관리 (Phase 8, 2026-05-22 개선).
 *
 * 4 영역:
 *  1) 헤더 — 다음 등급 재산정까지 D-day 표시
 *  2) 등급별 분포 + 정책 — 각 등급의 인원/정산률/단가 옵션 같이
 *  3) 최근 등급 변동 — cron + 어드민 수동 (0건이면 긍정 메시지)
 *  4) 정책 변경 이력 — 키를 한글 라벨로 표시
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

const GRADE_CARD_STYLE: Record<string, string> = {
  preliminary: 'bg-gray-50 border-gray-200 text-gray-800',
  partner1:    'bg-blue-50 border-blue-200 text-blue-900',
  partner2:    'bg-indigo-50 border-indigo-200 text-indigo-900',
  partner3:    'bg-purple-50 border-purple-200 text-purple-900',
  partner4:    'bg-pink-50 border-pink-200 text-pink-900',
  partner5:    'bg-rose-100 border-rose-200 text-rose-900',
}

const GRADE_ORDER = ['preliminary', 'partner1', 'partner2', 'partner3', 'partner4', 'partner5']

const CHANGE_TYPE_LABEL: Record<string, string> = {
  promote: '⬆ 승급',
  demote: '⬇ 강등',
  manual: '✋ 수동',
  initial: '🆕 신규',
  unchanged: '— 유지',
}

/** 설정 키(영문) → 한글 라벨 매핑 */
const SETTING_KEY_LABEL: Record<string, string> = {
  'revenue_rate.preliminary': '예비파트너 정산률',
  'revenue_rate.partner1':    '파트너1 정산률',
  'revenue_rate.partner2':    '파트너2 정산률',
  'revenue_rate.partner3':    '파트너3 정산률',
  'revenue_rate.partner4':    '파트너4 정산률',
  'revenue_rate.partner5':    '파트너5 정산률',
  'options.preliminary': '예비파트너 단가 옵션',
  'options.partner1':    '파트너1 단가 옵션',
  'options.partner2':    '파트너2 단가 옵션',
  'options.partner3':    '파트너3 단가 옵션',
  'options.partner4':    '파트너4 단가 옵션',
  'options.partner5':    '파트너5 단가 옵션',
  'thresholds.partner1': '파트너1 임계값(h)',
  'thresholds.partner2': '파트너2 임계값(h)',
  'thresholds.partner3': '파트너3 임계값(h)',
  'thresholds.partner4': '파트너4 임계값(h)',
  'thresholds.partner5': '파트너5 임계값(h)',
  'lock_until_first_day': '월 1일 단가 변경 락',
  'recalc_day_of_month':  '등급 재산정 일자',
  'recalc_hour_kst':      '등급 재산정 시각(KST)',
  'demote_step_max':      '강등 최대 단계',
}

/** 정산률 0.45 같은 소수 → "45%" 변환 (revenue_rate.* 키 한정) */
function formatSettingValue(key: string, raw: string | null): string {
  if (raw == null || raw === '') return '—'
  if (key.startsWith('revenue_rate.')) {
    const n = Number(raw)
    if (!isNaN(n)) return `${(n * 100).toFixed(1).replace(/\.0$/, '')}%`
  }
  if (key.startsWith('thresholds.')) return `${raw}h`
  if (key.startsWith('options.')) {
    // 1000,1200,1300 → "1,000 / 1,200 / 1,300원"
    return raw.split(',').map((v) => Number(v).toLocaleString()).join(' / ') + '원'
  }
  if (key === 'lock_until_first_day') return raw === 'true' ? '활성' : '비활성'
  return raw
}

/** 다음달 1일 (등급 재산정일)까지 남은 일수 */
function daysUntilNextMonth1st(): number {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86_400_000))
}

export default function GradeManagement() {
  const navigate = useNavigate()
  const [dist, setDist] = useState<DistRow[]>([])
  const [changes, setChanges] = useState<GradeChangeRow[]>([])
  const [settings, setSettings] = useState<SettingHistoryRow[]>([])
  const [gradePolicy, setGradePolicy] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      api<{ items: DistRow[] }>('/admin/grade/distribution'),
      api<{ items: GradeChangeRow[] }>('/admin/grade/recent-changes?limit=50'),
      api<{ items: SettingHistoryRow[] }>('/admin/settings/history/list?namespace=grade&limit=50'),
      api<{ data: Record<string, string> }>('/admin/settings/grade'),
    ])
      .then(([d, c, s, p]) => {
        if (cancelled) return
        setDist(d.items)
        setChanges(c.items)
        setSettings(s.items)
        setGradePolicy(p.data ?? {})
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const total = dist.reduce((s, r) => s + r.count, 0)
  const dDay = useMemo(() => daysUntilNextMonth1st(), [])

  // dist 를 GRADE_ORDER 순서로 정렬 + 누락된 등급은 0명으로 채움
  const sortedDist: DistRow[] = useMemo(() => {
    const byKey: Record<string, DistRow> = {}
    for (const r of dist) byKey[r.grade] = r
    return GRADE_ORDER.map((g) => byKey[g] ?? {
      grade: g,
      grade_label: g === 'preliminary' ? '예비파트너'
        : g === 'partner1' ? '파트너1' : g === 'partner2' ? '파트너2'
        : g === 'partner3' ? '파트너3' : g === 'partner4' ? '파트너4' : '파트너5',
      count: 0,
    })
  }, [dist])

  return (
    <div className="space-y-3 max-w-[1100px]">
      {/* 페이지 타이틀 + 단가/정산률 변경 CTA + D-day */}
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">등급 관리</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            상담사 등급 분포 + 정책 + 변동/변경 이력. 개별 상담사 수정은 상담사 상세 페이지에서.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/settings?tab=grade"
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium shadow-sm"
            title="설정 > 등급/단가 탭에서 정책 수정"
          >
            💰 단가·정산률 변경
          </Link>
          <div className="inline-flex items-center gap-2 px-3 h-10 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <span>⏰</span>
            <span>재산정 <span className="font-semibold text-amber-900">D-{dDay}</span></span>
            <span className="text-amber-600/70">(매월 1일)</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm w-fit max-w-full">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">로딩...</div>
      ) : (
        <>
          {/* 1) 등급별 분포 + 정책 — 각 카드에 인원·정산률·단가 같이 */}
          <section>
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              등급별 분포 + 현재 정책 <span className="text-[11px] text-gray-400">(활동 상담사 {total}명)</span>
            </h2>
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
              {sortedDist.map((r) => {
                const pct = total > 0 ? Math.round((r.count / total) * 100) : 0
                const revRate = gradePolicy[`revenue_rate.${r.grade}`]
                const options = gradePolicy[`options.${r.grade}`]
                const threshold = gradePolicy[`thresholds.${r.grade}`]
                return (
                  <div
                    key={r.grade}
                    className={`rounded-lg px-3.5 py-3 border ${GRADE_CARD_STYLE[r.grade] ?? 'bg-gray-50 border-gray-200 text-gray-800'}`}
                  >
                    <div className="text-[13px] font-semibold opacity-90">{r.grade_label}</div>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <span className="text-[22px] font-bold tabular-nums leading-tight">{r.count}</span>
                      <span className="text-[12px] opacity-70">명 · {pct}%</span>
                    </div>
                    <div className="mt-2.5 pt-2.5 border-t border-current/10 space-y-1 text-[13px]">
                      <div className="flex justify-between gap-2">
                        <span className="opacity-70">정산률</span>
                        <span className="font-semibold tabular-nums">
                          {revRate ? `${(Number(revRate) * 100).toFixed(0)}%` : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="opacity-70">단가</span>
                        <span className="font-medium tabular-nums truncate text-right" title={options}>
                          {options ? options.split(',').map((v) => Number(v).toLocaleString()).slice(0, 2).join('~') : '—'}
                        </span>
                      </div>
                      {threshold && (
                        <div className="flex justify-between gap-2">
                          <span className="opacity-70">임계값</span>
                          <span className="font-medium tabular-nums">{threshold}h</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* 2) 최근 등급 변동 — 0건일 때 긍정 메시지 */}
          <section>
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              최근 등급 변동 <span className="text-[11px] text-gray-400">({changes.length}건)</span>
            </h2>
            <TableShell>
              <THead>
                <Th align="left">시각</Th>
                <Th align="left">상담사</Th>
                <Th align="left">변경</Th>
                <Th align="left">유형</Th>
                <Th align="left">주체</Th>
              </THead>
              <TBody>
                {changes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center">
                      <div className="text-[13px] text-emerald-700 font-medium">✓ 이번달 등급 변동 없음 — 안정 운영 중</div>
                      <div className="text-[12px] text-gray-400 mt-1">새 등급 변동이 발생하면 여기에 표시됩니다</div>
                    </td>
                  </tr>
                ) : (
                  changes.map((c) => (
                    <Tr key={c.id} onClick={() => navigate(`/members/counselors/${c.member_id}`)}>
                      <Td align="left" className="text-[13px] text-gray-500 tabular-nums">{c.created_at.slice(0, 16).replace('T', ' ')}</Td>
                      <Td align="left" className="text-[13px]">
                        <Link to={`/members/counselors/${c.member_id}`} onClick={(e) => e.stopPropagation()} className="text-brand-600 hover:underline font-medium">
                          {c.nickname || c.mb_id || `#${c.member_id}`}
                        </Link>
                      </Td>
                      <Td align="left" className="text-[13px]">
                        <span className="text-gray-500">{c.grade_before ?? '—'}</span>
                        <span className="mx-1">→</span>
                        <span className="font-medium">{c.grade_after}</span>
                      </Td>
                      <Td align="left" className="text-[13px]">{CHANGE_TYPE_LABEL[c.change_type] ?? c.change_type}</Td>
                      <Td align="left" className="text-[13px] text-gray-500">{c.changed_by}</Td>
                    </Tr>
                  ))
                )}
              </TBody>
            </TableShell>
          </section>

          {/* 3) 정책 변경 이력 — 키를 한글 라벨로, 값을 % / 단위 자동 변환 */}
          <section>
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              정책 변경 이력 <span className="text-[11px] text-gray-400">({settings.length}건)</span>
            </h2>
            <TableShell>
              <THead>
                <Th align="left">시각</Th>
                <Th align="left">항목</Th>
                <Th align="left">변경</Th>
                <Th align="left">담당자</Th>
              </THead>
              <TBody>
                {settings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-10 text-center">
                      <div className="text-[13px] text-gray-500">아직 정책 변경 이력이 없습니다</div>
                      <div className="text-[12px] text-gray-400 mt-1">단가·정산률·임계값을 변경하면 여기에 기록됩니다</div>
                    </td>
                  </tr>
                ) : settings.map((s) => (
                  <Tr key={s.id}>
                    <Td align="left" className="text-[13px] text-gray-500 tabular-nums whitespace-nowrap">
                      {s.created_at.slice(0, 16).replace('T', ' ')}
                    </Td>
                    <Td align="left" className="text-[13px] font-medium text-gray-700">
                      {SETTING_KEY_LABEL[s.key] ?? s.key}
                    </Td>
                    <Td align="left" className="text-[13px]">
                      <span className="text-gray-500 tabular-nums">{formatSettingValue(s.key, s.value_before)}</span>
                      <span className="mx-1.5 text-gray-400">→</span>
                      <span className="font-semibold text-gray-900 tabular-nums">{formatSettingValue(s.key, s.value_after)}</span>
                    </Td>
                    <Td align="left" className="text-[13px] text-gray-500">{s.changed_by}</Td>
                  </Tr>
                ))}
              </TBody>
            </TableShell>
          </section>
        </>
      )}
    </div>
  )
}
