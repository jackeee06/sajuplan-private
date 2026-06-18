import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, UserPlus } from 'lucide-react'
import { api } from '../lib/api'
import {
  TableShell, THead, TBody, Tr, Th, Td, IdCell, NumCell, EmptyRow,
  PaginationBar, ResultCount, Badge, Chip, fmtDate, fmtPhone, inputCls,
} from '../components/table'

type PromoterStatus = 'pending' | 'active' | 'rejected'

interface PromoterRow {
  id: number
  name: string
  phone: string | null
  code: string
  is_active: boolean
  status: PromoterStatus
  created_at: string
  has_rrn: boolean
  recruit_count: number | string
  expected: number | string
  paid_total: number | string
}

/** status 뱃지 — pending=대기(주황) / active=활성(초록) / rejected=반려(회색) */
function StatusBadge({ status }: { status: PromoterStatus }) {
  if (status === 'pending') return <Badge color="amber">승인 대기</Badge>
  if (status === 'rejected') return <Badge color="gray">반려</Badge>
  return <Badge color="emerald">활성</Badge>
}

const STATUS_FILTERS: { key: '' | PromoterStatus; label: string }[] = [
  { key: '', label: '전체' },
  { key: 'pending', label: '승인 대기' },
  { key: 'active', label: '활성' },
  { key: 'rejected', label: '반려' },
]

interface Resp {
  items: PromoterRow[]
  total: number
  page: number
  limit: number
}

const PAGE_SIZE = Number(import.meta.env.VITE_LIST_PAGE_SIZE ?? 10)

export default function PromoterList() {
  const navigate = useNavigate()
  const [stx, setStx] = useState('')
  const [pendingStx, setPendingStx] = useState('')
  const [status, setStatus] = useState<'' | PromoterStatus>('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Resp | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams()
    if (stx) params.set('stx', stx)
    if (status) params.set('status', status)
    params.set('page', String(page))
    params.set('limit', String(PAGE_SIZE))

    setLoading(true)
    api<Resp>(`/admin/promoters?${params}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [stx, status, page])

  const onSearch = () => {
    setStx(pendingStx.trim())
    setPage(1)
  }
  const onReset = () => {
    setPendingStx('')
    setStx('')
    setPage(1)
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-2">
      {/* 타이틀 — 한 줄, 부제 인라인 (조밀) */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">모집인 관리(서포터즈)</h1>
        <span className="text-xs text-gray-500 dark:text-gray-400">신규 회원을 데려온 모집인(서포터즈) 현황·보상 정산</span>
      </div>

      {/* 툴바 — 등록 + 검색 + 상태필터를 한 줄에 (좌측 정렬, 카드·여백 제거) */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => navigate('/promoters/new')}
          className="px-3 py-1.5 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white inline-flex items-center gap-1 font-medium whitespace-nowrap"
        >
          <UserPlus className="w-4 h-4" /> 모집인 등록
        </button>

        <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

        <div className="w-[200px]">
          <input
            type="text"
            value={pendingStx}
            onChange={(e) => setPendingStx(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            placeholder="이름 / 전화 / 코드"
            className={inputCls}
          />
        </div>
        <button
          onClick={onSearch}
          className="px-3 py-1.5 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white inline-flex items-center gap-1 font-medium"
        >
          <Search className="w-4 h-4" /> 검색
        </button>
        <button
          onClick={onReset}
          className="px-2.5 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          초기화
        </button>

        <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

        {STATUS_FILTERS.map((f) => (
          <Chip
            key={f.key || 'all'}
            label={f.label}
            dotColor={f.key === 'pending' ? 'amber' : f.key === 'active' ? 'emerald' : f.key === 'rejected' ? 'gray' : undefined}
            active={status === f.key}
            onClick={() => {
              setStatus(f.key)
              setPage(1)
            }}
          />
        ))}
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}

      {data && !loading && <ResultCount total={data.total} unit="명" />}

      <TableShell>
        <THead>
          <Th align="right">ID</Th>
          <Th align="left">이름</Th>
          <Th align="left">코드</Th>
          <Th align="left">전화</Th>
          <Th align="right">모집인원</Th>
          <Th align="right">기대수익(원)</Th>
          <Th align="right">정산완료(원)</Th>
          <Th align="center">상태</Th>
          <Th align="center">활성</Th>
          <Th align="center">주민번호</Th>
          <Th align="left">등록일</Th>
        </THead>
        <TBody>
          {loading || !data || data.items.length === 0 ? (
            <EmptyRow colSpan={11} loading={loading} />
          ) : (
            data.items.map((p) => (
              <Tr key={p.id} onClick={() => navigate(`/promoters/${p.id}`)}>
                <IdCell id={p.id} />
                <Td align="left" className="font-medium text-gray-900 dark:text-gray-100">{p.name}</Td>
                <Td align="left" className="font-mono text-xs text-gray-600">{p.code}</Td>
                <Td align="left" className="font-mono text-xs text-gray-600">{fmtPhone(p.phone)}</Td>
                <Td align="right"><NumCell value={p.recruit_count} /></Td>
                <Td align="right"><NumCell value={p.expected} bold /></Td>
                <Td align="right"><NumCell value={p.paid_total} /></Td>
                <Td align="center"><StatusBadge status={p.status} /></Td>
                <Td align="center">
                  {p.is_active ? <Badge color="emerald">활성</Badge> : <Badge color="gray">비활성</Badge>}
                </Td>
                <Td align="center">
                  {p.has_rrn ? (
                    <span className="text-emerald-600 font-medium">✓</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </Td>
                <Td align="left" className="text-xs text-gray-500 tabular-nums">{fmtDate(p.created_at)}</Td>
              </Tr>
            ))
          )}
        </TBody>
      </TableShell>

      {data && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={data.total}
          pageSize={PAGE_SIZE}
          onChange={setPage}
          unit="명"
        />
      )}
    </div>
  )
}
