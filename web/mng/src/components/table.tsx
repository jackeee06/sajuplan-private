import { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

/**
 * 관리자 게시판(테이블) 공통 디자인 컴포넌트.
 *
 * 표준 (CustomerList.tsx 가 기준 시안):
 *  - 헤더: bg-gray-50, text-gray-500, uppercase tracking-wider
 *  - 행: py-3.5, hover bg-brand-50/40
 *  - 칩 active: bg-brand-600 (보라) 통일, 상태/카테고리 의미는 좌측 dot 으로 분리
 *  - 숫자 0 은 text-gray-300 으로 흐림 (NumCell)
 *  - 페이지네이션 활성: 보라 원형 (32×32)
 */

export const inputCls =
  'w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 outline-none transition'

export type Align = 'left' | 'right' | 'center'

export function Th({ children, align = 'left', className }: { children: ReactNode; align?: Align; className?: string }) {
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return (
    <th
      className={`px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap ${alignCls} ${className ?? ''}`}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  align = 'left',
  className,
}: {
  children: ReactNode
  align?: Align
  className?: string
}) {
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return <td className={`px-2 py-1 whitespace-nowrap ${alignCls} ${className ?? ''}`}>{children}</td>
}

export function THead({ children, sticky }: { children: ReactNode; sticky?: boolean }) {
  return (
    <thead className={`bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 ${sticky ? 'sticky top-0 z-10' : ''}`}>
      <tr>{children}</tr>
    </thead>
  )
}

export function TableShell({ children, minWidth, maxHeight }: { children: ReactNode; minWidth?: string; maxHeight?: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden w-fit max-w-full">
      <div className={`overflow-x-auto ${maxHeight ?? ''}`}>
        <table className={`text-xs w-auto ${minWidth ?? ''}`}>{children}</table>
      </div>
    </div>
  )
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-gray-100 dark:divide-gray-800">{children}</tbody>
}

/**
 * 데이터 row — group hover 효과 자동 적용.
 * onClick 을 넘기면 cursor-pointer + 좌측 3px 보라 라인 hover 효과가 활성화.
 * (CustomerList 표준: 수정 버튼 X, 행 클릭으로 상세 이동)
 */
export function Tr({
  children,
  className,
  onClick,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  const clickable = !!onClick
  return (
    <tr
      onClick={onClick}
      className={`group text-gray-700 dark:text-gray-200 transition-all ${
        clickable
          ? 'cursor-pointer hover:bg-brand-50 hover:shadow-[inset_3px_0_0_0_theme(colors.brand.500)] dark:hover:bg-brand-500/10'
          : 'hover:bg-brand-50/40 dark:hover:bg-brand-500/5'
      } ${className ?? ''}`}
    >
      {children}
    </tr>
  )
}

/** 첫 컬럼에 쓰는 ID 셀 — 행 hover 시 brand 색으로 강조 */
export function IdCell({ id }: { id: number | string }) {
  return (
    <Td
      align="right"
      className="text-gray-400 tabular-nums group-hover:text-brand-600 group-hover:font-medium"
    >
      {id}
    </Td>
  )
}

export function EmptyRow({ colSpan, loading }: { colSpan: number; loading?: boolean }) {
  return (
    <tr>
      <td colSpan={colSpan} className={`px-3 ${loading ? 'py-12' : 'py-16'} text-center text-gray-400`}>
        {loading ? '로딩...' : '자료가 없습니다.'}
      </td>
    </tr>
  )
}

/** 상태/카테고리 칩 — active 는 brand 통일, 의미는 dotColor 로 */
export function Chip({
  label,
  value,
  dotColor,
  active,
  onClick,
}: {
  label: string
  value?: number
  dotColor?: 'emerald' | 'rose' | 'gray' | 'amber' | 'blue' | 'indigo' | 'teal'
  active?: boolean
  onClick?: () => void
}) {
  const dotCls: Record<string, string> = {
    emerald: 'bg-emerald-500',
    rose: 'bg-rose-500',
    gray: 'bg-gray-400',
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
    indigo: 'bg-indigo-500',
    teal: 'bg-teal-500',
  }
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs rounded-full border transition ${
        active
          ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300'
      }`}
    >
      {dotColor && (
        <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white/80' : dotCls[dotColor]}`} />
      )}
      <span className="font-medium">{label}</span>
      {value !== undefined && (
        <span
          className={`font-semibold tabular-nums ${
            active ? 'text-white' : 'text-gray-900 dark:text-gray-100'
          }`}
        >
          {num(value)}
        </span>
      )}
    </button>
  )
}

/** 숫자 셀 — 0/null 은 회색으로 흐림 */
export function NumCell({
  value,
  bold,
  className,
}: {
  value: number | string | null | undefined
  bold?: boolean
  className?: string
}) {
  const n = value === null || value === undefined ? null : Number(value)
  const isNull = n === null || isNaN(n)
  const isZero = !isNull && n === 0
  return (
    <span
      className={`tabular-nums text-xs ${
        isNull || isZero
          ? 'text-gray-300'
          : bold
            ? 'text-gray-900 font-medium dark:text-gray-100'
            : 'text-gray-700 dark:text-gray-200'
      } ${className ?? ''}`}
    >
      {isNull ? '-' : num(n!)}
    </span>
  )
}

