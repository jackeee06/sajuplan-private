import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { Th, Td, Tr, TableShell, THead, TBody, EmptyRow } from '../components/table'

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
  // 사용 빈도 순으로 정렬: 회원별 이력 > 통계 > 정책 설정 (2026-05-22)
  const [tab, setTab] = useState<Tab>('history')

  return (
    // 폭 강제 X — 콘텐츠 기반 좌측 응집 (와이드 모니터에서 양 끝 멀어짐 방지)
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">⭐ 출석 관리</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">매출 직결 기능 — 정책 변경 전 신중히 검토하세요</p>
      </div>

      {/* 탭 — 사용 빈도 순 (이력 → 통계 → 정책) */}
      <div className="border-b border-gray-200 dark:border-gray-700 flex gap-6">
        {(['history', 'stats', 'policy'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`pb-3 text-sm font-medium border-b-2 ${tab === t ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            {t === 'history' ? '회원별 이력' : t === 'stats' ? '통계' : '정책 설정'}
          </button>
        ))}
      </div>

      {tab === 'history' && (
        // 콘텐츠 폭 좌측 응집 — 각 패널 540px 고정, flex-wrap 으로 자동 줄바꿈
        <div className="flex flex-wrap gap-3">
          <HistoryPanel filterKind="user" headerLabel="회원" />
          <HistoryPanel filterKind="counselor" headerLabel="상담사" />
        </div>
      )}
      {tab === 'stats' && (
        <div className="flex flex-wrap gap-3">
          <StatsPanel target="user" headerLabel="회원" />
          <StatsPanel target="counselor" headerLabel="상담사" />
        </div>
      )}
      {tab === 'policy' && (
        <div className="flex flex-wrap gap-3">
          <PolicyPanel target="user" headerLabel="회원" />
          <PolicyPanel target="counselor" headerLabel="상담사" />
        </div>
      )}
    </div>
  )
}

/* ───────────── Tab 1: 정책 설정 — 좌우 2분할 패널 ───────────── */

function PolicyPanel({ target, headerLabel }: { target: Target; headerLabel: string }) {
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

  if (!policy) return (
    <div className="w-[540px] max-w-full rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{headerLabel} 정책</h3>
      <p className="text-sm text-gray-500 mt-2">로딩...</p>
    </div>
  )

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
    <div className="flex items-center gap-2 py-1.5">
      <label className="w-28 shrink-0 text-xs text-gray-700 dark:text-gray-300">{label}</label>
      <input
        type="number"
        min={0}
        value={Number(policy[k])}
        onChange={(e) => set(k, Number(e.target.value) as Policy[typeof k])}
        className="w-24 px-2 py-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs tabular-nums text-right"
      />
      <span className="text-[11px] text-gray-400">원</span>
      {hint && <span className="text-[11px] text-gray-400 flex-1 truncate" title={hint}>{hint}</span>}
    </div>
  )

  return (
    <div className="w-[540px] max-w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-2">
      <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{headerLabel} 정책</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={policy.enabled}
            onChange={(e) => set('enabled', e.target.checked)}
            className="w-4 h-4 accent-brand-600"
          />
          <span className="text-xs font-medium text-gray-800 dark:text-gray-100">
            출석체크 {policy.enabled ? '🟢 ON' : '🔴 OFF'}
          </span>
        </label>
      </div>

      <div className="pt-1">
        <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">💰 출석 코인</p>
        <NumberRow label="일일 출석" k="day1" hint="매일 출석 시 적립" />
        <NumberRow label="연속 5일" k="day5_bonus" />
        <NumberRow label="연속 10일" k="day10_bonus" />
        <NumberRow label="연속 15일" k="day15_bonus" />
        <NumberRow label="연속 20일" k="day20_bonus" />
        <NumberRow label="연속 30일 쿠폰" k="day30_coupon_amount" hint={target === 'counselor' ? '상담사 0 권장' : '1만원 할인권'} />
        <NumberRow label="쿠폰 만료(일)" k="coupon_expire_days" hint="발급 후 N일" />
      </div>

      <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
        <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">🛡 안전장치</p>
        <NumberRow label="일일 총 한도" k="daily_total_limit" hint="합산 초과 시 중단" />
        <NumberRow label="신규 회원(일)" k="min_signup_days" hint="가입 N일 이후 가능" />
        <NumberRow label="IP 1일 최대" k="ip_daily_limit" hint="0 = 무제한" />
      </div>

      {error && <div className="p-2 rounded-md bg-rose-50 text-rose-700 text-xs">{error}</div>}
      {success && <div className="p-2 rounded-md bg-emerald-50 text-emerald-700 text-xs">{success}</div>}

      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
          className={`px-4 py-1.5 rounded-md text-xs font-medium text-white ${dirty ? 'bg-brand-600 hover:bg-brand-700' : 'bg-gray-300 cursor-not-allowed'}`}
        >
          {saving ? '저장 중...' : dirty ? '변경 사항 저장' : '저장됨'}
        </button>
        {dirty && <span className="text-xs text-rose-500">변경 사항 미저장</span>}
      </div>
    </div>
  )
}

/* ───────────── Tab 2: 통계 — 좌우 2분할 패널 ───────────── */

function StatsPanel({ target, headerLabel }: { target: Target; headerLabel: string }) {
  const [data, setData] = useState<{ items: DailyStat[]; total_paid: number; total_attendees: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    api<{ items: DailyStat[]; total_paid: number; total_attendees: number }>(`/admin/attendance/stats/${target}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : '통계 불러오기 실패'))
  }, [target])

  if (error) return (
    <div className="w-[540px] max-w-full rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{headerLabel} 통계</h3>
      <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>
    </div>
  )
  if (!data) return (
    <div className="w-[540px] max-w-full rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{headerLabel} 통계</h3>
      <p className="text-sm text-gray-500">로딩...</p>
    </div>
  )

  return (
    <div className="w-[540px] max-w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{headerLabel} 통계</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500">30일 누적 출석자</p>
          <p className="text-xl font-bold text-brand-600 mt-1">{data.total_attendees.toLocaleString()}명</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500">30일 누적 지급액</p>
          <p className="text-xl font-bold text-rose-600 mt-1">{data.total_paid.toLocaleString()}원</p>
        </div>
      </div>

      <TableShell>
        <THead>
          <Th align="left">날짜</Th>
          <Th align="right">출석자</Th>
          <Th align="right">총 지급</Th>
          <Th align="right">보너스</Th>
          <Th align="right">쿠폰 발급</Th>
        </THead>
        <TBody>
          {data.items.length === 0 ? (
            <EmptyRow colSpan={5} />
          ) : data.items.map((it) => (
            <Tr key={it.date}>
              <Td align="left" className="text-xs text-gray-600 tabular-nums">{it.date}</Td>
              <Td align="right" className="tabular-nums">{it.attendees.toLocaleString()}명</Td>
              <Td align="right" className="font-semibold tabular-nums">{it.total_paid.toLocaleString()}원</Td>
              <Td align="right" className="text-amber-600 tabular-nums">{it.bonus_paid.toLocaleString()}원</Td>
              <Td align="right" className="text-rose-600 tabular-nums">{it.coupon_count}</Td>
            </Tr>
          ))}
        </TBody>
      </TableShell>
    </div>
  )
}

