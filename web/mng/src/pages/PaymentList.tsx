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
 * sample/adm/coin_pay_history.php (메뉴 350420 "결제 내역") 정확 매핑.
 *
 * 컬럼: 번호 / 날짜 / 결제방법 / 사용자코드 / 아이디 / 닉네임 / 핸드폰번호 / 결제금액 / 충전금액 / 결과
 * 탭:   전체목록 / 카드 / 가상결제 / 카드취소
 * 검색: 회원아이디 / 이름 / 닉네임 / 휴대폰 / 일반전화 / 등급 / 잔액
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
  const navigate = useNavigate()
  // [2026-06-02 v2] 사장님 명시: 기본 활성 = 최근 7일 (칩 활성 명확화)
  const _init30 = defaultLast7Days()
  const [filter, setFilter] = useState<Filter>({
    sfl: 'mb_id',
    stx: '',
    fr_date: _init30.from,
    to_date: _init30.to,
    smode: '',
    page: 1,
  })
  const [pending, setPending] = useState<Omit<Filter, 'page' | 'smode'>>({
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
    api<Resp>(`/admin/payments?${params}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [filter])

  const onSearch = () => setFilter((f) => ({ ...f, ...pending, page: 1 }))
  const onResetTab = () => setFilter((f) => ({ ...f, smode: '', page: 1 }))

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-3">
      {/* 타이틀 + 엑셀 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">결제 내역</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">결제·충전 이력 (카드 / 가상계좌 / 취소)</p>
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

      {/* 칩 + 총 결제금액 */}
      {data && (
        <div className="flex flex-wrap items-center gap-2">
          <Chip label="전체목록" active={filter.smode === ''} onClick={onResetTab} />
          <Chip label="총건수" value={data.total} />
          <Chip
            label="카드"
            value={data.summary.cnt_card}
            dotColor="blue"
            active={filter.smode === 'card'}
            onClick={() => setFilter((f) => ({ ...f, smode: 'card', page: 1 }))}
          />
          <Chip
            label="가상결제"
            value={data.summary.cnt_vbank}
            dotColor="amber"
            active={filter.smode === 'vbank'}
            onClick={() => setFilter((f) => ({ ...f, smode: 'vbank', page: 1 }))}
          />
          <Chip
            label="카드취소"
            value={data.summary.cnt_cancle}
            dotColor="rose"
            active={filter.smode === 'card_cancle'}
            onClick={() => setFilter((f) => ({ ...f, smode: 'card_cancle', page: 1 }))}
          />
          <span className="text-gray-300 mx-1">|</span>
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>총 결제금액</span>
            <span className="font-semibold tabular-nums">{data.summary.total_price.toLocaleString()}원</span>
          </span>
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
              setFilter((f) => ({ ...f, ...next, page: 1 }))
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
          <Th align="left">결제방법</Th>
          <Th align="left">사용자코드</Th>
          <Th align="left">아이디</Th>
          <Th align="left">닉네임</Th>
          <Th align="left">핸드폰번호</Th>
          <Th align="right">결제금액</Th>
          <Th align="right">충전금액</Th>
          <Th align="center">결과</Th>
        </THead>
        <TBody>
          {loading && !data ? (
            <EmptyRow colSpan={10} loading />
          ) : !data || data.items.length === 0 ? (
            <EmptyRow colSpan={10} />
          ) : (
            data.items.map((p) => (
              <PaymentRow key={p.id} p={p} onOpen={() => navigate(`/payments/${p.id}`)} />
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
          unit="건"
        />
      )}
    </div>
  )
}

function PaymentRow({ p, onOpen }: { p: Payment; onOpen: () => void }) {
  return (
    <Tr onClick={onOpen}>
      <IdCell id={p.id} />
      <Td align="left" className="text-xs text-gray-600 tabular-nums">
        {formatDate(p.created_at)}
      </Td>
      <Td align="left" className="text-gray-700">{labelPayMethod(p.pay_method)}</Td>
      <Td align="left" className="text-xs text-gray-500 font-mono">
        {p.membid || <span className="text-gray-300">-</span>}
      </Td>
      <Td align="left">
        {p.member_id && p.mb_id ? (
          <Link
            to={`/members/customers/${p.member_id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-brand-600 hover:underline font-medium"
          >
            {p.mb_id}
          </Link>
        ) : (
          <span className="text-gray-300">-</span>
        )}
      </Td>
      <Td align="left">{p.member_nickname || <span className="text-gray-300">-</span>}</Td>
      <Td align="left" className="font-mono text-xs text-gray-600">
        {formatPhone(p.member_phone)}
      </Td>
      <Td align="right" className="font-medium tabular-nums text-gray-900 dark:text-gray-100">
        {p.amount.toLocaleString()}
      </Td>
      <Td align="right" className="tabular-nums text-gray-600">
        {p.coin_amount.toLocaleString()}
      </Td>
      <Td align="center">
        <ResultBadge msg={p.result_message} status={p.status} />
      </Td>
    </Tr>
  )
}

function ResultBadge({ msg, status }: { msg: string | null; status: string }) {
  let label = msg ?? '-'
  if (msg === 'ok') label = '입금완료'

  let color: BadgeColor = 'gray'
  if (label === '취소완료' || status === 'cancelled') color = 'rose'
  else if (label === '입금완료' || label === '정상처리' || status === 'completed') color = 'emerald'
  else if (label === '입금전' || status === 'pending') color = 'amber'

  return <Badge color={color}>{label}</Badge>
}

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
  if (n.length === 10)
    return n.startsWith('02')
      ? n.replace(/^(02)(\d{4})(\d{4})$/, '$1-$2-$3')
      : n.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3')
  return n
}
