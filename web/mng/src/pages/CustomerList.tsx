import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { api } from '../lib/api'

interface Customer {
  id: number
  mb_id: string | null
  name: string
  nickname: string
  phone: string | null
  gender: string | null
  birth_date: string | null
  level: number
  point: number
  acquisition_source: string | null
  social_provider: string | null
  last_login_at: string | null
  created_at: string
  left_at: string | null
  intercept_until: string | null
  pay_count: string
  pay_total: string
  consult_070: string
  consult_060: string
  consult_chat: string
}

interface Resp {
  items: Customer[]
  total: number
  summary: { total: number; active: number; left: number; blocked: number }
}

type Segment = '' | 'new7d' | 'no_pay' | 'vip' | 'dormant_balance' | 'churn_risk'
type Channel = '' | 'chat' | 'phone070' | 'phone060' | 'mixed'
type Gender = '' | 'M' | 'F' | 'none'

interface Filter {
  q: string
  fr_date: string
  to_date: string
  status: 'all' | 'active' | 'left' | 'blocked'
  segment: Segment
  channel: Channel
  social: string  // '' | 'none' | 'kakao' | 'naver' | ...
  gender: Gender
  page: number
}

const PAGE_SIZE = Number(import.meta.env.VITE_LIST_PAGE_SIZE ?? 10)