/** 성별 셀 — M=파랑, F=핑크 */
export function GenderCell({ gender }: { gender: string | null }) {
  if (!gender) return <span className="text-gray-300">-</span>
  const isMale = gender === 'M' || gender === '남'
  return <span className={`text-xs font-medium ${isMale ? 'text-blue-600' : 'text-rose-500'}`}>{gender}</span>
}

export type BadgeColor = 'emerald' | 'rose' | 'gray' | 'amber' | 'blue' | 'indigo' | 'teal'

export function Badge({ children, color }: { children: ReactNode; color: BadgeColor }) {
  const cls: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    rose: 'bg-rose-50 text-rose-700 border border-rose-200',
    gray: 'bg-gray-50 text-gray-600 border border-gray-200',
    amber: 'bg-amber-50 text-amber-700 border border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border border-blue-200',
    indigo: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    teal: 'bg-teal-50 text-teal-700 border border-teal-200',
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full ${cls[color]}`}
    >
      {children}
    </span>
  )
}

/** 수정 버튼 — 톤다운, hover 시 brand */
export function EditButton({ to, children = '수정' }: { to: string; children?: ReactNode }) {
  // Link 를 안에서 import 하면 react-router 의존을 강제하게 됨 → 사용처에서 <a> wrapping 도 가능하도록
  // 단순화를 위해 일단 a 태그 사용. SPA 라우팅이 필요하면 <Link> 직접 사용하기.
  return (
    <a
      href={to}
      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-gray-200 text-gray-500 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 dark:border-gray-700 dark:hover:bg-brand-500/10 transition-colors"
    >
      {children}
    </a>
  )
}

/** 페이지네이션 — 활성: 보라 원형 / 비활성: 정사각 텍스트 */
export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (p: number) => void
}) {
  const windowSize = 5
  const start = Math.max(1, Math.min(page - Math.floor(windowSize / 2), totalPages - windowSize + 1))
  const end = Math.min(totalPages, start + windowSize - 1)
  const pages: number[] = []
  for (let i = Math.max(1, start); i <= end; i++) pages.push(i)

  return (
    <div className="flex items-center gap-1">
      <PgIcon disabled={page <= 1} onClick={() => onChange(1)}>
        <ChevronsLeft className="w-3.5 h-3.5" />
      </PgIcon>
      <PgIcon disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="w-3.5 h-3.5" />
      </PgIcon>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={
            p === page
              ? 'inline-flex w-8 h-8 items-center justify-center rounded-full bg-brand-600 text-white text-xs font-semibold tabular-nums shadow-sm'
              : 'inline-flex w-8 h-8 items-center justify-center rounded-md text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 tabular-nums'
          }
        >
          {p}
        </button>
      ))}
      <PgIcon disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        <ChevronRight className="w-3.5 h-3.5" />
      </PgIcon>
      <PgIcon disabled={page >= totalPages} onClick={() => onChange(totalPages)}>
        <ChevronsRight className="w-3.5 h-3.5" />
      </PgIcon>
    </div>
  )
}

function PgIcon({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex w-8 h-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}

/** 결과 카운트 + 페이지네이션이 함께 들어가는 하단 바 */
export function PaginationBar({
  page,
  totalPages,
  total,
  pageSize,
  onChange,
  unit = '건',
}: {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onChange: (p: number) => void
  unit?: string
}) {
  return (
    <div className="flex items-center justify-start gap-6 flex-wrap pt-1">
      <p className="text-xs text-gray-400">
        페이지 <span className="text-gray-600 font-medium">{page}</span> / {totalPages}
      </p>
      <p className="text-xs text-gray-400">
        총 <span className="text-gray-700 font-medium">{num(total)}</span>
        {unit}
      </p>
      {total > pageSize ? (
        <Pagination page={page} totalPages={totalPages} onChange={onChange} />
      ) : null}
    </div>
  )
}

/** 결과 카운트(상단) — "전체 N건" 형태, 강조숫자는 brand */
export function ResultCount({ total, unit = '건' }: { total: number; unit?: string }) {
  return (
    <div className="flex items-center justify-start px-1">
      <p className="text-xs text-gray-500">
        전체 <span className="text-brand-600 font-semibold">{num(total)}</span>
        {unit}
      </p>
    </div>
  )
}

// ─── 포맷 헬퍼 ─────────────────────────────────────

export function num(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return '-'
  return new Intl.NumberFormat('ko-KR').format(Number(v))
}

export function fmtDate(s: string | null, opts?: { withTime?: boolean }): string {
  if (!s) return '-'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '-'
  if (opts?.withTime === false) {
    return d.toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })
  }
  return d.toLocaleString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function fmtPhone(p: string | null): string {
  if (!p) return '-'
  const d = p.replace(/[^0-9]/g, '')
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  return p
}

export function ageFrom(birth: string | null): string {
  if (!birth) return '-'
  const b = new Date(birth)
  if (isNaN(b.getTime())) return '-'
  const now = new Date()
  let a = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--
  return `${a}`
}

export function secsToMin(s: number | string | null | undefined): string {
  if (s === null || s === undefined || s === '') return '-'
  const n = Number(s)
  if (!isFinite(n) || n <= 0) return '-'
  if (n < 60) return `${n}초`
  if (n < 3600) return `${Math.floor(n / 60)}분`
  return `${Math.floor(n / 3600)}h ${Math.floor((n % 3600) / 60)}m`
}
