import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Search } from 'lucide-react'
import { api } from '../lib/api'

interface Customer {
  id: number
  login_id: string | null
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

interface Filter {
  q: string
  fr_date: string
  to_date: string
  status: 'all' | 'active' | 'left' | 'blocked'
  page: number
}

const PAGE_SIZE = Number(import.meta.env.VITE_LIST_PAGE_SIZE ?? 10)

export default function CustomerList() {
  const [filter, setFilter] = useState<Filter>({ q: '', fr_date: '', to_date: '', status: 'all', page: 1 })
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
    setFilter({ q: '', fr_date: '', to_date: '', status: 'all', page: 1 })
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">고객 리스트</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">일반 회원(role=user) 현황</p>
      </div>

      {/* 요약 칩 */}
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
            color="emerald"
            active={filter.status === 'active'}
            onClick={() => setFilter((f) => ({ ...f, status: 'active', page: 1 }))}
          />
          <Chip
            label="차단"
            value={data.summary.blocked}
            color="rose"
            active={filter.status === 'blocked'}
            onClick={() => setFilter((f) => ({ ...f, status: 'blocked', page: 1 }))}
          />
          <Chip
            label="탈퇴"
            value={data.summary.left}
            color="gray"
            active={filter.status === 'left'}
            onClick={() => setFilter((f) => ({ ...f, status: 'left', page: 1 }))}
          />
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
          <label className="block text-[11px] font-medium text-gray-500 mb-1">가입일 시작</label>
          <input
            type="date"
            value={pending.fr_date}
            onChange={(e) => setPending((p) => ({ ...p, fr_date: e.target.value }))}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">가입일 종료</label>
          <input
            type="date"
            value={pending.to_date}
            onChange={(e) => setPending((p) => ({ ...p, to_date: e.target.value }))}
            className={inputCls}
          />
        </div>
        <button onClick={onSearch} className="px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white inline-flex items-center gap-1.5">
          <Search className="w-4 h-4" /> 검색
        </button>
        <button onClick={onReset} className="px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
          초기화
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>
      )}

      {/* 표 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-sm">
            <thead className="bg-brand-500 text-xs text-white">
              <tr>
                <Th>관리</Th>
                <Th>번호</Th>
                <Th>가입일</Th>
                <Th>아이디</Th>
                <Th>이름</Th>
                <Th>휴대폰</Th>
                <Th align="right">권한</Th>
                <Th align="right">포인트</Th>
                <Th>성별</Th>
                <Th align="right">연령</Th>
                <Th align="right">결제</Th>
                <Th align="right">선불(070)</Th>
                <Th align="right">후불(060)</Th>
                <Th align="right">채팅</Th>
                <Th>가입출처</Th>
                <Th>최근접속</Th>
                <Th>상태</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={17} className="px-3 py-8 text-center text-gray-400">로딩...</td></tr>
              ) : !data || data.items.length === 0 ? (
                <tr><td colSpan={17} className="px-3 py-12 text-center text-gray-400">자료가 없습니다.</td></tr>
              ) : data.items.map((m) => (
                <tr key={m.id} className="text-gray-700 dark:text-gray-200">
                  <Td>
                    <Link
                      to={`/members/customers/${m.id}`}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <Pencil className="w-3 h-3" />
                      수정
                    </Link>
                  </Td>
                  <Td className="text-gray-400">{m.id}</Td>
                  <Td className="text-xs">{fmtDate(m.created_at)}</Td>
                  <Td>
                    <div className="font-medium">{m.login_id ?? '-'}</div>
                    {m.social_provider && (
                      <div className="text-[10px] text-gray-400">via {m.social_provider}</div>
                    )}
                  </Td>
                  <Td>{m.name}</Td>
                  <Td className="font-mono text-xs">{fmtPhone(m.phone)}</Td>
                  <Td className="text-xs">{levelLabel(m.level)}</Td>
                  <Td align="right" className="font-medium">{num(m.point)}</Td>
                  <Td>{m.gender ?? '-'}</Td>
                  <Td align="right" className="text-xs">{age(m.birth_date)}</Td>
                  <Td align="right" className="text-xs">{num(m.pay_count)}</Td>
                  <Td align="right" className="text-xs text-emerald-600">{num(m.consult_070)}</Td>
                  <Td align="right" className="text-xs text-amber-600">{num(m.consult_060)}</Td>
                  <Td align="right" className="text-xs text-blue-600">{num(m.consult_chat)}</Td>
                  <Td className="text-xs text-gray-500 max-w-[120px] truncate">{m.acquisition_source ?? '신규앱'}</Td>
                  <Td className="text-xs text-gray-500">{fmtDate(m.last_login_at)}</Td>
                  <Td><CustomerStatus row={m} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {data && data.total > PAGE_SIZE && (
        <Pagination
          page={filter.page}
          totalPages={totalPages}
          onChange={(p) => setFilter((f) => ({ ...f, page: p }))}
        />
      )}
      {data && (
        <div className="text-xs text-gray-400 text-center">
          총 {num(data.total)}명 (페이지 {filter.page} / {totalPages})
        </div>
      )}
    </div>
  )
}

// ─── 헬퍼 ─────────────────────────────────────
const inputCls = 'w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none'

function Th({ children }: { children: React.ReactNode; align?: 'right' }) {
  return <th className="px-3 py-2 text-center font-semibold whitespace-nowrap">{children}</th>
}
function Td({ children, align, className }: { children: React.ReactNode; align?: 'right'; className?: string }) {
  return <td className={`px-3 py-2 ${align === 'right' ? 'text-right' : ''} ${className ?? ''}`}>{children}</td>
}
function Chip({ label, value, color = 'gray', active, onClick }: { label: string; value: number; color?: 'gray' | 'emerald' | 'rose'; active?: boolean; onClick?: () => void }) {
  const colors: Record<string, string> = {
    gray: active ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50',
    emerald: active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50',
    rose: active ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50',
  }
  return (
    <button onClick={onClick} className={`px-3 py-1.5 text-xs rounded-full border transition ${colors[color]}`}>
      {label} <span className="font-semibold ml-1">{num(value)}</span>
    </button>
  )
}
function CustomerStatus({ row }: { row: Customer }) {
  if (row.left_at) return <Badge color="gray">탈퇴</Badge>
  if (row.intercept_until && new Date(row.intercept_until) > new Date()) return <Badge color="rose">차단</Badge>
  return <Badge color="emerald">활동</Badge>
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
