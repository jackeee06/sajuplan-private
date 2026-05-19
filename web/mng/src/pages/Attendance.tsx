import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'

/**
 * 어드민 — 출석 관리 (2026-05-16 Phase 2).
 *
 *  3 탭:
 *   1) 정책 — 회원/상담사 정책 따로 (금액·기능 ON·OFF·한도)
 *   2) 통계 — 최근 30일 일별 출석자/지급액
 *   3) 이력 — 회원별 출석 이력 검색
 *
 * 매출 직결 — 신중하게 다루기 위해 별도 메뉴로 분리.
 */

type Target = 'user' | 'counselor'
type Tab = 'policy' | 'stats' | 'history'

interface Policy {
  enabled: boolean
  day1: number
  day5_bonus: number
  day10_bonus: number
  day15_bonus: number
  day20_bonus: number
  day30_coupon_amount: number
  coupon_expire_days: number
  daily_total_limit: number
  min_signup_days: number
  ip_daily_limit: number
}

interface DailyStat {
  date: string
  attendees: number
  total_paid: number
  bonus_paid: number
  coupon_count: number
}

interface HistoryRow {
  id: number
  member_id: number
  mb_id: string | null
  nickname: string | null
  name: string | null
  target_kind: 'user' | 'counselor'
  attended_date: string
  base_coin: number
  bonus_coin: number
  consecutive_days: number
}

