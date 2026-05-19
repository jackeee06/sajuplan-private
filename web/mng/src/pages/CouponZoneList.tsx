import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import {
  Th,
  Td,
  Tr,
  TableShell,
  THead,
  TBody,
  EmptyRow,
  Chip,
  PaginationBar,
  inputCls,
} from '../components/table'

/**
 * sample/adm/shop_admin/couponzonelist.php (메뉴 350520 "쿠폰존관리")
 *
 * 컬럼: 쿠폰이름 / 쿠폰종류 / 적용대상 / 포인트추가금액 / 쿠폰번호 /
 *      쿠폰사용기한(다운로드 후 N일) / 다운로드 / 사용기한 / 관리
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

interface Resp {
  items: Item[]
  total: number
  page: number
  limit: number
}

const CZ_TYPE_LABEL: Record<number, string> = {
  0: '다운로드 쿠폰',
  2: '포인트추가쿠폰',
  3: '코드입력쿠폰',
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
  const navigate = useNavigate()
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
    setLoading(true)
    setError(null)
    api<Resp>(`/admin/coupon-zones?${params}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [filter])

  const onDelete = async (i: Item) => {
    if (!confirm(`쿠폰존 "${i.subject}"를 삭제하시겠습니까?`)) return
    try {
      await api(`/admin/coupon-zones/${i.id}`, { method: 'DELETE' })
      setSuccess('삭제 완료')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-3">
      {/* 타이틀 + 추가 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">쿠폰존 관리</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">다운로드/코드입력/포인트추가 쿠폰</p>
        </div>
        <Link
          to="/coupon-zones/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium"
        >
          <Plus className="w-4 h-4" /> 쿠폰 추가
        </Link>
      </div>

      {/* 상단 칩 */}
      {data && (
        <div className="flex flex-wrap items-center gap-2">
          <Chip label="전체" value={data.total} />
        </div>
      )}

      {/* 검색 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 w-fit max-w-full">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-[260px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">검색</label>
            <input
              type="text"
              value={pending}
              onChange={(e) => setPending(e.target.value)}
              placeholder="쿠폰이름 검색"
              className={inputCls}
              onKeyDown={(e) => e.key === 'Enter' && setFilter({ stx: pending, page: 1 })}
            />
          </div>
          <div className="ml-auto">
            <button
              onClick={() => setFilter({ stx: pending, page: 1 })}
              className="px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white inline-flex items-center gap-1.5 font-medium"
            >
              <Search className="w-4 h-4" /> 검색
            </button>
          </div>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{success}</div>}

      {/* 테이블 */}
      <TableShell>
        <THead>
          <Th align="left">쿠폰이름</Th>
          <Th align="left">쿠폰종류</Th>
          <Th align="left">적용대상</Th>
          <Th align="right">포인트추가금액</Th>
          <Th align="left">쿠폰번호</Th>
          <Th align="left">쿠폰사용기한</Th>
          <Th align="right">다운로드</Th>
          <Th align="left">사용기한</Th>
          <Th align="center">삭제</Th>
        </THead>
        <TBody>
          {loading && !data ? (
            <EmptyRow colSpan={9} loading />
          ) : !data || data.items.length === 0 ? (
            <EmptyRow colSpan={9} />
          ) : (
            data.items.map((i) => (
              <Tr key={i.id} onClick={() => navigate(`/coupon-zones/${i.id}`)}>
                <Td align="left" className="max-w-[260px] truncate font-medium text-gray-900 dark:text-gray-100">
                  {i.subject}
                </Td>
                <Td align="left" className="text-gray-700">
                  {CZ_TYPE_LABEL[i.cz_type] ?? '다운로드 쿠폰'}
                </Td>
                <Td align="left" className="text-gray-700">
                  {CP_METHOD_LABEL[i.cp_method] ?? <span className="text-gray-300">-</span>}
                </Td>
                <Td align="right" className="font-medium tabular-nums text-gray-900 dark:text-gray-100">
                  {i.cp_type ? `${i.cz_point}%` : `${i.cz_point.toLocaleString()}원`}
                </Td>
                <Td align="left" className="font-mono text-xs text-gray-600">
                  {i.cp_id || <span className="text-gray-300">-</span>}
                </Td>
                <Td align="left" className="text-xs text-gray-500">
                  다운로드 후 {i.cz_period}일
                </Td>
                <Td align="right" className="tabular-nums">
                  {i.cz_download === 0 ? (
                    <span className="text-gray-300">0</span>
                  ) : (
                    i.cz_download.toLocaleString()
                  )}
                </Td>
                <Td align="left" className="text-[11px] text-gray-500 tabular-nums">
                  {i.cz_start ? formatYMD(i.cz_start) : '-'} ~ {i.cz_end ? formatYMD(i.cz_end) : '-'}
                </Td>
                <Td align="center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      void onDelete(i)
                    }}
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
        <PaginationBar
          page={filter.page}
          totalPages={totalPages}
          total={data.total}
          pageSize={PAGE_SIZE}
          onChange={(p) => setFilter((f) => ({ ...f, page: p }))}
          unit="개"
        />
      )}
    </div>
  )
}

function formatYMD(s: string | null): string {
  if (!s) return '-'
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${String(dt.getFullYear()).slice(2)}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}
