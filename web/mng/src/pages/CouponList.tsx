import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { Th, Td, Tr, TableShell, THead, TBody, EmptyRow, Chip, PaginationBar, inputCls } from '../components/table'

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
  const navigate = useNavigate()
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
    <div className="space-y-3 max-w-[1100px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">쿠폰 관리</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">발행/지급 쿠폰 목록</p>
        </div>
        <Link to="/coupons/new" className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium">
          <Plus className="w-4 h-4" /> 쿠폰 추가
        </Link>
      </div>

      {data && (
        <div className="flex flex-wrap items-center gap-2">
          <Chip label="전체" value={data.total} />
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 w-fit max-w-full">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-[140px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">검색기준</label>
            <select value={pending.sfl} onChange={(e) => setPending({ ...pending, sfl: e.target.value as Sfl })} className={inputCls}>
              {SFL_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </div>
          <div className="w-[240px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">검색어</label>
            <input type="text" value={pending.stx} onChange={(e) => setPending({ ...pending, stx: e.target.value })} placeholder="검색어" className={inputCls} onKeyDown={(e) => e.key === 'Enter' && setFilter({ ...filter, ...pending, page: 1 })} />
          </div>
          <div className="w-[160px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">시작일</label>
            <input type="date" value={pending.fr_date} onChange={(e) => setPending({ ...pending, fr_date: e.target.value })} className={inputCls} />
          </div>
          <div className="w-[160px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">종료일</label>
            <input type="date" value={pending.to_date} onChange={(e) => setPending({ ...pending, to_date: e.target.value })} className={inputCls} />
          </div>
          <div className="ml-auto">
            <button onClick={() => setFilter({ ...filter, ...pending, page: 1 })} className="px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white inline-flex items-center gap-1.5 font-medium">
              <Search className="w-4 h-4" /> 검색
            </button>
          </div>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{success}</div>}

      <TableShell>
        <THead>
          <Th align="left">등록일시</Th>
          <Th align="left">쿠폰종류</Th>
          <Th align="left">쿠폰코드</Th>
          <Th align="left">쿠폰이름</Th>
          <Th align="left">적용대상</Th>
          <Th align="left">회원아이디</Th>
          <Th align="left">사용기한</Th>
          <Th align="right">사용횟수</Th>
          <Th align="center">삭제</Th>
        </THead>
        <TBody>
          {loading && !data ? (
            <EmptyRow colSpan={9} loading />
          ) : !data || data.items.length === 0 ? (
            <EmptyRow colSpan={9} />
          ) : (
            data.items.map((c) => (
              <Tr key={c.id} onClick={() => navigate(`/coupons/${c.id}`)}>
                <Td align="left" className="text-xs text-gray-500 tabular-nums">{formatDate(c.created_at)}</Td>
                <Td align="left" className="text-gray-700">{METHOD_MAP[c.method] ?? `종류${c.method}`}</Td>
                <Td align="left" className="font-mono text-xs text-gray-600">{c.cp_id || <span className="text-gray-300">-</span>}</Td>
                <Td align="left" className="max-w-[260px] truncate font-medium">{c.title}</Td>
                <Td align="left" className="text-gray-500">{c.target || <span className="text-gray-300">-</span>}</Td>
                <Td align="left">
                  {c.member_id && c.mb_id ? (
                    <Link to={`/members/customers/${c.member_id}`} onClick={(e) => e.stopPropagation()} className="text-brand-600 hover:underline font-medium">{c.mb_id}</Link>
                  ) : <span className="text-gray-400">{c.mb_id || '-'}</span>}
                </Td>
                <Td align="left" className="text-xs text-gray-500 tabular-nums">
                  {c.starts_at ? formatYMD(c.starts_at) : '-'} ~ {c.ends_at ? formatYMD(c.ends_at) : '-'}
                </Td>
                <Td align="right" className="font-medium tabular-nums">
                  {c.used_count === 0 ? <span className="text-gray-300">0</span> : c.used_count.toLocaleString()}
                </Td>
                <Td align="center">
                  <button
                    onClick={(e) => { e.stopPropagation(); void onDelete(c) }}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                    title="삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </Td>
              </Tr>
            ))
          )}
        </TBody>
      </TableShell>

      {data && (
        <PaginationBar page={filter.page} totalPages={totalPages} total={data.total} pageSize={PAGE_SIZE} onChange={(p) => setFilter((f) => ({ ...f, page: p }))} unit="개" />
      )}
    </div>
  )
}

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
