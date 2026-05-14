import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Search } from 'lucide-react'
import { api } from '../lib/api'

interface Counselor {
  id: number
  mb_id: string | null
  name: string
  nickname: string
  phone: string | null
  csrid: string | null
  dtmfno: string | null
  telno: string | null
  counselor_category: string | null
  counselor_priority: number | null
  call_070_unit_cost: number | null
  call_060_unit_cost: number | null
  chat_unit_cost: number | null
  paid_royalty_pct: number | null
  level: number
  point: number
  state: string
  is_rising: boolean
  created_at: string
  total_consult: string
  total_usetm: string
  this_month_070: string
  this_month_060: string
  last_month_070: string
  last_month_060: string
}

interface Resp {
  items: Counselor[]
  total: number
  summary: { total: number; idle: number; busy: number; absent: number }
  by_category: Record<string, number>
}

interface Filter {
  q: string
  fr_date: string
  to_date: string
  state: string
  category: string
  page: number
}

const PAGE_SIZE = Number(import.meta.env.VITE_LIST_PAGE_SIZE ?? 10)
const CATEGORIES = ['타로', '신점', '사주', '심리'] as const

// 분야별 연한 색상 (테일윈드 toolchain의 safelist 우려 → 직접 클래스 명시)
const CATEGORY_COLOR: Record<string, string> = {
  타로: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  신점: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  사주: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  심리: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
}
const CATEGORY_CHIP: Record<string, { active: string; inactive: string }> = {
  타로: { active: 'bg-indigo-500 text-white border-indigo-500', inactive: 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50' },
  신점: { active: 'bg-rose-500 text-white border-rose-500',     inactive: 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50' },
  사주: { active: 'bg-amber-500 text-white border-amber-500',   inactive: 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50' },
  심리: { active: 'bg-teal-500 text-white border-teal-500',     inactive: 'bg-white text-teal-700 border-teal-200 hover:bg-teal-50' },
}

const STATE_LABELS: Record<string, { label: string; color: 'emerald' | 'rose' | 'gray' | 'amber' | 'blue' }> = {
  IDLE: { label: '상담대기', color: 'emerald' },
  RDCH: { label: '채팅대기', color: 'emerald' },
  RDVC: { label: '예약대기', color: 'emerald' },
  CRDY: { label: '준비', color: 'emerald' },
  CONN: { label: '상담중', color: 'amber' },
  CNCH: { label: '채팅중', color: 'amber' },
  RESV: { label: '예약중', color: 'amber' },
  ABSE: { label: '부재중', color: 'gray' },
}

export default function CounselorList() {
  const [filter, setFilter] = useState<Filter>({ q: '', fr_date: '', to_date: '', state: '', category: '', page: 1 })
  const [pending, setPending] = useState<Pick<Filter, 'q' | 'fr_date' | 'to_date'>>({ q: '', fr_date: '', to_date: '' })
  const [data, setData] = useState<Resp | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams()
    if (filter.q) params.set('q', filter.q)
    if (filter.fr_date) params.set('fr_date', filter.fr_date)
    if (filter.to_date) params.set('to_date', filter.to_date)
    if (filter.state) params.set('state', filter.state)
    if (filter.category) params.set('category', filter.category)
    params.set('page', String(filter.page))
    params.set('limit', String(PAGE_SIZE))

    setLoading(true)
    api<Resp>(`/admin/members/counselors?${params}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [filter])

  const onSearch = () => setFilter((f) => ({ ...f, ...pending, page: 1 }))
  const onReset = () => {
    setPending({ q: '', fr_date: '', to_date: '' })
    setFilter({ q: '', fr_date: '', to_date: '', state: '', category: '', page: 1 })
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">상담사 리스트</h1>
        </div>
        <Link
          to="/members/counselors/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white"
        >
          <Plus className="w-4 h-4" />
          상담사 추가
        </Link>
      </div>

      {/* 요약 — 상태별 */}
      {data && (
        <div className="flex flex-wrap gap-2">
          <Chip
            label="전체"
            value={data.summary.total}
            active={!filter.state}
            onClick={() => setFilter((f) => ({ ...f, state: '', page: 1 }))}
          />
          <Chip
            label="상담가능"
            value={data.summary.idle}
            color="emerald"
            active={filter.state === 'IDLE'}
            onClick={() => setFilter((f) => ({ ...f, state: 'IDLE', page: 1 }))}
          />
          <Chip
            label="상담중"
            value={data.summary.busy}
            color="amber"
            active={filter.state === 'CONN'}
            onClick={() => setFilter((f) => ({ ...f, state: 'CONN', page: 1 }))}
          />
          <Chip
            label="부재"
            value={data.summary.absent}
            color="gray"
            active={filter.state === 'ABSE'}
            onClick={() => setFilter((f) => ({ ...f, state: 'ABSE', page: 1 }))}
          />
        </div>
      )}

      {/* 분야 필터 */}
      {data && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-500 mr-1">분야:</span>
          <Chip
            label="전체"
            value={data.summary.total}
            active={!filter.category}
            onClick={() => setFilter((f) => ({ ...f, category: '', page: 1 }))}
          />
          {CATEGORIES.map((c) => {
            const isActive = filter.category === c
            const cls = isActive ? CATEGORY_CHIP[c].active : CATEGORY_CHIP[c].inactive
            return (
              <button
                key={c}
                onClick={() => setFilter((f) => ({ ...f, category: c, page: 1 }))}
                className={`px-3 py-1.5 text-xs rounded-full border transition ${cls}`}
              >
                {c} <span className="font-semibold ml-1">{num(data.by_category[c] ?? 0)}</span>
              </button>
            )
          })}
          {data.by_category['미지정'] ? (
            <Chip
              label="미지정"
              value={data.by_category['미지정']}
              color="gray"
              active={filter.category === '미지정'}
              onClick={() => setFilter((f) => ({ ...f, category: '미지정', page: 1 }))}
            />
          ) : null}
        </div>
      )}

      {/* 검색 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[240px]">
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
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">가입 시작</label>
          <input type="date" value={pending.fr_date} onChange={(e) => setPending((p) => ({ ...p, fr_date: e.target.value }))} className={inputCls} />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">가입 종료</label>
          <input type="date" value={pending.to_date} onChange={(e) => setPending((p) => ({ ...p, to_date: e.target.value }))} className={inputCls} />
        </div>
        <button onClick={onSearch} className="px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white inline-flex items-center gap-1.5">
          <Search className="w-4 h-4" /> 검색
        </button>
        <button onClick={onReset} className="px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
          초기화
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-max text-sm">
            <thead className="bg-brand-500 text-xs text-white">
              <tr>
                <Th>관리</Th>
                <Th>번호</Th>
                <Th>가입일</Th>
                <Th>아이디</Th>
                <Th>이름</Th>
                <Th>닉네임</Th>
                <Th>분야</Th>
                <Th>휴대폰</Th>
                <Th>상담사번호</Th>
                <Th>m2net</Th>
                <Th>070번호</Th>
                <Th align="right">단가(070)</Th>
                <Th align="right">단가(060)</Th>
                <Th align="right">채팅</Th>
                <Th align="right">로열티</Th>
                <Th align="right">우선순위</Th>
                <Th align="right">누적상담</Th>
                <Th align="right">누적시간</Th>
                <Th align="right">이번달(070)</Th>
                <Th align="right">이번달(060)</Th>
                <Th align="right">지난달(070)</Th>
                <Th align="right">지난달(060)</Th>
                <Th align="right">포인트</Th>
                <Th>상태</Th>
                <Th>급상승</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={24} className="px-3 py-8 text-center text-gray-400">로딩...</td></tr>
              ) : !data || data.items.length === 0 ? (
                <tr><td colSpan={24} className="px-3 py-12 text-center text-gray-400">자료가 없습니다.</td></tr>
              ) : data.items.map((c) => (
                <tr key={c.id} className="text-gray-700 dark:text-gray-200">
                  <Td>
                    <Link
                      to={`/members/counselors/${c.id}`}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <Pencil className="w-3 h-3" />
                      수정
                    </Link>
                  </Td>
                  <Td className="text-gray-400">{c.id}</Td>
                  <Td className="text-xs">{fmtDate(c.created_at)}</Td>
                  <Td><div className="font-medium">{c.mb_id ?? '-'}</div></Td>
                  <Td>{c.name}</Td>
                  <Td>{c.nickname}</Td>
                  <Td>
                    {c.counselor_category ? (
                      <span className={`px-2 py-0.5 text-xs rounded ${CATEGORY_COLOR[c.counselor_category] ?? 'bg-gray-100 text-gray-600'}`}>
                        {c.counselor_category}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </Td>
                  <Td className="font-mono text-xs">{fmtPhone(c.phone)}</Td>
                  <Td className="font-mono text-xs">{c.dtmfno ?? '-'}</Td>
                  <Td className="font-mono text-xs">{c.csrid ?? '-'}</Td>
                  <Td className="font-mono text-xs">{fmtPhone(c.telno)}</Td>
                  <Td align="right" className="text-xs">{num(c.call_070_unit_cost)}</Td>
                  <Td align="right" className="text-xs">{num(c.call_060_unit_cost)}</Td>
                  <Td align="right" className="text-xs">{num(c.chat_unit_cost)}</Td>
                  <Td align="right" className="text-xs">{c.paid_royalty_pct ?? '-'}%</Td>
                  <Td align="right" className="text-xs">{c.counselor_priority ?? '-'}</Td>
                  <Td align="right" className="text-xs">{num(c.total_consult)}</Td>
                  <Td align="right" className="text-xs">{secsToMin(c.total_usetm)}</Td>
                  <Td align="right" className="text-xs text-emerald-600">{num(c.this_month_070)}</Td>
                  <Td align="right" className="text-xs text-amber-600">{num(c.this_month_060)}</Td>
                  <Td align="right" className="text-xs text-gray-500">{num(c.last_month_070)}</Td>
                  <Td align="right" className="text-xs text-gray-500">{num(c.last_month_060)}</Td>
                  <Td align="right" className="font-medium">{num(c.point)}</Td>
                  <Td><StateBadge state={c.state} /></Td>
                  <Td>{c.is_rising && <Badge color="rose">급상승</Badge>}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {data && data.total > PAGE_SIZE && (
        <Pagination page={filter.page} totalPages={totalPages} onChange={(p) => setFilter((f) => ({ ...f, page: p }))} />
      )}
      {data && (
        <div className="text-xs text-gray-400 text-center">
          총 {num(data.total)}명 (페이지 {filter.page} / {totalPages})
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none'

function Th({ children }: { children: React.ReactNode; align?: 'right' }) {
  return <th className="px-3 py-2 text-center font-semibold whitespace-nowrap">{children}</th>
}
function Td({ children, align, className }: { children: React.ReactNode; align?: 'right'; className?: string }) {
  return <td className={`px-3 py-2 whitespace-nowrap ${align === 'right' ? 'text-right' : ''} ${className ?? ''}`}>{children}</td>
}
function Chip({ label, value, color = 'gray', active, onClick }: { label: string; value: number; color?: 'gray' | 'emerald' | 'amber'; active?: boolean; onClick?: () => void }) {
  const colors: Record<string, string> = {
    gray: active ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50',
    emerald: active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50',
    amber: active ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50',
  }
  return (
    <button onClick={onClick} className={`px-3 py-1.5 text-xs rounded-full border transition ${colors[color]}`}>
      {label} <span className="font-semibold ml-1">{num(value)}</span>
    </button>
  )
}
function StateBadge({ state }: { state: string }) {
  const meta = STATE_LABELS[state] ?? { label: state || '-', color: 'gray' as const }
  return <Badge color={meta.color}>{meta.label}</Badge>
}
function Badge({ children, color }: { children: React.ReactNode; color: 'emerald' | 'rose' | 'gray' | 'amber' | 'blue' }) {
  const cls: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-700',
    rose: 'bg-rose-100 text-rose-700',
    gray: 'bg-gray-100 text-gray-600',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
  }
  return <span className={`px-2 py-0.5 text-xs rounded ${cls[color]}`}>{children}</span>
}

function num(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return '-'
  return new Intl.NumberFormat('ko-KR').format(Number(v))
}
function fmtDate(s: string | null): string {
  if (!s) return '-'
  return new Date(s).toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })
}
function fmtPhone(p: string | null): string {
  if (!p) return '-'
  const d = p.replace(/[^0-9]/g, '')
  if (d.length === 11) return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`
  if (d.length === 10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`
  return p
}
function secsToMin(s: number | string | null | undefined): string {
  if (!s) return '-'
  const n = Number(s)
  if (n < 60) return `${n}초`
  if (n < 3600) return `${Math.floor(n / 60)}분`
  return `${Math.floor(n / 3600)}h ${Math.floor((n % 3600) / 60)}m`
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const pages: number[] = []
  const start = Math.max(1, page - 4)
  const end = Math.min(totalPages, start + 9)
  for (let i = start; i <= end; i++) pages.push(i)
  return (
    <div className="flex justify-center gap-1">
      <button onClick={() => onChange(1)} disabled={page <= 1} className={pgBtn}>«</button>
      <button onClick={() => onChange(page - 1)} disabled={page <= 1} className={pgBtn}>‹</button>
      {pages.map((p) => (
        <button key={p} onClick={() => onChange(p)} className={`px-3 py-1.5 text-xs rounded-md ${p === page ? 'bg-brand-600 text-white' : 'border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
          {p}
        </button>
      ))}
      <button onClick={() => onChange(page + 1)} disabled={page >= totalPages} className={pgBtn}>›</button>
      <button onClick={() => onChange(totalPages)} disabled={page >= totalPages} className={pgBtn}>»</button>
    </div>
  )
}
const pgBtn = 'px-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed'
