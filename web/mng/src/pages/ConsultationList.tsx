import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Download } from 'lucide-react'
import { api } from '../lib/api'

/**
 * sample/adm/coin_counsel_history.php 화면을 그대로 따라간다.
 * - 메뉴: 사주문 관리 > 매출현황 > 사용(상담) 내역
 * - 14 컬럼: 날짜 / 회원ID / 회원이름 / 상담사ID / 상담사닉네임 / 상담유형 / 분야
 *           / 상담시작 / 상담종료 / 진행시간 / 유·무료 / 사용포인트 / 상담주제 / 채팅내용
 * - 상단 탭: 전체목록 / 060 / 070 / 채팅
 * - 검색: mb_id / mb_hp / mb_nick / cmb_id
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
  member_login_id: string | null
  member_name: string | null
  counselor_id: number | null
  counselor_login_id: string | null
  counselor_name: string | null
  counselor_nickname: string | null
  counselor_category: string | null
  counselor_unit_cost: number | null
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
  // 060/070 클릭 시 sfl=preflag로 분기 적용
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
  const [state, setState] = useState<QueryState>({
    view: 'all',
    sfl: 'mb_id',
    stx: '',
    fr_date: '',
    to_date: '',
    page: 1,
  })
  const [pending, setPending] = useState<{ sfl: Sfl; stx: string; fr_date: string; to_date: string }>({
    sfl: 'mb_id', stx: '', fr_date: '', to_date: '',
  })
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('view', state.view)
    if (state.preflag !== undefined) {
      // 060/070 탭 클릭 → sfl=preflag, stx='Y' 또는 ''
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">사용(상담) 내역</h1>
        <button
          type="button"
          disabled
          title="엑셀 다운로드는 추후 단계에서 추가"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-emerald-600 text-white opacity-50 cursor-not-allowed"
        >
          <Download className="w-4 h-4" /> 엑셀다운로드
        </button>
      </div>

      {/* 상단 탭 — sample: [전체목록] [총건수] [060] [070] [채팅] */}
      {data && (
        <div className="flex flex-wrap items-center gap-2">
          <Tab label="전체목록" active={state.view === 'all' && state.preflag === undefined} onClick={onResetTab} primary />
          <CountChip label="총건수" count={data.summary.cnt_total} />
          <CountChip
            label="060"
            count={data.summary.cnt_060}
            active={state.view === 'call' && state.preflag === ''}
            onClick={() => setState((s) => ({ ...s, view: 'call', preflag: '', page: 1 }))}
          />
          <CountChip
            label="070"
            count={data.summary.cnt_070}
            active={state.view === 'call' && state.preflag === 'Y'}
            onClick={() => setState((s) => ({ ...s, view: 'call', preflag: 'Y', page: 1 }))}
          />
          <CountChip
            label="채팅"
            count={data.summary.cnt_chat}
            active={state.view === 'chat'}
            onClick={() => setState((s) => ({ ...s, view: 'chat', preflag: undefined, page: 1 }))}
          />
        </div>
      )}

      {/* 검색 폼 — sample 그대로 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2">
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
          <input
            type="text"
            value={pending.stx}
            onChange={(e) => setPending({ ...pending, stx: e.target.value })}
            placeholder="검색어"
            className={`flex-1 min-w-[180px] ${inputCls}`}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          />
          <span className="text-xs text-gray-500 ml-2 font-medium">기간별검색</span>
          <input
            type="date"
            value={pending.fr_date}
            onChange={(e) => setPending({ ...pending, fr_date: e.target.value })}
            className={inputCls}
          />
          <span className="text-gray-400">~</span>
          <input
            type="date"
            value={pending.to_date}
            onChange={(e) => setPending({ ...pending, to_date: e.target.value })}
            className={inputCls}
          />
          <button
            onClick={onSearch}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white"
          >
            <Search className="w-4 h-4" /> 검색
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* 14컬럼 테이블 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-brand-600 dark:bg-brand-700 text-[11px] text-white">
              <tr>
                <Th>날짜</Th>
                <Th>회원ID</Th>
                <Th>회원이름</Th>
                <Th>상담사ID</Th>
                <Th>상담사닉네임</Th>
                <Th>상담유형</Th>
                <Th>분야</Th>
                <Th>상담시작</Th>
                <Th>상담종료</Th>
                <Th>진행시간</Th>
                <Th>유·무료</Th>
                <Th align="right">사용포인트</Th>
                <Th>상담주제</Th>
                <Th>채팅내용</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading && !data ? (
                <tr><td colSpan={14} className="px-4 py-8 text-center text-sm text-gray-500">로딩...</td></tr>
              ) : !data || data.items.length === 0 ? (
                <tr><td colSpan={14} className="px-4 py-8 text-center text-sm text-gray-400">자료가 없습니다.</td></tr>
              ) : (
                data.items.map((c) => <Row key={c.id} c={c} />)
              )}
            </tbody>
          </table>
        </div>

        {data && data.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500">
            <div>총 {data.total.toLocaleString()}건 · {state.page} / {totalPages} 페이지</div>
            <div className="flex gap-1">
              <button
                onClick={() => setState((s) => ({ ...s, page: Math.max(1, s.page - 1) }))}
                disabled={state.page <= 1}
                className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
              >
                이전
              </button>
              <button
                onClick={() => setState((s) => ({ ...s, page: Math.min(totalPages, s.page + 1) }))}
                disabled={state.page >= totalPages}
                className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 행 (sample 렌더링 그대로) ────────────────────────────────────────
function Row({ c }: { c: Consultation }) {
  const isChat = c.reason === 'END_CHAT'

  // 회원 표시 — sample: membid 있으면 회원, 없으면 from(전화) 폴백
  const memberIdCell =
    c.member_login_id ?? (c.caller_phone ? '(전화 매칭 미연결)' : '회원정보가 없습니다.')
  const memberNameCell =
    c.member_name ?? (c.caller_phone ? formatKorPhone(c.caller_phone) : '-')

  // 상담유형
  const typeCell = isChat ? '채팅' : c.preflag === 'Y' ? '선불' : '후불'

  // 사용포인트 — sample: amt <= cinfo['mb_4'] && usetm < 30 && !is_chat → "0(환불)"
  const unitCost = c.counselor_unit_cost ?? 0
  const isRefunded = c.amt <= unitCost && c.usetm < 30 && !isChat
  const pointCell = isRefunded ? '0(환불)' : c.amt.toLocaleString()

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
      <Td className="text-gray-600">{formatDateTime(c.eventtm ?? c.created_at)}</Td>
      <Td>
        {c.member_id && c.member_login_id ? (
          <Link to={`/members/customers/${c.member_id}`} className="text-brand-600 hover:underline">
            {c.member_login_id}
          </Link>
        ) : (
          <span className="text-gray-400">{memberIdCell}</span>
        )}
      </Td>
      <Td>{memberNameCell}</Td>
      <Td>
        {c.counselor_id && c.counselor_login_id ? (
          <Link to={`/members/counselors/${c.counselor_id}`} className="text-brand-600 hover:underline">
            {c.counselor_login_id}
          </Link>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </Td>
      <Td>{c.counselor_nickname || c.counselor_name || '-'}</Td>
      <Td>
        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${
          isChat
            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
            : c.preflag === 'Y'
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
        }`}>
          {typeCell}
        </span>
      </Td>
      <Td>{c.counselor_category || '-'}</Td>
      <Td className="text-gray-600">{formatDateTime(c.started_at)}</Td>
      <Td className="text-gray-600">{formatDateTime(c.ended_at)}</Td>
      <Td>{formatDuration(c.usetm)}</Td>
      <Td>
        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] ${
          c.is_paid
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
        }`}>
          {c.is_paid ? '유료' : '무료'}
        </span>
      </Td>
      <Td align="right" className={isRefunded ? 'text-rose-600 font-medium' : 'font-medium'}>
        {pointCell}
      </Td>
      <Td>
        <Link to={`/consultations/${c.id}`} className="text-brand-600 hover:underline font-semibold">
          확인
        </Link>
      </Td>
      <Td>
        {isChat && c.roomid ? (
          <a
            href={`/counsel/chat_history.php?token=${encodeURIComponent(c.roomid + '1')}`}
            target="_blank"
            rel="noreferrer"
            className="text-brand-600 hover:underline"
          >
            채팅내역
          </a>
        ) : (
          <span className="text-gray-300">-</span>
        )}
      </Td>
    </tr>
  )
}

// ─── 탭/칩 컴포넌트 ────────────────────────────────────────
function Tab({ label, active, onClick, primary }: { label: string; active: boolean; onClick: () => void; primary?: boolean }) {
  const cls = active
    ? primary
      ? 'bg-brand-600 text-white'
      : 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${cls}`}>
      {label}
    </button>
  )
}

function CountChip({ label, count, active, onClick }: { label: string; count: number; active?: boolean; onClick?: () => void }) {
  const interactive = !!onClick
  const base = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition'
  const cls = active
    ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
    : interactive
    ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer'
    : 'bg-gray-50 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400'
  return (
    <button onClick={onClick} disabled={!interactive} className={`${base} ${cls} disabled:cursor-default`}>
      <span>{label}</span>
      <span className="text-[11px] opacity-90">{count.toLocaleString()}건</span>
    </button>
  )
}

// ─── 테이블 헬퍼 ────────────────────────────────────────
function Th({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      scope="col"
      className={`px-3 py-2 ${align === 'right' ? 'text-right' : 'text-left'} font-medium whitespace-nowrap`}
    >
      {children}
    </th>
  )
}

function Td({ children, align, className }: { children: React.ReactNode; align?: 'left' | 'right'; className?: string }) {
  return (
    <td
      className={`px-3 py-2 ${align === 'right' ? 'text-right' : 'text-left'} whitespace-nowrap ${className ?? 'text-gray-700 dark:text-gray-300'}`}
    >
      {children}
    </td>
  )
}

// ─── 포맷 ────────────────────────────────────────────────
const inputCls =
  'px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none'

function formatDateTime(s: string | null): string {
  if (!s) return '-'
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`
}

/** sample: gmdate("H시간i분s초", usetm) — 신규는 시간이 24시간 이상 가능하니 cap 없이 누적 */
function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.trunc(seconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}시간${pad(m)}분${pad(sec)}초`
}

/** sample format_kor_phone PHP 함수 동등 */
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
