import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { api } from '../lib/api'
import {
  Th,
  Td,
  TableShell,
  THead,
  TBody,
  EmptyRow,
  Chip,
  Badge,
  BadgeColor,
  PaginationBar,
  inputCls,
} from '../components/table'

/**
 * sample/adm/point_list.php (메뉴 350430 "포인트 관리") 정확 매핑.
 *
 * 컬럼: 내용 / 구분 / 처리자 / 아이디 / 닉네임 / 포인트 / 일시 / 만료일 / 포인트합
 * 검색: 회원아이디(mb_id) / 내용(po_content)
 * 상단: 전체 N건 + (회원 검색 시: 회원 잔액 / 그 외: 전체 합계)
 * 하단: 개별회원 포인트 증감 폼
 */

interface Item {
  id: number
  member_id: number | null
  mb_id: string | null
  member_name: string | null
  member_nickname: string | null
  member_level: number | null
  member_role: string | null
  content: string | null
  earn_point: number
  use_point: number
  balance_after: number
  is_paid: boolean
  is_expired: boolean
  expire_date: string | null
  rel_table: string | null
  rel_id: string | null
  actor_admin_mb_id: string | null
  actor_type: string
  created_at: string
}

interface Resp {
  items: Item[]
  total: number
  page: number
  limit: number
  summary: {
    sum_point: number
    searched_member: { mb_id: string; nickname: string; point: number } | null
  }
}

type Sfl = 'mb_id' | 'po_content'

interface Filter {
  sfl: Sfl
  stx: string
  fr_date: string
  to_date: string
  page: number
}

const SFL_OPTIONS: { value: Sfl; label: string }[] = [
  { value: 'mb_id', label: '회원아이디' },
  { value: 'po_content', label: '내용' },
]

const PAGE_SIZE = Number(import.meta.env.VITE_LIST_PAGE_SIZE ?? 20)

