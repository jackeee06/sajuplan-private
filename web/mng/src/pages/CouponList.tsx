import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Trash2 } from 'lucide-react'
import { api } from '../lib/api'

/**
 * sample/adm/shop_admin/couponlist.php (메뉴 350510 "쿠폰관리") 정확 매핑.
 * 컬럼: 등록일시 / 쿠폰종류 / 쿠폰코드 / 쿠폰이름 / 적용대상 / 회원아이디 / 사용기한 / 사용횟수 / 관리
 */

interface Coupon {
  id: number
  cp_no: number | null
  cp_id: string | null
  member_id: number | null
  mb_id: string | null
  member_name: string | null
  title: string
  method: number
  target: string | null
  starts_at: string | null
  ends_at: string | null
  discount_value: number
  discount_type: number
  is_visible: boolean
  used_count: number
  created_at: string
}

interface Resp {
  items: Coupon[]
  total: number
  page: number
  limit: number
}

type Sfl = 'mb_id' | 'cp_id' | 'cp_subject'

const SFL_OPTIONS: { value: Sfl; label: string }[] = [
  { value: 'mb_id', label: '회원아이디' },
  { value: 'cp_id', label: '쿠폰코드' },
  { value: 'cp_subject', label: '쿠폰이름' },
]

const METHOD_MAP: Record<number, string> = {
  0: '개별상품할인',
  1: '카테고리할인',
  2: '주문금액할인',
  3: '배송비할인',
  4: '포인트추가',
}

const PAGE_SIZE = 20

export default function CouponList() {
  const [filter, setFilter] = useState({ sfl: 'mb_id' as Sfl, stx: '', fr_date: '', to_date: '', page: 1 })
  const [pending, setPending] = useState({ sfl: 'mb_id' as Sfl, stx: '', fr_date: '', to_date: '' })
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = () => {
    const params = new URLSearchParams()
    if (filter.stx) { params.set('sfl', filter.sfl); params.set('stx', filter.stx) }
    if (filter.fr_date) params.set('fr_date', filter.fr_date)
    if (filter.to_date) params.set('to_date', filter.to_date)
    params.set('page', String(filter.page))
    params.set('limit', String(PAGE_SIZE))
    setLoading(true); setError(null)
    api<Resp>(`/admin/coupons?${params}`).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }
  useEffect(load, [filter])

  const onDelete = async (c: Coupon) => {
    if (!confirm(`쿠폰 "${c.title}" (${c.cp_id})를 삭제하시겠습니까?`)) return
    try {
      await api(`/admin/coupons/${c.id}`, { method: 'DELETE' })
      setSuccess('삭제 완료')
      load()
    } catch (e) { setError(e instanceof Error ? e.message : '삭제 실패') }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">쿠폰 관리</h1>
        <Link to="/coupons/new" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white">
          <Plus className="w-4 h-4" /> 쿠폰 추가
        </Link>
      </div>

      {data && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700">
            <span>전체</span><span>{data.total.toLocaleString()}개</span>
          </span>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <select value={pending.sfl} onChange={(e) => setPending({ ...pending, sfl: e.target.value as Sfl })} className={`w-28 ${searchInputCls}`}>
            {SFL_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
          <input type="text" value={pending.stx} onChange={(e) => setPending({ ...pending, stx: e.target.value })} placeholder="검색어" className={`w-44 md:w-56 ${searchInputCls}`} onKeyDown={(e) => e.key === 'Enter' && setFilter({ ...filter, ...pending, page: 1 })} />
          <span className="mx-1 text-xs text-gray-400">|</span>
          <input type="date" value={pending.fr_date} onChange={(e) => setPending({ ...pending, fr_date: e.target.value })} className={`w-36 ${searchInputCls}`} />
          <span className="text-gray-400">~</span>
          <input type="date" value={pending.to_date} onChange={(e) => setPending({ ...pending, to_date: e.target.value })} className={`w-36 ${searchInputCls}`} />
          <button onClick={() => setFilter({ ...filter, ...pending, page: 1 })} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white ml-auto md:ml-0">
            <Search className="w-4 h-4" /> 검색
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{success}</div>}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-brand-600 dark:bg-brand-700 text-[11px] text-white">
              <tr>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">등록일시</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">쿠폰종류</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">쿠폰코드</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">쿠폰이름</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">적용대상</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">회원아이디</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">사용기한</th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap">사용횟수</th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading && !data ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">로딩...</td></tr>
              ) : !data || data.items.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">자료가 없습니다.</td></tr>
              ) : (
                data.items.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{formatDate(c.created_at)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{METHOD_MAP[c.method] ?? `종류${c.method}`}</td>
                    <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{c.cp_id || '-'}</td>
                    <td className="px-3 py-2 max-w-[260px] truncate">{c.title}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-500">{c.target || '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {c.member_id && c.mb_id ? (
                        <Link to={`/members/customers/${c.member_id}`} className="text-brand-600 hover:underline">{c.mb_id}</Link>
                      ) : <span className="text-gray-400">{c.mb_id || '-'}</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-[11px]">
                      {c.starts_at ? formatYMD(c.starts_at) : '-'} ~ {c.ends_at ? formatYMD(c.ends_at) : '-'}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap font-medium">{c.used_count.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Link to={`/coupons/${c.id}`} className="inline-flex items-center px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-50 mr-1">수정</Link>
                      <button onClick={() => onDelete(c)} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-rose-200 text-rose-700 hover:bg-rose-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && data.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500">
            <div>총 {data.total.toLocaleString()}개 · {filter.page} / {totalPages}</div>
            <div className="flex gap-1">
              <button onClick={() => setFilter((f) => ({ ...f, page: Math.max(1, f.page - 1) }))} disabled={filter.page <= 1} className="px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-40">이전</button>
              <button onClick={() => setFilter((f) => ({ ...f, page: Math.min(totalPages, f.page + 1) }))} disabled={filter.page >= totalPages} className="px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-40">다음</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const searchInputCls = 'px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none'

function formatDate(s: string): string {
  const dt = new Date(s); if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
function formatYMD(s: string | null): string {
  if (!s) return '-'
  const dt = new Date(s); if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${String(dt.getFullYear()).slice(2)}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}