/* ───────────── Tab 3: 회원별 이력 — 좌우 2분할 패널 ───────────── */

function HistoryPanel({ filterKind, headerLabel }: { filterKind: Target; headerLabel: string }) {
  const navigate = useNavigate()
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

  // 클라이언트 사이드 필터링 — target_kind 기준. 향후 데이터 많아지면 백엔드 ?kind=... 추가 고려.
  const filteredItems = (data?.items ?? []).filter((it) => it.target_kind === filterKind)
  const filteredTotal = filteredItems.length

  return (
    <div className="w-[540px] max-w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{headerLabel} 출석 이력</h3>
        <span className="text-xs text-gray-500">{filteredTotal.toLocaleString()}건</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="mb_id / 닉네임 / 이름 검색"
          onKeyDown={(e) => e.key === 'Enter' && load(q)}
          className="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
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

      <TableShell>
        <THead>
          <Th align="left">날짜</Th>
          <Th align="left">{headerLabel}</Th>
          <Th align="right">연속일</Th>
          <Th align="right">기본</Th>
          <Th align="right">보너스</Th>
        </THead>
        <TBody>
          {loading ? (
            <EmptyRow colSpan={5} loading />
          ) : filteredItems.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center">
                <div className="text-[13px] text-gray-500">{headerLabel} 출석 이력이 없습니다</div>
                <div className="text-[12px] text-gray-400 mt-1">{headerLabel}가 출석하면 여기에 표시됩니다</div>
              </td>
            </tr>
          ) : filteredItems.map((it) => (
            <Tr key={it.id} onClick={() => navigate(it.target_kind === 'counselor' ? `/members/counselors/${it.member_id}` : `/members/customers/${it.member_id}`)}>
              <Td align="left" className="text-xs text-gray-600 tabular-nums">{it.attended_date}</Td>
              <Td align="left">
                <span className="font-medium">{it.nickname || it.name || '-'}</span>
                <span className="text-xs text-gray-400 ml-2">{it.mb_id}</span>
              </Td>
              <Td align="right" className="tabular-nums">{it.consecutive_days}일</Td>
              <Td align="right" className="tabular-nums">{it.base_coin.toLocaleString()}</Td>
              <Td align="right" className="text-amber-600 tabular-nums">{it.bonus_coin.toLocaleString()}</Td>
            </Tr>
          ))}
        </TBody>
      </TableShell>
    </div>
  )
}