export default function PointHistoryList() {
  const [searchParams] = useSearchParams()
  const presetMember = searchParams.get('member')

  const [filter, setFilter] = useState<Filter>({
    sfl: 'mb_id',
    stx: '',
    fr_date: '',
    to_date: '',
    page: 1,
  })
  const [pending, setPending] = useState<Omit<Filter, 'page'>>({
    sfl: 'mb_id',
    stx: '',
    fr_date: '',
    to_date: '',
  })
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 하단 조정 폼
  const [adj, setAdj] = useState<{ mbId: string; reason: string; point: string; expireDays: string }>({
    mbId: '',
    reason: '',
    point: '',
    expireDays: '',
  })
  const [adjBusy, setAdjBusy] = useState(false)
  const [adjError, setAdjError] = useState<string | null>(null)
  const [adjSuccess, setAdjSuccess] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    let url: string
    if (presetMember) {
      const params = new URLSearchParams()
      params.set('page', String(filter.page))
      params.set('limit', String(PAGE_SIZE))
      url = `/admin/members/customers/${presetMember}/point-history?${params}`
    } else {
      const params = new URLSearchParams()
      if (filter.stx) {
        params.set('sfl', filter.sfl)
        params.set('stx', filter.stx)
      }
      if (filter.fr_date) params.set('fr_date', filter.fr_date)
      if (filter.to_date) params.set('to_date', filter.to_date)
      params.set('page', String(filter.page))
      params.set('limit', String(PAGE_SIZE))
      url = `/admin/points/history?${params}`
    }

    api<Resp>(url).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [filter, presetMember])

  const onSearch = () => setFilter((f) => ({ ...f, ...pending, page: 1 }))
  const onReset = () => {
    setPending({ sfl: 'mb_id', stx: '', fr_date: '', to_date: '' })
    setFilter({ sfl: 'mb_id', stx: '', fr_date: '', to_date: '', page: 1 })
  }

  const onAdjustSubmit = async () => {
    setAdjError(null)
    setAdjSuccess(null)
    if (!adj.mbId.trim()) return setAdjError('회원아이디를 입력하세요.')
    if (!adj.reason.trim()) return setAdjError('포인트 내용을 입력하세요.')
    const point = Number(adj.point)
    if (!Number.isInteger(point) || point === 0)
      return setAdjError('포인트는 0이 아닌 정수여야 합니다.')

    setAdjBusy(true)
    try {
      const res = await api<{ balanceAfter: number }>('/admin/points/adjust-by-mb-id', {
        method: 'POST',
        body: JSON.stringify({
          mbId: adj.mbId.trim(),
          reason: adj.reason.trim(),
          point,
          expireDays: adj.expireDays ? Number(adj.expireDays) : undefined,
        }),
      })
      setAdjSuccess(`적용 완료. 변경 후 잔액 ${res.balanceAfter.toLocaleString()}P`)
      setAdj({ mbId: '', reason: '', point: '', expireDays: '' })
      setFilter((f) => ({ ...f }))
    } catch (e) {
      setAdjError(e instanceof Error ? e.message : '실패')
    } finally {
      setAdjBusy(false)
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const sm = data?.summary.searched_member

  return (
    <div className="space-y-3 max-w-[1400px]">
      {/* 타이틀 */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {presetMember ? '회원 포인트 이력' : '포인트 관리'}
        </h1>
        {presetMember && (
          <Link
            to={`/members/customers/${presetMember}`}
            className="text-xs text-brand-600 hover:underline"
          >
            ← 회원 상세로 돌아가기
          </Link>
        )}
      </div>

      {/* 상단 칩 */}
      {data && !presetMember && (
        <div className="flex flex-wrap items-center gap-2">
          <Chip label="전체목록" active onClick={onReset} />
          <Chip label="전체" value={data.total} />
          {sm ? (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700 border border-brand-200">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
              <span>{sm.mb_id}님 잔액</span>
              <span className="font-semibold tabular-nums">{sm.point.toLocaleString()}점</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700 border border-brand-200">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
              <span>전체 합계</span>
              <span className="font-semibold tabular-nums">
                {data.summary.sum_point.toLocaleString()}점
              </span>
            </span>
          )}
        </div>
      )}

      {/* 검색 */}
      {!presetMember && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 w-fit max-w-full">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-[120px]">
              <label className="block text-[11px] font-medium text-gray-500 mb-1">검색기준</label>
              <select
                value={pending.sfl}
                onChange={(e) => setPending({ ...pending, sfl: e.target.value as Sfl })}
                className={inputCls}
              >
                {SFL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-[240px]">
              <label className="block text-[11px] font-medium text-gray-500 mb-1">검색어</label>
              <input
                type="text"
                value={pending.stx}
                onChange={(e) => setPending({ ...pending, stx: e.target.value })}
                placeholder="검색어"
                className={inputCls}
                onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              />
            </div>
            <div className="w-[160px]">
              <label className="block text-[11px] font-medium text-gray-500 mb-1">시작일</label>
              <input
                type="date"
                value={pending.fr_date}
                onChange={(e) => setPending({ ...pending, fr_date: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="w-[160px]">
              <label className="block text-[11px] font-medium text-gray-500 mb-1">종료일</label>
              <input
                type="date"
                value={pending.to_date}
                onChange={(e) => setPending({ ...pending, to_date: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="ml-auto">
              <button
                onClick={onSearch}
                className="px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white inline-flex items-center gap-1.5 font-medium"
              >
                <Search className="w-4 h-4" /> 검색
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* 테이블 */}
      <TableShell>
        <THead>
          <Th align="left">내용</Th>
          <Th align="center">구분</Th>
          <Th align="left">처리자</Th>
          <Th align="left">아이디</Th>
          <Th align="left">닉네임</Th>
          <Th align="right">포인트</Th>
          <Th align="left">일시</Th>
          <Th align="left">만료일</Th>
          <Th align="right">포인트합</Th>
        </THead>
        <TBody>
          {loading && !data ? (
            <EmptyRow colSpan={9} loading />
          ) : !data || data.items.length === 0 ? (
            <EmptyRow colSpan={9} />
          ) : (
            data.items.map((h) => {
              const variation = h.earn_point - h.use_point
              return (
                <tr
                  key={h.id}
                  className="border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-brand-50/40 dark:hover:bg-brand-500/5 transition-colors"
                >
                  <Td align="left" className="text-gray-700 max-w-[280px] truncate">
                    {h.content || <span className="text-gray-300">-</span>}
                  </Td>
                  <Td align="center">{renderLevelBadge(h.member_level, h.member_role)}</Td>
                  <Td align="left" className="text-xs text-gray-500">
                    {h.actor_admin_mb_id || labelActor(h.actor_type)}
                  </Td>
                  <Td align="left">
                    {h.member_id && h.mb_id ? (
                      <Link
                        to={`/members/customers/${h.member_id}`}
                        className="text-brand-600 hover:underline font-medium"
                      >
                        {h.mb_id}
                      </Link>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </Td>
                  <Td align="left" className="text-gray-700">
                    {h.member_nickname || <span className="text-gray-300">-</span>}
                  </Td>
                  <Td
                    align="right"
                    className={`font-medium tabular-nums ${
                      variation > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : variation < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-gray-400'
                    }`}
                  >
                    {variation > 0 ? '+' : ''}
                    {variation.toLocaleString()}
                    {h.is_paid && (
                      <span className="ml-1 inline-block px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-medium">
                        유료
                      </span>
                    )}
                  </Td>
                  <Td align="left" className="text-xs text-gray-500 tabular-nums">
                    {formatDate(h.created_at)}
                  </Td>
                  <Td align="left" className="text-xs text-gray-500 tabular-nums">
                    {formatExpireDate(h)}
                  </Td>
                  <Td align="right" className="font-medium tabular-nums text-gray-900 dark:text-gray-100">
                    {h.balance_after.toLocaleString()}
                  </Td>
                </tr>
              )
            })
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
          unit="건"
        />
      )}

      {/* 하단: 개별회원 포인트 증감 */}
      {!presetMember && (
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl max-w-[800px]">
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-200">
            개별회원 포인트 증감 설정
          </div>
          <div className="p-4 space-y-3">
            {adjError && (
              <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm">
                {adjError}
              </div>
            )}
            {adjSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-sm">
                {adjSuccess}
              </div>
            )}
            <div className="grid grid-cols-[100px_auto] gap-y-2 gap-x-3 items-center">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                회원아이디 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={adj.mbId}
                onChange={(e) => setAdj({ ...adj, mbId: e.target.value })}
                className={`w-[240px] ${inputCls}`}
              />
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                포인트 내용 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={adj.reason}
                onChange={(e) => setAdj({ ...adj, reason: e.target.value })}
                className={`w-[400px] ${inputCls}`}
              />
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                포인트 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={adj.point}
                onChange={(e) => setAdj({ ...adj, point: e.target.value.replace(/[^\-0-9]/g, '') })}
                placeholder="예: 1000 또는 -500"
                className={`w-[180px] ${inputCls}`}
              />
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">유효기간 (일)</label>
              <input
                type="text"
                inputMode="numeric"
                value={adj.expireDays}
                onChange={(e) => setAdj({ ...adj, expireDays: e.target.value.replace(/[^0-9]/g, '') })}
                placeholder="비우면 만료 없음"
                className={`w-[120px] ${inputCls}`}
              />
            </div>
            <div className="pt-2">
              <button
                onClick={onAdjustSubmit}
                disabled={adjBusy}
                className="px-5 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white font-medium disabled:opacity-50"
              >
                {adjBusy ? '처리 중...' : '확인'}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function renderLevelBadge(level: number | null, role: string | null) {
  let label = '기타'
  let color: BadgeColor = 'gray'
  if (level === 5 || role === 'counselor') {
    label = '상담사'
    color = 'indigo'
  } else if (level === 2 || role === 'user') {
    label = '고객'
    color = 'blue'
  } else if (role === 'admin') {
    label = '관리자'
    color = 'emerald'
  }
  return <Badge color={color}>{label}</Badge>
}

function labelActor(t: string): string {
  const map: Record<string, string> = {
    admin: '관리자',
    consultation: '상담',
    payment: '결제',
    settlement: '정산',
    system: '시스템',
    legacy: '레거시',
  }
  return map[t] || t
}

function formatDate(s: string): string {
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`
}

function formatExpireDate(h: { is_expired: boolean; expire_date: string | null }): string {
  if (!h.expire_date) return ''
  if (h.expire_date.startsWith('9999')) return ''
  const ymd = h.expire_date.replaceAll('-', '').slice(2)
  if (h.is_expired) return `만료${ymd}`
  return h.expire_date
}
