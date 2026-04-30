import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { api } from '../lib/api'

/**
 * sample/adm/point_list.php (메뉴 350430 "포인트 관리") 정확 매핑.
 *
 * 컬럼: 내용 / 구분 / 사용자코드 / 아이디 / 닉네임 / 포인트 / 일시 / 만료일 / 포인트합
 * 검색: 회원아이디(mb_id) / 내용(po_content)
 * 기간: po_datetime
 * 상단: 전체 N건 + (회원 검색 시: 회원 잔액 / 그 외: 전체 합계)
 * 하단: 개별회원 포인트 증감 폼 (mb_id / 내용 / 포인트 / 유효기간)
 */

interface Item {
  id: number
  member_id: number | null
  login_id: string | null
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
  actor_admin_login_id: string | null
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
    searched_member: { login_id: string; nickname: string; point: number } | null
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
    sfl: 'mb_id', stx: '', fr_date: '', to_date: '',
  })
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 하단 조정 폼
  const [adj, setAdj] = useState<{ loginId: string; reason: string; point: string; expireDays: string }>({
    loginId: '', reason: '', point: '', expireDays: '',
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
    setAdjError(null); setAdjSuccess(null)
    if (!adj.loginId.trim()) return setAdjError('회원아이디를 입력하세요.')
    if (!adj.reason.trim()) return setAdjError('포인트 내용을 입력하세요.')
    const point = Number(adj.point)
    if (!Number.isInteger(point) || point === 0) return setAdjError('포인트는 0이 아닌 정수여야 합니다.')

    setAdjBusy(true)
    try {
      const res = await api<{ balanceAfter: number }>('/admin/points/adjust-by-login-id', {
        method: 'POST',
        body: JSON.stringify({
          loginId: adj.loginId.trim(),
          reason: adj.reason.trim(),
          point,
          expireDays: adj.expireDays ? Number(adj.expireDays) : undefined,
        }),
      })
      setAdjSuccess(`적용 완료. 변경 후 잔액 ${res.balanceAfter.toLocaleString()}P`)
      setAdj({ loginId: '', reason: '', point: '', expireDays: '' })
      // 리스트 새로고침
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
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
          {presetMember ? '회원 포인트 이력' : '포인트 관리'}
        </h1>
        {presetMember && (
          <Link to={`/members/customers/${presetMember}`} className="text-xs text-brand-600 hover:underline">
            ← 회원 상세로 돌아가기
          </Link>
        )}
      </div>

      {/* 상단 요약 */}
      {data && !presetMember && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onReset}
            className="px-3 py-1.5 rounded-md bg-brand-600 text-white text-xs font-medium"
          >
            전체목록
          </button>
          <CountChip label="전체" count={data.total} />
          {sm ? (
            <CountChip
              label={`${sm.login_id}님 포인트 합계`}
              count={sm.point}
              suffix="점"
              tone="brand"
            />
          ) : (
            <CountChip label="전체 합계" count={data.summary.sum_point} suffix="점" tone="brand" />
          )}
        </div>
      )}

      {/* 검색 — 한 줄 컴팩트 */}
      {!presetMember && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={pending.sfl}
              onChange={(e) => setPending({ ...pending, sfl: e.target.value as Sfl })}
              className={`w-28 ${searchInputCls}`}
            >
              {SFL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={pending.stx}
              onChange={(e) => setPending({ ...pending, stx: e.target.value })}
              placeholder="검색어"
              className={`w-44 md:w-56 ${searchInputCls}`}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            />
            <span className="mx-1 text-xs text-gray-400">|</span>
            <input
              type="date" value={pending.fr_date}
              onChange={(e) => setPending({ ...pending, fr_date: e.target.value })}
              className={`w-36 ${searchInputCls}`}
              title="시작일"
            />
            <span className="text-gray-400">~</span>
            <input
              type="date" value={pending.to_date}
              onChange={(e) => setPending({ ...pending, to_date: e.target.value })}
              className={`w-36 ${searchInputCls}`}
              title="종료일"
            />
            <button
              onClick={onSearch}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white ml-auto md:ml-0"
            >
              <Search className="w-4 h-4" /> 검색
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm">{error}</div>
      )}

      {/* 테이블 — sample 9컬럼 + 처리자(actor) 1컬럼 추가 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-brand-600 dark:bg-brand-700 text-[11px] text-white">
              <tr>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">내용</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">구분</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">처리자</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">아이디</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">닉네임</th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap">포인트</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">일시</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">만료일</th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap">포인트합</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading && !data ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">로딩...</td></tr>
              ) : !data || data.items.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">자료가 없습니다.</td></tr>
              ) : (
                data.items.map((h) => {
                  const variation = h.earn_point - h.use_point
                  return (
                    <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[280px] truncate">{h.content || '-'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {labelLevel(h.member_level, h.member_role)}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                        {h.actor_admin_login_id || labelActor(h.actor_type)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {h.member_id && h.login_id ? (
                          <Link to={`/members/customers/${h.member_id}`} className="text-brand-600 hover:underline">
                            {h.login_id}
                          </Link>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{h.member_nickname || '-'}</td>
                      <td className={`px-3 py-2 text-right whitespace-nowrap font-medium ${
                        variation > 0 ? 'text-emerald-600 dark:text-emerald-400' :
                        variation < 0 ? 'text-rose-600 dark:text-rose-400' :
                        'text-gray-500'
                      }`}>
                        {variation > 0 ? '+' : ''}{variation.toLocaleString()}
                        {h.is_paid && <span className="ml-1 inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px]">유료</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{formatDate(h.created_at)}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{formatExpireDate(h)}</td>
                      <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap font-medium">
                        {h.balance_after.toLocaleString()}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {data && data.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500">
            <div>총 {data.total.toLocaleString()}건 · {filter.page} / {totalPages} 페이지</div>
            <div className="flex gap-1">
              <button onClick={() => setFilter((f) => ({ ...f, page: Math.max(1, f.page - 1) }))} disabled={filter.page <= 1} className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">이전</button>
              <button onClick={() => setFilter((f) => ({ ...f, page: Math.min(totalPages, f.page + 1) }))} disabled={filter.page >= totalPages} className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">다음</button>
            </div>
          </div>
        )}
      </div>

      {/* 하단: 개별회원 포인트 증감 — sample 그대로 */}
      {!presetMember && (
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-200">
            개별회원 포인트 증감 설정
          </div>
          <div className="p-5 space-y-3">
            {adjError && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm">{adjError}</div>}
            {adjSuccess && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-sm">{adjSuccess}</div>}
            <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-y-3 gap-x-4 items-center">
              <label className="text-sm text-gray-700 dark:text-gray-200">회원아이디 *</label>
              <input type="text" value={adj.loginId} onChange={(e) => setAdj({ ...adj, loginId: e.target.value })} className={`max-w-md ${inputCls}`} />
              <label className="text-sm text-gray-700 dark:text-gray-200">포인트 내용 *</label>
              <input type="text" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} className={inputCls} />
              <label className="text-sm text-gray-700 dark:text-gray-200">포인트 *</label>
              <input
                type="text" inputMode="numeric" value={adj.point}
                onChange={(e) => setAdj({ ...adj, point: e.target.value.replace(/[^\-0-9]/g, '') })}
                placeholder="예: 1000 또는 -500"
                className={`max-w-xs ${inputCls}`}
              />
              <label className="text-sm text-gray-700 dark:text-gray-200">유효기간 (일)</label>
              <input
                type="text" inputMode="numeric" value={adj.expireDays}
                onChange={(e) => setAdj({ ...adj, expireDays: e.target.value.replace(/[^0-9]/g, '') })}
                placeholder="비우면 만료 없음"
                className={`max-w-[120px] ${inputCls}`}
              />
            </div>
            <div className="flex justify-center pt-2">
              <button
                onClick={onAdjustSubmit}
                disabled={adjBusy}
                className="px-6 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50"
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

const inputCls = 'px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none w-full'
const searchInputCls = 'px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none'

function CountChip({ label, count, suffix, tone }: { label: string; count: number; suffix?: string; tone?: 'brand' }) {
  const cls = tone === 'brand'
    ? 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-800'
    : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700'
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border ${cls}`}>
      <span>{label}</span>
      <span className="opacity-90">{count.toLocaleString()}{suffix ?? '건'}</span>
    </span>
  )
}

/** sample mb_level 매핑: 5=상담사 / 2=고객 / 그 외=기타 */
function labelLevel(level: number | null, role: string | null): React.ReactNode {
  let label = '기타'
  let cls = 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  if (level === 5 || role === 'counselor') {
    label = '상담사'
    cls = 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
  } else if (level === 2 || role === 'user') {
    label = '고객'
    cls = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  } else if (role === 'admin') {
    label = '관리자'
    cls = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  }
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>{label}</span>
}

function labelActor(t: string): string {
  const map: Record<string, string> = {
    admin: '관리자', consultation: '상담', payment: '결제',
    settlement: '정산', system: '시스템', legacy: '레거시',
  }
  return map[t] || t
}

function formatDate(s: string): string {
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`
}

/** sample: po_expired=1 → "만료YYMMDD" / 9999-12-31 → 빈셀 / 그 외 표시 */
function formatExpireDate(h: { is_expired: boolean; expire_date: string | null }): string {
  if (!h.expire_date) return ''
  if (h.expire_date.startsWith('9999')) return ''
  const ymd = h.expire_date.replaceAll('-', '').slice(2)
  if (h.is_expired) return `만료${ymd}`
  return h.expire_date
}