export default function Attendance() {
  const [tab, setTab] = useState<Tab>('policy')
  const [target, setTarget] = useState<Target>('user')

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">⭐ 출석 관리</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">매출 직결 기능 — 정책 변경 전 신중히 검토하세요</p>
      </div>

      {/* 타깃 선택 — 회원/상담사 */}
      <div className="inline-flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => setTarget('user')}
          className={`px-4 py-2 text-sm font-medium ${target === 'user' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
        >
          회원
        </button>
        <button
          type="button"
          onClick={() => setTarget('counselor')}
          className={`px-4 py-2 text-sm font-medium border-l border-gray-200 dark:border-gray-700 ${target === 'counselor' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
        >
          상담사
        </button>
      </div>

      {/* 탭 */}
      <div className="border-b border-gray-200 dark:border-gray-700 flex gap-6">
        {(['policy', 'stats', 'history'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`pb-3 text-sm font-medium border-b-2 ${tab === t ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            {t === 'policy' ? '정책 설정' : t === 'stats' ? '통계' : '회원별 이력'}
          </button>
        ))}
      </div>

      {tab === 'policy' && <PolicyTab target={target} />}
      {tab === 'stats' && <StatsTab target={target} />}
      {tab === 'history' && <HistoryTab />}
    </div>
  )
}

/* ───────────── Tab 1: 정책 설정 ───────────── */

function PolicyTab({ target }: { target: Target }) {
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    setError(null); setSuccess(null)
    api<Policy>(`/admin/attendance/policy/${target}`)
      .then((p) => { setPolicy(p); setDirty(false) })
      .catch((e) => setError(e instanceof Error ? e.message : '정책 불러오기 실패'))
  }, [target])

  if (!policy) return <p className="text-sm text-gray-500">로딩...</p>

  const set = <K extends keyof Policy>(k: K, v: Policy[K]) => {
    setPolicy((p) => p ? { ...p, [k]: v } : p)
    setDirty(true)
  }

  const onSave = async () => {
    if (!policy) return
    setSaving(true); setError(null); setSuccess(null)
    try {
      await api<Policy>(`/admin/attendance/policy/${target}`, { method: 'PATCH', body: JSON.stringify(policy) })
      setSuccess('정책이 저장되었습니다.')
      setDirty(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const NumberRow = ({ label, k, hint }: { label: string; k: keyof Policy; hint?: string }) => (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800">
      <label className="w-48 text-sm text-gray-700 dark:text-gray-300">{label}</label>
      <input
        type="number"
        min={0}
        value={Number(policy[k])}
        onChange={(e) => set(k, Number(e.target.value) as Policy[typeof k])}
        className="w-40 px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
      />
      <span className="text-xs text-gray-400">원</span>
      {hint && <span className="text-xs text-gray-400 ml-2">{hint}</span>}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-5 py-4 space-y-2">
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={policy.enabled}
              onChange={(e) => set('enabled', e.target.checked)}
              className="w-5 h-5 accent-brand-600"
            />
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              출석체크 기능 활성화 {policy.enabled ? '🟢 ON' : '🔴 OFF'}
            </span>
          </label>
          <span className="text-xs text-rose-500">⚠ OFF 시 즉시 모든 출석 처리 중단</span>
        </div>

        <NumberRow label="일일 출석 코인" k="day1" hint="매일 출석 시 적립" />
        <NumberRow label="연속 5일 보너스" k="day5_bonus" />
        <NumberRow label="연속 10일 보너스" k="day10_bonus" />
        <NumberRow label="연속 15일 보너스" k="day15_bonus" />
        <NumberRow label="연속 20일 보너스" k="day20_bonus" />
        <NumberRow label="연속 30일 쿠폰 금액" k="day30_coupon_amount" hint={target === 'counselor' ? '상담사는 0 권장 (결제 안 함)' : '1만원 할인권'} />
        <NumberRow label="쿠폰 만료(일)" k="coupon_expire_days" hint="발급 후 N일까지 사용 가능" />

        <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">🛡 안전장치</p>
          <NumberRow label="일일 총 지급 한도" k="daily_total_limit" hint="합산 N원 넘으면 그날 출석 처리 중단" />
          <NumberRow label="신규 회원 제한(일)" k="min_signup_days" hint="가입 후 N일 이후부터 출석 가능" />
          <NumberRow label="IP 1일 최대 계정 수" k="ip_daily_limit" hint="같은 IP 어뷰징 차단 (0 = 무제한)" />
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{success}</div>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium text-white ${dirty ? 'bg-brand-600 hover:bg-brand-700' : 'bg-gray-300 cursor-not-allowed'}`}
        >
          {saving ? '저장 중...' : dirty ? '변경 사항 저장' : '저장됨'}
        </button>
        {dirty && <span className="text-xs text-rose-500">변경 사항 미저장</span>}
      </div>
    </div>
  )
}

/* ───────────── Tab 2: 통계 ───────────── */

function StatsTab({ target }: { target: Target }) {
  const [data, setData] = useState<{ items: DailyStat[]; total_paid: number; total_attendees: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    api<{ items: DailyStat[]; total_paid: number; total_attendees: number }>(`/admin/attendance/stats/${target}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : '통계 불러오기 실패'))
  }, [target])

  if (error) return <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>
  if (!data) return <p className="text-sm text-gray-500">로딩...</p>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-5 py-4">
          <p className="text-xs text-gray-500">30일 누적 출석자</p>
          <p className="text-2xl font-bold text-brand-600 mt-1">{data.total_attendees.toLocaleString()}명</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-5 py-4">
          <p className="text-xs text-gray-500">30일 누적 지급액</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">{data.total_paid.toLocaleString()}원</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left">날짜</th>
              <th className="px-4 py-2 text-right">출석자</th>
              <th className="px-4 py-2 text-right">총 지급</th>
              <th className="px-4 py-2 text-right">보너스</th>
              <th className="px-4 py-2 text-right">쿠폰 발급</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">데이터가 없습니다.</td></tr>
            ) : data.items.map((it) => (
              <tr key={it.date}>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{it.date}</td>
                <td className="px-4 py-2 text-right">{it.attendees.toLocaleString()}명</td>
                <td className="px-4 py-2 text-right font-semibold">{it.total_paid.toLocaleString()}원</td>
                <td className="px-4 py-2 text-right text-amber-600">{it.bonus_paid.toLocaleString()}원</td>
                <td className="px-4 py-2 text-right text-rose-600">{it.coupon_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ───────────── Tab 3: 회원별 이력 ───────────── */

function HistoryTab() {
  const [q, setQ] = useState('')
  const [data, setData] = useState<{ items: HistoryRow[]; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = (search: string) => {
    setLoading(true); setError(null)
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    params.set('limit', '50')
    api<{ items: HistoryRow[]; total: number }>(`/admin/attendance/history?${params}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : '이력 불러오기 실패'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load('') }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="mb_id / 닉네임 / 이름 검색"
          onKeyDown={(e) => e.key === 'Enter' && load(q)}
          className="w-64 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
        />
        <button
          type="button"
          onClick={() => load(q)}
          className="px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white"
        >
          검색
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left">날짜</th>
              <th className="px-4 py-2 text-left">회원</th>
              <th className="px-4 py-2 text-center">구분</th>
              <th className="px-4 py-2 text-right">연속일</th>
              <th className="px-4 py-2 text-right">기본</th>
              <th className="px-4 py-2 text-right">보너스</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">로딩...</td></tr>
            ) : !data || data.items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">데이터가 없습니다.</td></tr>
            ) : data.items.map((it) => (
              <tr key={it.id}>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{it.attended_date}</td>
                <td className="px-4 py-2">
                  <span className="font-medium">{it.nickname || it.name || '-'}</span>
                  <span className="text-xs text-gray-400 ml-2">{it.mb_id}</span>
                </td>
                <td className="px-4 py-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${it.target_kind === 'user' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {it.target_kind === 'user' ? '회원' : '상담사'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">{it.consecutive_days}일</td>
                <td className="px-4 py-2 text-right">{it.base_coin.toLocaleString()}</td>
                <td className="px-4 py-2 text-right text-amber-600">{it.bonus_coin.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && <p className="text-xs text-gray-500">전체 {data.total.toLocaleString()}건</p>}
    </div>
  )
}
