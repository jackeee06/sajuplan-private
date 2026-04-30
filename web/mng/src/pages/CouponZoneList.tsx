import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Trash2 } from 'lucide-react'
import { api } from '../lib/api'

/**
 * sample/adm/shop_admin/couponzonelist.php (메뉴 350520 "쿠폰존관리")
 *
 * 컬럼: 쿠폰이름 / 쿠폰종류 / 적용대상 / 포인트추가금액 / 쿠폰번호 / 쿠폰사용기한(다운로드 후 N일) / 다운로드 / 사용기한 / 관리
 */

interface Item {
  id: number
  cz_id: number | null
  subject: string
  cz_type: number
  cp_method: number
  cp_target: string | null
  cz_point: number
  cp_type: boolean
  cp_id: string | null
  cz_period: number
  cz_download: number
  cz_start: string | null
  cz_end: string | null
  is_active: boolean
}

interface Resp { items: Item[]; total: number; page: number; limit: number }

const CZ_TYPE_LABEL: Record<number, string> = {
  1: '포인트차감쿠폰',
  2: '포인트추가쿠폰',
  3: '코드입력쿠폰',
  0: '다운로드 쿠폰',
}

const CP_METHOD_LABEL: Record<number, string> = {
  0: '개별상품할인',
  1: '카테고리할인',
  2: '주문금액할인',
  3: '배송비할인',
  4: '포인트',
}

const PAGE_SIZE = 20

export default function CouponZoneList() {
  const [filter, setFilter] = useState({ stx: '', page: 1 })
  const [pending, setPending] = useState('')
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = () => {
    const params = new URLSearchParams()
    if (filter.stx) params.set('stx', filter.stx)
    params.set('page', String(filter.page))
    params.set('limit', String(PAGE_SIZE))
    setLoading(true); setError(null)
    api<Resp>(`/admin/coupon-zones?${params}`).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }
  useEffect(load, [filter])

  const onDelete = async (i: Item) => {
    if (!confirm(`쿠폰존 "${i.subject}"를 삭제하시겠습니까?`)) return
    try {
      await api(`/admin/coupon-zones/${i.id}`, { method: 'DELETE' })
      setSuccess('삭제 완료')
      load()
    } catch (e) { setError(e instanceof Error ? e.message : '삭제 실패') }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">쿠폰존 관리</h1>
        <Link to="/coupon-zones/new" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white">
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
          <input type="text" value={pending} onChange={(e) => setPending(e.target.value)} placeholder="쿠폰이름 검색" className={`w-64 ${searchInputCls}`} onKeyDown={(e) => e.key === 'Enter' && setFilter({ stx: pending, page: 1 })} />
          <button onClick={() => setFilter({ stx: pending, page: 1 })} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white">
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
                <th className="px-3 py-2 text-left font-medium">쿠폰이름</th>
                <th className="px-3 py-2 text-left font-medium">쿠폰종류</th>
                <th className="px-3 py-2 text-left font-medium">적용대상</th>
                <th className="px-3 py-2 text-right font-medium">포인트추가금액</th>
                <th className="px-3 py-2 text-left font-medium">쿠폰번호</th>
                <th className="px-3 py-2 text-left font-medium">쿠폰사용기한</th>
                <th className="px-3 py-2 text-right font-medium">다운로드</th>
                <th className="px-3 py-2 text-left font-medium">사용기한</th>
                <th className="px-3 py-2 text-right font-medium">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading && !data ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">로딩...</td></tr>
              ) : !data || data.items.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">자료가 없습니다.</td></tr>
              ) : (
                data.items.map((i) => (
                  <tr key={i.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-3 py-2 max-w-[260px] truncate">{i.subject}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{CZ_TYPE_LABEL[i.cz_type] ?? '다운로드 쿠폰'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{CP_METHOD_LABEL[i.cp_method] ?? '-'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap font-medium">
                      {i.cp_type ? `${i.cz_point}%` : `${i.cz_point.toLocaleString()}원`}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{i.cp_id || '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-500">다운로드 후 {i.cz_period}일</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{i.cz_download.toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-[11px]">
                      {i.cz_start ? formatYMD(i.cz_start) : '-'} ~ {i.cz_end ? formatYMD(i.cz_end) : '-'}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Link to={`/coupon-zones/${i.id}`} className="inline-flex items-center px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-50 mr-1">수정</Link>
                      <button onClick={() => onDelete(i)} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-rose-200 text-rose-700 hover:bg-rose-50">
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
          <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-gray-500">
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

function formatYMD(s: string | null): string {
  if (!s) return '-'
  const dt = new Date(s); if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${String(dt.getFullYear()).slice(2)}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}
