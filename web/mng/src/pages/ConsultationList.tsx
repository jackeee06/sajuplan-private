import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Download } from 'lucide-react'
import { api } from '../lib/api'
import { defaultLast7Days } from '../lib/dateRange'
import { DateRangeChips } from '../components/DateRangeChips'
import {
  Th,
  Td,
  Tr,
  IdCell,
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
 * 사용(상담) 내역 — sample/adm/coin_counsel_history.php 화면.
 *  메뉴: 매출현황 > 사용(상담) 내역
 *  컬럼: 날짜 / 회원ID / 회원이름 / 상담사ID / 상담사닉네임 / 상담유형 / 분야
 *       / 상담시작 / 상담종료 / 진행시간 / 유·무료 / 사용포인트 / 채팅내역
 *  상단 칩: 전체목록 / 총건수 / 060 / 070 / 채팅
 *  검색: mb_id / mb_hp / mb_nick / cmb_id
 */

interface Consultation {
  id: number
  no: number | null
  eventtm: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
  csrid: string | null
  membid: string | null
  caller_phone: string | null
  callee_phone: string | null
  callid: string | null
  roomid: string | null
  reason: string | null
  preflag: string | null
  usetm: number
  amt: number
  amt_free: number
  amt_pro: number
  is_paid: boolean
  is_settled: boolean
  is_absent_disconnect: boolean
  skip_charge: boolean
  member_id: number | null
  member_mb_id: string | null
  member_name: string | null
  counselor_id: number | null
  counselor_mb_id: string | null
  counselor_name: string | null
  counselor_nickname: string | null
  counselor_category: string | null
  counselor_unit_cost: number | null
  unit_cost_snapshot?: number | null
  grade_at_session?: string | null
  counselor_grade?: string | null
  counselor_revenue_rate?: number | null
  counselor_earning?: number
  m2net_deduction?: number
  sajuplan_revenue?: number
}

interface Resp {
  items: Consultation[]
  total: number
  page: number
  limit: number
  summary: {
    cnt_total: number
    cnt_070: number
    cnt_060: number
    cnt_chat: number
  }
}

type View = 'all' | 'call' | 'chat'
type Sfl = 'mb_id' | 'mb_hp' | 'mb_nick' | 'cmb_id'

interface QueryState {
  view: View
  sfl: Sfl
  stx: string
  fr_date: string
  to_date: string
  page: number
  preflag?: 'Y' | ''
}

const SFL_OPTIONS: { value: Sfl; label: string }[] = [
  { value: 'mb_id', label: '회원아이디' },
  { value: 'mb_hp', label: '휴대폰번호' },
  { value: 'mb_nick', label: '상담사닉네임' },
  { value: 'cmb_id', label: '상담사 아이디' },
]

const PAGE_SIZE = Number(import.meta.env.VITE_LIST_PAGE_SIZE ?? 20)

export default function ConsultationList() {
  const navigate = useNavigate()
  // [2026-06-02 v2] 사장님 명시: 기본 활성 = 최근 7일
  const _init30 = defaultLast7Days()
  const [state, setState] = useState<QueryState>({
    view: 'all',
    sfl: 'mb_id',
    stx: '',
    fr_date: _init30.from,
    to_date: _init30.to,
    page: 1,
  })
  const [pending, setPending] = useState<{ sfl: Sfl; stx: string; fr_date: string; to_date: string }>({
    sfl: 'mb_id',
    stx: '',
    fr_date: _init30.from,
    to_date: _init30.to,
  })
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('view', state.view)
    if (state.preflag !== undefined) {
      params.set('sfl', 'preflag')
      params.set('stx', state.preflag)
    } else if (state.stx) {
      params.set('sfl', state.sfl)
      params.set('stx', state.stx)
    }
    if (state.fr_date) params.set('fr_date', state.fr_date)
    if (state.to_date) params.set('to_date', state.to_date)
    params.set('page', String(state.page))
    params.set('limit', String(PAGE_SIZE))

    setLoading(true)
    setError(null)
    api<Resp>(`/admin/consultations?${params}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [state])

  const onSearch = () =>
    setState((s) => ({ ...s, ...pending, preflag: undefined, page: 1 }))

  const onResetTab = () =>
    setState((s) => ({ ...s, view: 'all', preflag: undefined, page: 1 }))

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-3">
      {/* 타이틀 + 엑셀 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">사용(상담) 내역</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">상담 종료된 사용 이력</p>
        </div>
        <button
          type="button"
          disabled
          title="엑셀 다운로드는 추후 단계에서 추가"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border border-gray-200 text-gray-400 dark:border-gray-700 opacity-50 cursor-not-allowed"
        >
          <Download className="w-4 h-4" /> 엑셀다운로드
        </button>
      </div>

      {/* 칩: 전체목록 / 총건수 / 060 / 070 / 채팅 */}
      {data && (
        <div className="flex flex-wrap items-center gap-2">
          <Chip
            label="전체목록"
            active={state.view === 'all' && state.preflag === undefined}
            onClick={onResetTab}
          />
          <Chip label="총건수" value={data.summary.cnt_total} />
          <Chip
            label="060"
            value={data.summary.cnt_060}
            dotColor="gray"
            active={state.view === 'call' && state.preflag === ''}
            onClick={() => setState((s) => ({ ...s, view: 'call', preflag: '', page: 1 }))}
          />
          <Chip
            label="070"
            value={data.summary.cnt_070}
            dotColor="amber"
            active={state.view === 'call' && state.preflag === 'Y'}
            onClick={() => setState((s) => ({ ...s, view: 'call', preflag: 'Y', page: 1 }))}
          />
          <Chip
            label="채팅"
            value={data.summary.cnt_chat}
            dotColor="indigo"
            active={state.view === 'chat'}
            onClick={() => setState((s) => ({ ...s, view: 'chat', preflag: undefined, page: 1 }))}
          />
        </div>
      )}

      {/* 검색 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 w-fit max-w-full">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-[140px]">
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
          <div className="w-[260px]">
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
            <label className="block text-[11px] font-medium text-gray-500 mb-1">기간 시작</label>
            <input
              type="date"
              value={pending.fr_date}
              onChange={(e) => setPending({ ...pending, fr_date: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="w-[160px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">기간 종료</label>
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
        {/* [2026-06-02] 빠른 기간 칩 — 사장님 합의 (오늘/어제/최근7일/이번달/지난달) */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <DateRangeChips
            from={pending.fr_date}
            to={pending.to_date}
            onPick={(r) => {
              const next = { ...pending, fr_date: r.from, to_date: r.to }
              setPending(next)
              setState((s) => ({ ...s, fr_date: r.from, to_date: r.to, page: 1 }))
            }}
          />
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* 테이블 */}
      <TableShell>
        <THead>
          <Th align="right">번호</Th>
          <Th align="left">날짜</Th>
          <Th align="left">회원ID</Th>
          <Th align="left">회원이름</Th>
          <Th align="left">상담사ID</Th>
          <Th align="left">상담사닉네임</Th>
          <Th align="center">상담유형</Th>
          <Th align="left">분야</Th>
          <Th align="left">상담시작</Th>
          <Th align="left">상담종료</Th>
          <Th align="right">진행시간</Th>
          <Th align="center">유·무료</Th>
          <Th align="right">사용포인트</Th>
          <Th align="center">상담사%</Th>
          <Th align="right">m2net차감</Th>
          <Th align="right">상담사수익금</Th>
          <Th align="right">영업이익(≈23%)</Th>
          <Th align="center">채팅내역</Th>
        </THead>
        <TBody>
          {loading && !data ? (
            <EmptyRow colSpan={14} loading />
          ) : !data || data.items.length === 0 ? (
            <EmptyRow colSpan={14} />
          ) : (
            data.items.map((c) => (
              <ConsultationRow key={c.id} c={c} onOpen={() => navigate(`/consultations/${c.id}`)} />
            ))
          )}
        </TBody>
      </TableShell>

      {data && (
        <PaginationBar
          page={state.page}
          totalPages={totalPages}
          total={data.total}
          pageSize={PAGE_SIZE}
          onChange={(p) => setState((s) => ({ ...s, page: p }))}
          unit="건"
        />
      )}
    </div>
  )
}

// ─── 행 ────────────────────────────────────────
function ConsultationRow({ c, onOpen }: { c: Consultation; onOpen: () => void }) {
  const isChat = c.reason === 'END_CHAT'
  const memberIdCell =
    c.member_mb_id ?? (c.caller_phone ? '(전화 매칭 미연결)' : '회원정보가 없습니다.')
  const memberNameCell =
    c.member_name ?? (c.caller_phone ? formatKorPhone(c.caller_phone) : '-')

  const typeCell = isChat ? '채팅' : c.preflag === 'Y' ? '선불' : '후불'
  const typeBadgeColor: BadgeColor = isChat ? 'indigo' : c.preflag === 'Y' ? 'amber' : 'gray'

  const unitCost = c.counselor_unit_cost ?? 0
  const isRefunded = c.amt <= unitCost && c.usetm < 30 && !isChat
  const pointCell = isRefunded ? '0(환불)' : c.amt.toLocaleString()

  return (
    <Tr onClick={onOpen}>
      <IdCell id={c.id} />
      <Td align="left" className="text-xs text-gray-600 tabular-nums">
        {formatDateTime(c.eventtm ?? c.created_at)}
      </Td>
      <Td align="left" className="text-xs">
        {c.member_id && c.member_mb_id ? (
          <Link
            to={`/members/customers/${c.member_id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-brand-600 hover:underline font-medium"
          >
            {c.member_mb_id}
          </Link>
        ) : (
          <span className="text-gray-400">{memberIdCell}</span>
        )}
      </Td>
      <Td align="left">{memberNameCell}</Td>
      <Td align="left" className="text-xs">
        {c.counselor_id && c.counselor_mb_id ? (
          <Link
            to={`/members/counselors/${c.counselor_id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-brand-600 hover:underline font-medium"
          >
            {c.counselor_mb_id}
          </Link>
        ) : (
          <span className="text-gray-300">-</span>
        )}
      </Td>
      <Td align="left" className="text-gray-700">
        {c.counselor_nickname || c.counselor_name || <span className="text-gray-300">-</span>}
      </Td>
      <Td align="center">
        <Badge color={typeBadgeColor}>{typeCell}</Badge>
      </Td>
      <Td align="left" className="text-gray-700">
        {c.counselor_category || <span className="text-gray-300">-</span>}
      </Td>
      <Td align="left" className="text-xs text-gray-600 tabular-nums">
        {formatDateTime(c.started_at)}
      </Td>
      <Td align="left" className="text-xs text-gray-600 tabular-nums">
        {formatDateTime(c.ended_at)}
      </Td>
      <Td align="right" className="text-xs tabular-nums text-gray-700">
        {formatDuration(c.usetm)}
      </Td>
      <Td align="center">
        <Badge color={c.is_paid ? 'amber' : 'gray'}>{c.is_paid ? '유료' : '무료'}</Badge>
      </Td>
      <Td
        align="right"
        className={`tabular-nums font-medium ${isRefunded ? 'text-rose-600' : 'text-gray-900 dark:text-gray-100'}`}
      >
        {pointCell}
      </Td>
      {/* 수익 분해 — 상담사% / m2net차감 / 상담사수익금 / 사주플랜매출 */}
      <Td align="center" className="text-xs text-gray-500 tabular-nums">
        {c.counselor_revenue_rate != null
          ? `${Math.round(c.counselor_revenue_rate * 100)}%`
          : <span className="text-gray-300">-</span>}
      </Td>
      <Td align="right" className="tabular-nums text-orange-500 font-medium text-xs">
        {c.m2net_deduction != null && c.amt > 0
          ? c.m2net_deduction.toLocaleString()
          : <span className="text-gray-300">-</span>}
      </Td>
      <Td align="right" className="tabular-nums text-indigo-600 font-medium text-xs">
        {c.counselor_earning != null && c.amt > 0
          ? c.counselor_earning.toLocaleString()
          : <span className="text-gray-300">-</span>}
      </Td>
      <Td align="right" className="tabular-nums text-emerald-700 font-medium text-xs">
        {c.sajuplan_revenue != null && c.amt > 0
          ? c.sajuplan_revenue.toLocaleString()
          : <span className="text-gray-300">-</span>}
      </Td>
      <Td align="center">
        {isChat && c.roomid ? (
          <Link
            to={`/chat-history/by-roomid?roomid=${encodeURIComponent(c.roomid)}`}
            onClick={(e) => e.stopPropagation()}
            className="text-brand-600 hover:underline text-xs"
          >
            채팅내역
          </Link>
        ) : (
          <span className="text-gray-300">-</span>
        )}
      </Td>
    </Tr>
  )
}

// ─── 포맷 ────────────────────────────────────────
function formatDateTime(s: string | null): string {
  if (!s) return '-'
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.trunc(seconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(sec)}`
}

function formatKorPhone(v: string | null): string {
  if (!v) return ''
  const n = v.replace(/\D+/g, '')
  if (!n) return ''
  if (n.startsWith('02')) {
    if (n.length === 9) return n.replace(/^(02)(\d{3})(\d{4})$/, '$1-$2-$3')
    if (n.length === 10) return n.replace(/^(02)(\d{4})(\d{4})$/, '$1-$2-$3')
  }
  if (n.length === 11) return n.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3')
  if (n.length === 10) return n.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3')
  if (n.length === 8) return n.replace(/^(\d{4})(\d{4})$/, '$1-$2')
  return n
}
