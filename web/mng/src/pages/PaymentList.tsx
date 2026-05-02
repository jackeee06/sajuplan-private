import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Download } from 'lucide-react'
import { api } from '../lib/api'

/**
 * sample/adm/coin_pay_history.php (메뉴 350420 "결제 내역") 정확 매핑.
 *
 * 컬럼: 번호 / 날짜 / 결제방법 / 사용자코드 / 아이디 / 닉네임 / 핸드폰번호 / 결제금액 / 충전금액 / 결과
 * 탭:   전체목록 / 카드 / 가상결제 / 카드취소
 * 검색: 회원아이디 / 이름 / 닉네임 / 휴대폰 / 일반전화 / 등급 / 잔액
 * 기간: od_time → created_at
 *
 * 결과 메시지 매핑:
 *   "ok" → "입금완료" (sample 동일)
 *
 * 결제방법 매핑 (한국어 표시):
 *   DIR_CARD / GNRC_AUTO_PAY_CARD / *PACA*  → 카드(직접결제 / 자동결제)
 *   GNR_VRBANK / GNR_PC_PAVC / GNR_MOB_PAVC / VRBANK_PAY → 가상결제
 *   그 외 → 원본 표시
 */

interface Payment {
  id: number
  no: number | null
  member_id: number | null
  mb_id: string | null
  member_name: string | null
  member_nickname: string | null
  member_phone: string | null
  membid: string | null
  oid: string
  tid: string | null
  pay_method: string | null
  amount: number
  coin_amount: number
  cancelled_amount: number
  cancel_count: number
  status: string
  req_result: string | null
  result_message: string | null
  bank_name: string | null
  vr_account: string | null
  deposit_name: string | null
  deposit_time: string | null
  cancelled_at: string | null
  created_at: string
}

interface Resp {
  items: Payment[]
  total: number
  page: number
  limit: number
  summary: {
    cnt_card: number
    cnt_vbank: number
    cnt_cancle: number
    total_price: number
  }
}

type Sfl = 'mb_id' | 'mb_name' | 'mb_nick' | 'mb_hp' | 'mb_tel' | 'mb_level' | 'mb_point'
type Smode = '' | 'card' | 'vbank' | 'card_cancle'

interface Filter {
  sfl: Sfl
  stx: string
  fr_date: string
  to_date: string
  smode: Smode
  page: number
}

const SFL_OPTIONS: { value: Sfl; label: string }[] = [
  { value: 'mb_id', label: '회원아이디' },
  { value: 'mb_name', label: '이름' },
  { value: 'mb_nick', label: '닉네임' },
  { value: 'mb_hp', label: '휴대폰' },
  { value: 'mb_tel', label: '일반전화' },
  { value: 'mb_level', label: '등급' },
  { value: 'mb_point', label: '잔액(이상)' },
]

const PAGE_SIZE = Number(import.meta.env.VITE_LIST_PAGE_SIZE ?? 20)