export default function CustomerList() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>({ q: '', fr_date: '', to_date: '', status: 'all', segment: '', channel: '', social: '', gender: '', page: 1 })
  const [pending, setPending] = useState<Pick<Filter, 'q' | 'fr_date' | 'to_date'>>({ q: '', fr_date: '', to_date: '' })
  const [data, setData] = useState<Resp | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams()
    if (filter.q) params.set('q', filter.q)
    if (filter.fr_date) params.set('fr_date', filter.fr_date)
    if (filter.to_date) params.set('to_date', filter.to_date)
    if (filter.status !== 'all') params.set('status', filter.status)
    if (filter.segment) params.set('segment', filter.segment)
    if (filter.channel) params.set('channel', filter.channel)
    if (filter.social) params.set('social', filter.social)
    if (filter.gender) params.set('gender', filter.gender)
    params.set('page', String(filter.page))
    params.set('limit', String(PAGE_SIZE))

    setLoading(true)
    api<Resp>(`/admin/members/customers?${params}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [filter])

  const onSearch = () => setFilter((f) => ({ ...f, ...pending, page: 1 }))
  const onReset = () => {
    setPending({ q: '', fr_date: '', to_date: '' })
    setFilter({ q: '', fr_date: '', to_date: '', status: 'all', segment: '', channel: '', social: '', gender: '', page: 1 })
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-3">
      {/* 페이지 타이틀 */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">고객 리스트</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">일반 회원(role=user) 현황</p>
      </div>

      {/* 상태 칩 — active는 모두 brand 컬러로 통일, 상태 의미는 좌측 dot 으로 */}
      {data && (
        <div className="flex flex-wrap gap-2">
          <Chip
            label="전체"
            value={data.summary.total}
            active={filter.status === 'all'}
            onClick={() => setFilter((f) => ({ ...f, status: 'all', page: 1 }))}
          />
          <Chip
            label="활동"
            value={data.summary.active}
            dotColor="emerald"
            active={filter.status === 'active'}
            onClick={() => setFilter((f) => ({ ...f, status: 'active', page: 1 }))}
          />
          <Chip
            label="차단"
            value={data.summary.blocked}
            dotColor="rose"
            active={filter.status === 'blocked'}
            onClick={() => setFilter((f) => ({ ...f, status: 'blocked', page: 1 }))}
          />
          <Chip
            label="탈퇴"
            value={data.summary.left}
            dotColor="gray"
            active={filter.status === 'left'}
            onClick={() => setFilter((f) => ({ ...f, status: 'left', page: 1 }))}
          />
        </div>
      )}

      {/* 운영 세그먼트 칩 (단일 선택, 라디오) — 가장 자주 보는 그룹 한 클릭 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-gray-400 mr-1">자주쓰는 필터</span>
        <SegChip label="신규 7일" active={filter.segment === 'new7d'} onClick={() => toggleSeg(setFilter, filter.segment, 'new7d')} />
        <SegChip label="미결제" active={filter.segment === 'no_pay'} onClick={() => toggleSeg(setFilter, filter.segment, 'no_pay')} />
        <SegChip label="VIP (누적 10만↑)" active={filter.segment === 'vip'} onClick={() => toggleSeg(setFilter, filter.segment, 'vip')} />
        <SegChip label="잔액 보유 휴면" hint="잔액 1만↑ · 30일 무로그인" active={filter.segment === 'dormant_balance'} onClick={() => toggleSeg(setFilter, filter.segment, 'dormant_balance')} />
        <SegChip label="이탈 위험" hint="누적 5만↑ · 14일 무로그인" active={filter.segment === 'churn_risk'} onClick={() => toggleSeg(setFilter, filter.segment, 'churn_risk')} />
      </div>

      {/* 드롭다운 — 유입채널 / 사용채널 / 성별 */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="유입채널"
          value={filter.social}
          options={[
            { value: 'kakao', label: '카카오' },
            { value: 'naver', label: '네이버' },
            { value: 'none', label: '일반가입' },
          ]}
          onChange={(v) => setFilter((f) => ({ ...f, social: v, page: 1 }))}
        />
        <FilterSelect
          label="사용채널"
          value={filter.channel}
          options={[
            { value: 'chat', label: '채팅만' },
            { value: 'phone070', label: '070 (선불)' },
            { value: 'phone060', label: '060 (후불)' },
            { value: 'mixed', label: '채팅+전화' },
          ]}
          onChange={(v) => setFilter((f) => ({ ...f, channel: v as Channel, page: 1 }))}
        />
        <FilterSelect
          label="성별"
          value={filter.gender}
          options={[
            { value: 'M', label: '남' },
            { value: 'F', label: '여' },
            { value: 'none', label: '미입력' },
          ]}
          onChange={(v) => setFilter((f) => ({ ...f, gender: v as Gender, page: 1 }))}
        />
      </div>

      {/* 검색 — 좌측은 검색어, 우측은 날짜/액션 그룹 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 w-fit max-w-full">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-[260px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">검색</label>
            <input
              type="text"
              value={pending.q}
              onChange={(e) => setPending((p) => ({ ...p, q: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              placeholder="아이디 / 이름 / 닉네임 / 휴대폰"
              className={inputCls}
            />
          </div>
          <div className="w-[160px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">가입일 시작</label>
            <input
              type="date"
              value={pending.fr_date}
              onChange={(e) => setPending((p) => ({ ...p, fr_date: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div className="w-[160px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">가입일 종료</label>
            <input
              type="date"
              value={pending.to_date}
              onChange={(e) => setPending((p) => ({ ...p, to_date: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onSearch}
              className="px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white inline-flex items-center gap-1.5 font-medium"
            >
              <Search className="w-4 h-4" /> 검색
            </button>
            <button
              onClick={onReset}
              className="px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              초기화
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>
      )}

      {/* 결과 카운트 + (향후 정렬 영역) */}
      {data && !loading && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-gray-500">
            전체 <span className="text-brand-600 font-semibold">{num(data.total)}</span>건
          </p>
        </div>
      )}

      {/* 표 — w-fit 으로 콘텐츠 기반 폭, 화면 초과 시 가로 스크롤 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden w-fit max-w-full">
        <div className="overflow-x-auto">
          <table className="text-sm w-auto">
            <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <Th align="right">번호</Th>
                <Th align="left">가입일</Th>
                <Th align="left">아이디</Th>
                <Th align="left">이름</Th>
                <Th align="left">휴대폰</Th>
                <Th align="left">권한</Th>
                <Th align="right">소비포인트</Th>
                <Th align="center">성별</Th>
                <Th align="right">연령</Th>
                <Th align="right">결제</Th>
                <Th align="right">선불(070)</Th>
                <Th align="right">후불(060)</Th>
                <Th align="right">채팅</Th>
                <Th align="left">가입출처</Th>
                <Th align="left">최근접속</Th>
                <Th align="center">상태</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={16} className="px-3 py-12 text-center text-gray-400">로딩...</td></tr>
              ) : !data || data.items.length === 0 ? (
                <tr><td colSpan={16} className="px-3 py-16 text-center text-gray-400">자료가 없습니다.</td></tr>
              ) : data.items.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => navigate(`/members/customers/${m.id}`)}
                  className="group cursor-pointer text-gray-700 dark:text-gray-200 hover:bg-brand-50 hover:shadow-[inset_3px_0_0_0_theme(colors.brand.500)] dark:hover:bg-brand-500/10 transition-all"
                >
                  <Td align="right" className="text-gray-400 tabular-nums group-hover:text-brand-600 group-hover:font-medium">{m.id}</Td>
                  <Td align="left" className="text-xs text-gray-500 tabular-nums">{fmtDate(m.created_at)}</Td>
                  <Td align="left">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{m.mb_id ?? '-'}</div>
                    {m.social_provider && (
                      <div className="text-[10px] text-gray-400">via {m.social_provider}</div>
                    )}
                  </Td>
                  <Td align="left">{m.name}</Td>
                  <Td align="left" className="font-mono text-xs text-gray-600">{fmtPhone(m.phone)}</Td>
                  <Td align="left" className="text-xs text-gray-600">{levelLabel(m.level)}</Td>
                  <Td align="right"><NumCell value={m.point} bold /></Td>
                  <Td align="center"><GenderCell gender={m.gender} /></Td>
                  <Td align="right" className="text-xs tabular-nums text-gray-600">{age(m.birth_date)}</Td>
                  <Td align="right"><NumCell value={m.pay_count} /></Td>
                  <Td align="right"><NumCell value={m.consult_070} /></Td>
                  <Td align="right"><NumCell value={m.consult_060} /></Td>
                  <Td align="right"><NumCell value={m.consult_chat} /></Td>
                  <Td align="left" className="text-xs text-gray-500 max-w-[120px] truncate">{m.acquisition_source ?? '신규앱'}</Td>
                  <Td align="left" className="text-xs text-gray-500 tabular-nums">{fmtDate(m.last_login_at)}</Td>
                  <Td align="center"><CustomerStatus row={m} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {data && (
        <div className="flex items-center gap-6 pt-1 w-fit max-w-full">
          <p className="text-xs text-gray-400">
            페이지 <span className="text-gray-600 font-medium">{filter.page}</span> / {totalPages}
          </p>
          {data.total > PAGE_SIZE && (
            <Pagination
              page={filter.page}
              totalPages={totalPages}
              onChange={(p) => setFilter((f) => ({ ...f, page: p }))}
            />
          )}
          <p className="text-xs text-gray-400">
            총 <span className="text-gray-700 font-medium">{num(data.total)}</span>명
          </p>
        </div>
      )}
    </div>
  )
}

// ─── 헬퍼 ─────────────────────────────────────
const inputCls = 'w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 outline-none transition'

/** 세그먼트 칩 토글 — 같은 값 누르면 해제, 다른 값 누르면 전환 */
function toggleSeg(
  setFilter: React.Dispatch<React.SetStateAction<Filter>>,
  current: Segment,
  next: Exclude<Segment, ''>,
) {
  setFilter((f) => ({ ...f, segment: current === next ? '' : next, page: 1 }))
}

/** 세그먼트 칩 — Chip 보다 작고 카운트 없음. tooltip 으로 조건 안내 */
function SegChip({ label, hint, active, onClick }: { label: string; hint?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={hint}
      className={`inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full border transition ${
        active
          ? 'bg-brand-50 text-brand-700 border-brand-300 font-semibold dark:bg-brand-500/10 dark:text-brand-300'
          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300'
      }`}
    >
      {label}
    </button>
  )
}

/** 관리자용 필터 드롭다운 — brand 톤 + 활성 시 선택값을 라벨로 표시 */
function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const active = value !== ''
  const display = active ? (options.find((o) => o.value === value)?.label ?? label) : label

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full border transition ${
          active
            ? 'bg-brand-50 text-brand-700 border-brand-300 font-semibold dark:bg-brand-500/10 dark:text-brand-300'
            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300'
        }`}
      >
        {display}
        <svg viewBox="0 0 16 16" className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" aria-hidden>
          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute top-[calc(100%+4px)] left-0 z-50 min-w-[140px] max-h-[260px] overflow-y-auto bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 shadow-lg py-1"
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={value === ''}
              onClick={() => { onChange(''); setOpen(false) }}
              className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
                value === ''
                  ? 'bg-brand-50 text-brand-700 font-medium dark:bg-brand-500/10 dark:text-brand-300'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              전체
            </button>
          </li>
          {options.map((opt) => {
            const selected = value === opt.value
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => { onChange(opt.value); setOpen(false) }}
                  className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
                    selected
                      ? 'bg-brand-50 text-brand-700 font-medium dark:bg-brand-500/10 dark:text-brand-300'
                      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

type Align = 'left' | 'right' | 'center'

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: Align }) {
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return (
    <th className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap ${alignCls}`}>
      {children}
    </th>
  )
}

function Td({ children, align = 'left', className }: { children: React.ReactNode; align?: Align; className?: string }) {
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return <td className={`px-3 py-1.5 ${alignCls} ${className ?? ''}`}>{children}</td>
}

function Chip({
  label,
  value,
  dotColor,
  active,
  onClick,
}: {
  label: string
  value: number
  dotColor?: 'emerald' | 'rose' | 'gray'
  active?: boolean
  onClick?: () => void
}) {
  const dotCls: Record<string, string> = {
    emerald: 'bg-emerald-500',
    rose: 'bg-rose-500',
    gray: 'bg-gray-400',
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
      <span className={`font-semibold tabular-nums ${active ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
        {num(value)}
      </span>
    </button>
  )
}

function NumCell({ value, bold }: { value: number | string | null | undefined; bold?: boolean }) {
  const n = value === null || value === undefined ? null : Number(value)
  const isZero = n === 0
  const isNull = n === null
  return (
    <span
      className={`tabular-nums text-xs ${
        isNull
          ? 'text-gray-300'
          : isZero
            ? 'text-gray-300'
            : bold
              ? 'text-gray-900 font-medium dark:text-gray-100'
              : 'text-gray-700 dark:text-gray-200'
      }`}
    >
      {isNull ? '-' : num(n!)}
    </span>
  )
}

function GenderCell({ gender }: { gender: string | null }) {
  if (!gender) return <span className="text-gray-300">-</span>
  const isMale = gender === 'M' || gender === '남'
  return (
    <span className={`text-xs font-medium ${isMale ? 'text-blue-600' : 'text-rose-500'}`}>
      {gender}
    </span>
  )
}

function CustomerStatus({ row }: { row: Customer }) {
  if (row.left_at) return <Badge color="gray">탈퇴</Badge>
  if (row.intercept_until && new Date(row.intercept_until) > new Date()) return <Badge color="rose">차단</Badge>
  return <Badge color="emerald">활동</Badge>
}

function Badge({ children, color }: { children: React.ReactNode; color: 'emerald' | 'rose' | 'gray' | 'amber' | 'blue' }) {
  const cls: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    rose: 'bg-rose-50 text-rose-700 border border-rose-200',
    gray: 'bg-gray-50 text-gray-600 border border-gray-200',
    amber: 'bg-amber-50 text-amber-700 border border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border border-blue-200',
  }
  return <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full ${cls[color]}`}>{children}</span>
}

function num(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return '-'
  return new Intl.NumberFormat('ko-KR').format(Number(v))
}
function fmtDate(s: string | null): string {
  if (!s) return '-'
  return new Date(s).toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
}
function fmtPhone(p: string | null): string {
  if (!p) return '-'
  const d = p.replace(/[^0-9]/g, '')
  if (d.length === 11) return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`
  if (d.length === 10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`
  return p
}
function levelLabel(lv: number): string {
  if (lv >= 10) return `관리자(${lv})`
  if (lv >= 5) return `상담사(${lv})`
  return `회원(${lv})`
}
function age(birth: string | null): string {
  if (!birth) return '-'
  const b = new Date(birth)
  if (isNaN(b.getTime())) return '-'
  const now = new Date()
  let a = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--
  return `${a}`
}

/** 페이지네이션 — 활성: 보라 원형 / 비활성: 정사각 텍스트 */
function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const windowSize = 5
  const start = Math.max(1, Math.min(page - Math.floor(windowSize / 2), totalPages - windowSize + 1))
  const end = Math.min(totalPages, start + windowSize - 1)
  const pages: number[] = []
  for (let i = Math.max(1, start); i <= end; i++) pages.push(i)

  return (
    <div className="flex items-center gap-1">
      <PgIcon disabled={page <= 1} onClick={() => onChange(1)}><ChevronsLeft className="w-3.5 h-3.5" /></PgIcon>
      <PgIcon disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft className="w-3.5 h-3.5" /></PgIcon>
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
      <PgIcon disabled={page >= totalPages} onClick={() => onChange(page + 1)}><ChevronRight className="w-3.5 h-3.5" /></PgIcon>
      <PgIcon disabled={page >= totalPages} onClick={() => onChange(totalPages)}><ChevronsRight className="w-3.5 h-3.5" /></PgIcon>
    </div>
  )
}

function PgIcon({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void }) {
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
