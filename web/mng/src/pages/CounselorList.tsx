import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { api } from '../lib/api'
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
  NumCell,
  Badge,
  BadgeColor,
  PaginationBar,
  ResultCount,
  inputCls,
  num,
  fmtDate,
  fmtPhone,
  secsToMin,
} from '../components/table'

interface Counselor {
  id: number
  mb_id: string | null
  name: string
  nickname: string
  phone: string | null
  csrid: string | null
  dtmfno: string | null
  telno: string | null
  counselor_category: string | null
  counselor_priority: number | null
  call_070_unit_cost: number | null
  call_060_unit_cost: number | null
  chat_unit_cost: number | null
  paid_royalty_pct: number | null
  level: number
  point: number
  state: string
  is_rising: boolean
  created_at: string
  total_consult: string
  total_usetm: string
  this_month_070: string
  this_month_060: string
  last_month_070: string
  last_month_060: string
}

interface Resp {
  items: Counselor[]
  total: number
  summary: { total: number; idle: number; busy: number; absent: number }
  by_category: Record<string, number>
}

interface Filter {
  q: string
  fr_date: string
  to_date: string
  state: string
  category: string
  page: number
}

const PAGE_SIZE = Number(import.meta.env.VITE_LIST_PAGE_SIZE ?? 10)
const CATEGORIES = ['타로', '신점', '사주', '심리'] as const

// 분야별 데이터 셀(Badge) 색
const CATEGORY_BADGE: Record<string, BadgeColor> = {
  타로: 'indigo',
  신점: 'rose',
  사주: 'amber',
  심리: 'teal',
}
// 분야별 칩 dot 색 (active 시는 모두 brand 보라 / 비활성 시 카테고리 색을 좌측 점으로)
const CATEGORY_DOT: Record<string, 'indigo' | 'rose' | 'amber' | 'teal'> = {
  타로: 'indigo',
  신점: 'rose',
  사주: 'amber',
  심리: 'teal',
}

const STATE_LABELS: Record<string, { label: string; color: BadgeColor }> = {
  IDLE: { label: '상담대기', color: 'emerald' },
  RDCH: { label: '채팅대기', color: 'emerald' },
  RDVC: { label: '예약대기', color: 'emerald' },
  CRDY: { label: '준비', color: 'emerald' },
  CONN: { label: '상담중', color: 'amber' },
  CNCH: { label: '채팅중', color: 'amber' },
  RESV: { label: '예약중', color: 'amber' },
  ABSE: { label: '부재중', color: 'gray' },
}

