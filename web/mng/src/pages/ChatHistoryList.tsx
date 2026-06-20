import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { api } from '../lib/api'
import { defaultLast7Days } from '../lib/dateRange'
import { DateRangeChips } from '../components/DateRangeChips'
import { DateField } from '../components/DateField'
import {
  Th,
  Td,
  Tr,
  TableShell,
  THead,
  TBody,
  EmptyRow,
  NumCell,
  PaginationBar,
  InfoBox,
  inputCls,
} from '../components/table'

interface Room {
  id: number
  roomid: string | null
  member_id: number | null
  member_mb_id: string | null
  member_name: string | null
  counselor_id: number | null
  counselor_mb_id: string | null
  counselor_name: string | null
  counselor_nickname: string | null
  status: string | null
  message_count: number
  last_message: string | null
  started_at: string | null
  ended_at: string | null
}

interface Resp {
  items: Room[]
  total: number
  page: number
  limit: number
}

const PAGE_SIZE = Number(import.meta.env.VITE_LIST_PAGE_SIZE ?? 50) // 첫 화면 50줄 (2026-06-19)

export default function ChatHistoryList() {
  const navigate = useNavigate()
  // [2026-06-02 v2] 사장님 명시: 기본 활성 = 최근 7일
  const _init30 = defaultLast7Days()
  const [filter, setFilter] = useState({ q: '', fr_date: _init30.from, to_date: _init30.to, page: 1 })
  const [pending, setPending] = useState({ q: '', fr_date: _init30.from, to_date: _init30.to })
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (filter.q) params.set('q', filter.q)
    if (filter.fr_date) params.set('fr_date', filter.fr_date)
    if (filter.to_date) params.set('to_date', filter.to_date)
    params.set('page', String(filter.page))
    params.set('limit', String(PAGE_SIZE))
    setLoading(true)
    setError(null)
    api<Resp>(`/admin/chat-history?${params}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [filter])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-2 max-w-[1100px]">
      {/* 타이틀 — 한 줄, 부제·카운트 인라인 (상담후기 관리 표준) */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">채팅내역 리스트</h1>
        <span className="text-xs text-gray-500 dark:text-gray-400">상담사-회원 채팅 룸 이력</span>
        {data && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            · 전체 <span className="text-brand-600 font-semibold tabular-nums">{data.total.toLocaleString()}</span>건
          </span>
        )}
      </div>

      {/* 운영 안내 */}
      <InfoBox
        title="📋 채팅내역 안내"
        rows={[
          { label: '대상', value: '상담사 ↔ 회원 간 채팅 상담 룸 이력 (선결제 채팅 포함)' },
          { label: '룸ID', value: '한 건의 채팅 상담을 식별하는 값 — 행을 클릭하면 대화 내용 상세로 이동' },
          { label: '검색', value: '회원 / 상담사 / 룸ID 로 검색, 기간(시작일)으로 필터' },
        ]}
      />

      {/* 툴바 — 검색 + 기간 + 날짜칩 한 줄 (카드·여백 제거, 상담후기 표준) */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="w-[200px]">
          <input
            type="text"
            value={pending.q}
            onChange={(e) => setPending({ ...pending, q: e.target.value })}
            placeholder="회원 / 상담사 / 룸ID"
            className={inputCls}
            onKeyDown={(e) => e.key === 'Enter' && setFilter({ ...filter, ...pending, page: 1 })}
          />
        </div>
        <DateField value={pending.fr_date} onChange={(v) => setPending({ ...pending, fr_date: v })} placeholder="시작일" />
        <DateField value={pending.to_date} onChange={(v) => setPending({ ...pending, to_date: v })} placeholder="종료일" />
        <button
          onClick={() => setFilter({ ...filter, ...pending, page: 1 })}
          className="px-3 py-1.5 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white inline-flex items-center gap-1 font-medium"
        >
          <Search className="w-4 h-4" /> 검색
        </button>
        <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
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

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}

      {/* 테이블 */}
      <TableShell>
        <THead>
          <Th align="left">시작일시</Th>
          <Th align="left">회원</Th>
          <Th align="left">상담사</Th>
          <Th align="left">룸 토큰</Th>
          <Th align="right">메시지수</Th>
          <Th align="left">마지막 메시지</Th>
        </THead>
        <TBody>
          {loading && !data ? (
            <EmptyRow colSpan={6} loading />
          ) : !data || data.items.length === 0 ? (
            <EmptyRow colSpan={6} />
          ) : (
            data.items.map((r) => (
              <Tr key={r.id} onClick={() => navigate(`/chat-history/${r.id}`)}>
                <Td align="left" className="text-xs text-gray-600 tabular-nums">
                  {formatDT(r.started_at)}
                </Td>
                <Td align="left">
                  {r.member_id && r.member_mb_id ? (
                    <Link
                      to={`/members/customers/${r.member_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-brand-600 hover:underline font-medium inline-block max-w-[150px] truncate align-bottom"
                      title={String(r.member_mb_id ?? '')}
                    >
                      {r.member_mb_id}
                    </Link>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </Td>
                <Td align="left">
                  {r.counselor_id ? (
                    <Link
                      to={`/members/counselors/${r.counselor_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-brand-600 hover:underline font-medium inline-block max-w-[150px] truncate align-bottom"
                      title={String(r.counselor_nickname || r.counselor_mb_id || '')}
                    >
                      {r.counselor_nickname || r.counselor_mb_id || `#${r.counselor_id}`}
                    </Link>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </Td>
                <Td align="left" className="font-mono text-[10px] text-gray-500">
                  {r.roomid || <span className="text-gray-300">-</span>}
                </Td>
                <Td align="right"><NumCell value={r.message_count} bold /></Td>
                <Td align="left" className="max-w-[300px] truncate text-gray-500">
                  {r.last_message || <span className="text-gray-300">-</span>}
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
          unit="건"
        />
      )}
    </div>
  )
}

function formatDT(s: string | null): string {
  if (!s) return '-'
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
