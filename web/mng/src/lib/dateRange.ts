/**
 * 어드민 통계/리스트 페이지 공통 기간 프리셋.
 * 2026-06-02 사장님 합의: 모든 운영 페이지 기본 기간 = 최근 30일 + 빠른 필터 칩 5종.
 *
 * 사용:
 *   import { rangePresets, defaultLast30Days } from '../lib/dateRange'
 *   const [pending, setPending] = useState(defaultLast30Days())
 *   ...
 *   <RangeChips current={pending} onPick={setPending} />
 *
 * 또는 inline:
 *   {rangePresets.map(p => <button onClick={() => setPending(p.calc())}>{p.label}</button>)}
 */

/** 'YYYY-MM-DD' (로컬 KST 기준) */
function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}

function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function lastOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

/** 기본값: 최근 30일 (오늘 - 29일 ~ 오늘). 운영 모니터링 페이지 표준. */
export function defaultLast30Days(): { from: string; to: string } {
  const today = new Date()
  return { from: ymd(addDays(today, -29)), to: ymd(today) }
}

/** 최근 7일 (오늘 - 6일 ~ 오늘). 일일 모니터링 페이지 표준. */
export function defaultLast7Days(): { from: string; to: string } {
  const today = new Date()
  return { from: ymd(addDays(today, -6)), to: ymd(today) }
}

/** 이번달 (1일 ~ 오늘). 사장님 캡처에서 본 기존 패턴. */
export function defaultThisMonth(): { from: string; to: string } {
  const today = new Date()
  return { from: ymd(firstOfMonth(today)), to: ymd(today) }
}

export interface RangePreset {
  label: string
  calc: () => { from: string; to: string }
}

/**
 * 빠른 필터 칩 5종 (왼쪽부터). 사장님 합의 표준.
 *   [오늘] [어제] [최근 7일] [이번달] [지난달]
 */
export const rangePresets: RangePreset[] = [
  {
    label: '오늘',
    calc: () => {
      const t = ymd(new Date())
      return { from: t, to: t }
    },
  },
  {
    label: '어제',
    calc: () => {
      const y = ymd(addDays(new Date(), -1))
      return { from: y, to: y }
    },
  },
  {
    label: '최근 7일',
    calc: defaultLast7Days,
  },
  {
    label: '이번달',
    calc: defaultThisMonth,
  },
  {
    label: '지난달',
    calc: () => {
      const today = new Date()
      const prevMonthAny = new Date(today.getFullYear(), today.getMonth() - 1, 15)
      return { from: ymd(firstOfMonth(prevMonthAny)), to: ymd(lastOfMonth(prevMonthAny)) }
    },
  },
]

/**
 * 칩 활성 여부 — 현재 from/to 가 어느 프리셋과 일치하는지.
 * 활성 칩 핑크 강조용.
 */
export function activePresetLabel(from: string, to: string): string | null {
  for (const p of rangePresets) {
    const r = p.calc()
    if (r.from === from && r.to === to) return p.label
  }
  return null
}