export default function CounselorList() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>({
    q: '',
    fr_date: '',
    to_date: '',
    state: '',
    category: '',
    page: 1,
  })
  const [pending, setPending] = useState<Pick<Filter, 'q' | 'fr_date' | 'to_date'>>({
    q: '',
    fr_date: '',
    to_date: '',
  })
  const [data, setData] = useState<Resp | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams()
    if (filter.q) params.set('q', filter.q)
    if (filter.fr_date) params.set('fr_date', filter.fr_date)
    if (filter.to_date) params.set('to_date', filter.to_date)
    if (filter.state) params.set('state', filter.state)
    if (filter.category) params.set('category', filter.category)
    params.set('page', String(filter.page))
    params.set('limit', String(PAGE_SIZE))

    setLoading(true)
    api<Resp>(`/admin/members/counselors?${params}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [filter])

  const onSearch = () => setFilter((f) => ({ ...f, ...pending, page: 1 }))
  const onReset = () => {
    setPending({ q: '', fr_date: '', to_date: '' })
    setFilter({ q: '', fr_date: '', to_date: '', state: '', category: '', page: 1 })
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-5">
      {/* 페이지 타이틀 + 추가 버튼 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">상담사 리스트</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">상담사 회원(role=counselor) 현황</p>
        </div>
        <Link
          to="/members/counselors/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium"
        >
          <Plus className="w-4 h-4" />
          상담사 추가
        </Link>
      </div>

      {/* 상태 칩 */}
      {data && (
        <div className="flex flex-wrap gap-2">
          <Chip
            label="전체"
            value={data.summary.total}
            active={!filter.state}
            onClick={() => setFilter((f) => ({ ...f, state: '', page: 1 }))}
          />
          <Chip
            label="상담가능"
            value={data.summary.idle}
            dotColor="emerald"
            active={filter.state === 'IDLE'}
            onClick={() => setFilter((f) => ({ ...f, state: 'IDLE', page: 1 }))}
          />
          <Chip
            label="상담중"
            value={data.summary.busy}
            dotColor="amber"
            active={filter.state === 'CONN'}
            onClick={() => setFilter((f) => ({ ...f, state: 'CONN', page: 1 }))}
          />
          <Chip
            label="부재"
            value={data.summary.absent}
            dotColor="gray"
            active={filter.state === 'ABSE'}
            onClick={() => setFilter((f) => ({ ...f, state: 'ABSE', page: 1 }))}
          />
        </div>
      )}

      {/* 분야 필터 */}
      {data && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-500 mr-1">분야</span>
          <Chip
            label="전체"
            value={data.summary.total}
            active={!filter.category}
            onClick={() => setFilter((f) => ({ ...f, category: '', page: 1 }))}
          />
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={c}
              value={data.by_category[c] ?? 0}
              dotColor={CATEGORY_DOT[c]}
              active={filter.category === c}
              onClick={() => setFilter((f) => ({ ...f, category: c, page: 1 }))}
            />
          ))}
          {data.by_category['미지정'] ? (
            <Chip
              label="미지정"
              value={data.by_category['미지정']}
              dotColor="gray"
              active={filter.category === '미지정'}
              onClick={() => setFilter((f) => ({ ...f, category: '미지정', page: 1 }))}
            />
          ) : null}
        </div>
      )}

      {/* 검색 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 w-fit max-w-full">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-[260px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">검색</label>
            <input
              type="text"
              value={pending.q}
              onChange={(e) => setPending((p) => ({ ...p, q: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              placeholder="아이디 / 이름 / 닉네임 / 휴대폰"
              className={inputCls}
            />
          </div>
          <div className="w-[160px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">가입 시작</label>
            <input
              type="date"
              value={pending.fr_date}
              onChange={(e) => setPending((p) => ({ ...p, fr_date: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div className="w-[160px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">가입 종료</label>
            <input
              type="date"
              value={pending.to_date}
              onChange={(e) => setPending((p) => ({ ...p, to_date: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onSearch}
              className="px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white inline-flex items-center gap-1.5 font-medium"
            >
              <Search className="w-4 h-4" /> 검색
            </button>
            <button
              onClick={onReset}
              className="px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              초기화
            </button>
          </div>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}

      {/* 결과 카운트 */}
      {data && !loading && <ResultCount total={data.total} unit="명" />}

      {/* 표 */}
      <TableShell minWidth="min-w-[1800px]">
        <THead>
          <Th align="right">번호</Th>
          <Th align="left">가입일</Th>
          <Th align="left">아이디</Th>
          <Th align="left">이름</Th>
          <Th align="left">닉네임</Th>
          <Th align="left">분야</Th>
          <Th align="left">휴대폰</Th>
          <Th align="left">상담사번호</Th>
          <Th align="left">m2net</Th>
          <Th align="left">070번호</Th>
          <Th align="right">단가(070)</Th>
          <Th align="right">단가(060)</Th>
          <Th align="right">채팅</Th>
          <Th align="right">로열티</Th>
          <Th align="right">우선순위</Th>
          <Th align="right">누적상담</Th>
          <Th align="right">누적시간</Th>
          <Th align="right">이번달(070)</Th>
          <Th align="right">이번달(060)</Th>
          <Th align="right">지난달(070)</Th>
          <Th align="right">지난달(060)</Th>
          <Th align="right">포인트</Th>
          <Th align="center">상태</Th>
          <Th align="center">급상승</Th>
        </THead>
        <TBody>
          {loading ? (
            <EmptyRow colSpan={24} loading />
          ) : !data || data.items.length === 0 ? (
            <EmptyRow colSpan={24} />
          ) : (
            data.items.map((c) => (
              <Tr key={c.id} onClick={() => navigate(`/members/counselors/${c.id}`)}>
                <IdCell id={c.id} />
                <Td align="left" className="text-xs text-gray-500 tabular-nums">
                  {fmtDate(c.created_at, { withTime: false })}
                </Td>
                <Td align="left">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{c.mb_id ?? '-'}</div>
                </Td>
                <Td align="left">{c.name}</Td>
                <Td align="left" className="text-gray-600">{c.nickname}</Td>
                <Td align="left">
                  {c.counselor_category ? (
                    <Badge color={CATEGORY_BADGE[c.counselor_category] ?? 'gray'}>
                      {c.counselor_category}
                    </Badge>
                  ) : (
                    <span className="text-xs text-gray-300">-</span>
                  )}
                </Td>
                <Td align="left" className="font-mono text-xs text-gray-600">
                  {fmtPhone(c.phone)}
                </Td>
                <Td align="left" className="font-mono text-xs text-gray-600">
                  {c.dtmfno ?? <span className="text-gray-300">-</span>}
                </Td>
                <Td align="left" className="font-mono text-xs text-gray-600">
                  {c.csrid ?? <span className="text-gray-300">-</span>}
                </Td>
                <Td align="left" className="font-mono text-xs text-gray-600">
                  {fmtPhone(c.telno)}
                </Td>
                <Td align="right"><NumCell value={c.call_070_unit_cost} /></Td>
                <Td align="right"><NumCell value={c.call_060_unit_cost} /></Td>
                <Td align="right"><NumCell value={c.chat_unit_cost} /></Td>
                <Td align="right" className="text-xs tabular-nums text-gray-600">
                  {c.paid_royalty_pct !== null ? `${c.paid_royalty_pct}%` : <span className="text-gray-300">-</span>}
                </Td>
                <Td align="right" className="text-xs tabular-nums text-gray-600">
                  {c.counselor_priority ?? <span className="text-gray-300">-</span>}
                </Td>
                <Td align="right"><NumCell value={c.total_consult} /></Td>
                <Td align="right" className="text-xs tabular-nums text-gray-600">
                  {secsToMin(c.total_usetm)}
                </Td>
                <Td align="right"><NumCell value={c.this_month_070} /></Td>
                <Td align="right"><NumCell value={c.this_month_060} /></Td>
                <Td align="right"><NumCell value={c.last_month_070} /></Td>
                <Td align="right"><NumCell value={c.last_month_060} /></Td>
                <Td align="right"><NumCell value={c.point} bold /></Td>
                <Td align="center"><StateBadge state={c.state} /></Td>
                <Td align="center">{c.is_rising ? <Badge color="rose">급상승</Badge> : <span className="text-gray-300">-</span>}</Td>
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
          unit="명"
        />
      )}
    </div>
  )
}

function StateBadge({ state }: { state: string }) {
  const meta = STATE_LABELS[state] ?? { label: state || '-', color: 'gray' as BadgeColor }
  return <Badge color={meta.color}>{meta.label}</Badge>
}