export default function PaymentList() {
  const [filter, setFilter] = useState<Filter>({
    sfl: 'mb_id', stx: '', fr_date: '', to_date: '', smode: '', page: 1,
  })
  const [pending, setPending] = useState<Omit<Filter, 'page' | 'smode'>>({
    sfl: 'mb_id', stx: '', fr_date: '', to_date: '',
  })
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (filter.stx) {
      params.set('sfl', filter.sfl)
      params.set('stx', filter.stx)
    }
    if (filter.fr_date) params.set('fr_date', filter.fr_date)
    if (filter.to_date) params.set('to_date', filter.to_date)
    if (filter.smode) params.set('smode', filter.smode)
    params.set('page', String(filter.page))
    params.set('limit', String(PAGE_SIZE))

    setLoading(true)
    setError(null)
    api<Resp>(`/admin/payments?${params}`).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [filter])

  const onSearch = () => setFilter((f) => ({ ...f, ...pending, page: 1 }))
  const onResetTab = () => setFilter((f) => ({ ...f, smode: '', page: 1 }))

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">결제 내역</h1>
        <button
          type="button" disabled
          title="엑셀 다운로드는 추후 단계에서 추가"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-emerald-600 text-white opacity-50 cursor-not-allowed"
        >
          <Download className="w-4 h-4" /> 엑셀다운로드
        </button>
      </div>

      {/* 상단 탭 — sample: 전체목록 / 총건수 / 카드 / 가상결제 / 총 결제금액 */}
      {data && (
        <div className="flex flex-wrap items-center gap-2">
          <Tab label="전체목록" active={filter.smode === ''} onClick={onResetTab} primary />
          <CountChip label="총건수" count={data.total} />
          <CountChip label="카드" count={data.summary.cnt_card} active={filter.smode === 'card'} onClick={() => setFilter((f) => ({ ...f, smode: 'card', page: 1 }))} />
          <CountChip label="가상결제" count={data.summary.cnt_vbank} active={filter.smode === 'vbank'} onClick={() => setFilter((f) => ({ ...f, smode: 'vbank', page: 1 }))} />
          <CountChip label="카드취소" count={data.summary.cnt_cancle} active={filter.smode === 'card_cancle'} onClick={() => setFilter((f) => ({ ...f, smode: 'card_cancle', page: 1 }))} />
          <span className="text-gray-300 mx-1">|</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <span>총 결제금액</span>
            <span>{data.summary.total_price.toLocaleString()}원</span>
          </span>
        </div>
      )}

      {/* 검색 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select value={pending.sfl} onChange={(e) => setPending({ ...pending, sfl: e.target.value as Sfl })} className={inputCls}>
            {SFL_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
          <input
            type="text" value={pending.stx}
            onChange={(e) => setPending({ ...pending, stx: e.target.value })}
            placeholder="검색어"
            className={`flex-1 min-w-[180px] ${inputCls}`}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          />
          <span className="text-xs text-gray-500 ml-2 font-medium">기간별검색</span>
          <input type="date" value={pending.fr_date} onChange={(e) => setPending({ ...pending, fr_date: e.target.value })} className={inputCls} />
          <span className="text-gray-400">~</span>
          <input type="date" value={pending.to_date} onChange={(e) => setPending({ ...pending, to_date: e.target.value })} className={inputCls} />
          <button onClick={onSearch} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white">
            <Search className="w-4 h-4" /> 검색
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm">{error}</div>}

      {/* 11 컬럼 테이블 (sample 그대로) */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-brand-600 dark:bg-brand-700 text-[11px] text-white">
              <tr>
                <Th>번호</Th>
                <Th>날짜</Th>
                <Th>결제방법</Th>
                <Th>사용자코드</Th>
                <Th>아이디</Th>
                <Th>닉네임</Th>
                <Th>핸드폰번호</Th>
                <Th align="right">결제금액</Th>
                <Th align="right">충전금액</Th>
                <Th>결과</Th>
                <Th>상세</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading && !data ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-sm text-gray-500">로딩...</td></tr>
              ) : !data || data.items.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-sm text-gray-400">자료가 없습니다.</td></tr>
              ) : (
                data.items.map((p, idx) => {
                  const num = data.total - (filter.page - 1) * PAGE_SIZE - idx
                  return <Row key={p.id} p={p} num={num} />
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
    </div>
  )
}

function Row({ p, num }: { p: Payment; num: number }) {
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
      <Td>{num}</Td>
      <Td className="text-gray-500">{formatDate(p.created_at)}</Td>
      <Td>{labelPayMethod(p.pay_method)}</Td>
      <Td className="text-gray-500 font-mono">{p.membid || '-'}</Td>
      <Td>
        {p.member_id && p.mb_id ? (
          <Link to={`/members/customers/${p.member_id}`} className="text-brand-600 hover:underline">{p.mb_id}</Link>
        ) : <span className="text-gray-400">-</span>}
      </Td>
      <Td>{p.member_nickname || '-'}</Td>
      <Td className="text-gray-500">{formatPhone(p.member_phone)}</Td>
      <Td align="right" className="font-medium">{p.amount.toLocaleString()}</Td>
      <Td align="right" className="text-gray-500">{p.coin_amount.toLocaleString()}</Td>
      <Td>
        <ResultBadge msg={p.result_message} status={p.status} />
      </Td>
      <Td>
        <Link to={`/payments/${p.id}`} className="text-brand-600 hover:underline">확인</Link>
      </Td>
    </tr>
  )
}

function ResultBadge({ msg, status }: { msg: string | null; status: string }) {
  // sample 변환: "ok" → "입금완료"
  let label = msg ?? '-'
  if (msg === 'ok') label = '입금완료'

  let cls = 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
  if (label === '취소완료' || status === 'cancelled') cls = 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
  else if (label === '입금완료' || label === '정상처리' || status === 'completed') cls = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  else if (label === '입금전' || status === 'pending') cls = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  else if (status === 'failed') cls = 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300'

  return <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${cls}`}>{label}</span>
}

function Tab({ label, active, onClick, primary }: { label: string; active: boolean; onClick: () => void; primary?: boolean }) {
  const cls = active
    ? primary ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
  return <button onClick={onClick} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${cls}`}>{label}</button>
}

function CountChip({ label, count, active, onClick }: { label: string; count: number; active?: boolean; onClick?: () => void }) {
  const interactive = !!onClick
  const cls = active
    ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
    : interactive
    ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer'
    : 'bg-gray-50 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400'
  return (
    <button onClick={onClick} disabled={!interactive} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${cls} disabled:cursor-default`}>
      <span>{label}</span>
      <span className="opacity-90">{count.toLocaleString()}건</span>
    </button>
  )
}

function Th({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <th scope="col" className={`px-3 py-2 ${align === 'right' ? 'text-right' : 'text-left'} font-medium whitespace-nowrap`}>{children}</th>
}

function Td({ children, align, className }: { children: React.ReactNode; align?: 'left' | 'right'; className?: string }) {
  return <td className={`px-3 py-2 ${align === 'right' ? 'text-right' : 'text-left'} whitespace-nowrap ${className ?? 'text-gray-700 dark:text-gray-300'}`}>{children}</td>
}

const inputCls = 'px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none'

/** sample PayMethod 매핑 → 한국어 */
function labelPayMethod(m: string | null): string {
  if (!m) return '-'
  if (m === 'DIR_CARD') return '카드(직접)'
  if (m === 'GNRC_AUTO_PAY_CARD') return '카드(자동)'
  if (m.includes('PACA')) return `카드(${m})`
  if (m === 'GNR_VRBANK' || m === 'GNR_PC_PAVC' || m === 'GNR_MOB_PAVC' || m === 'VRBANK_PAY') return '가상계좌'
  if (m === 'card') return '카드'
  if (m === 'vbank') return '가상계좌'
  if (m === 'account') return '계좌이체'
  if (m === 'hp') return '휴대폰'
  return m
}

function formatDate(s: string): string {
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`
}

function formatPhone(v: string | null): string {
  if (!v) return '-'
  const n = v.replace(/\D+/g, '')
  if (!n) return v
  if (n.length === 11) return n.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3')
  if (n.length === 10) return n.startsWith('02')
    ? n.replace(/^(02)(\d{4})(\d{4})$/, '$1-$2-$3')
    : n.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3')
  return n
}
