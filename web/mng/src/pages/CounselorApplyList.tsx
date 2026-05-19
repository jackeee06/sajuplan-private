import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, ImageIcon, FileText } from 'lucide-react'
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
  Badge,
  BadgeColor,
  PaginationBar,
  ResultCount,
  inputCls,
  fmtDate,
} from '../components/table'

/**
 * 상담사 신청 내역 — 사용자 가입 페이지에서 들어온 신청을 관리자에 노출.
 *
 *  - 사용자 측: web/user/src/pages/CounselorApplyNew.tsx → POST /api/user/counselor-apply
 *  - 백엔드:   api/src/admin/counselor-apply/counselor-apply.{controller,service}.ts
 *  - status:  pending(검토중) / accepted(승인) / rejected(반려) / cancelled(취소) / superseded(대체됨)
 */

interface ApplyItem {
  id: number
  status: string
  category: string | null
  title: string
  applicant_phone: string | null
  applicant_email: string | null
  member_id: number | null
  member_mb_id: string | null
  member_name: string | null
  real_name: string | null
  pen_name: string | null
  field: string | null
  region: string | null
  has_profile_photo: boolean
  has_wide_photo: boolean
  contract_count: number
  created_at: string
}

interface Resp {
  items: ApplyItem[]
  total: number
  page: number
  limit: number
}

type StatusValue = 'all' | 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'superseded'
type CategoryValue = 'all' | 'application' | 'inquiry' | 'other'

const STATUS_FILTERS: Array<{ value: StatusValue; label: string; dot?: BadgeColor }> = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '검토중', dot: 'amber' },
  { value: 'accepted', label: '승인', dot: 'emerald' },
  { value: 'rejected', label: '반려', dot: 'rose' },
  { value: 'cancelled', label: '취소', dot: 'gray' },
  { value: 'superseded', label: '대체됨', dot: 'gray' },
]

const STATUS_BADGE_COLOR: Record<string, BadgeColor> = {
  pending: 'amber',
  accepted: 'emerald',
  rejected: 'rose',
  cancelled: 'gray',
  superseded: 'gray',
}

const STATUS_LABEL: Record<string, string> = {
  pending: '검토중',
  accepted: '승인',
  rejected: '반려',
  cancelled: '취소',
  superseded: '대체됨',
}

const CATEGORY_FILTERS: Array<{ value: CategoryValue; label: string; dot?: BadgeColor }> = [
  { value: 'all', label: '전체' },
  { value: 'application', label: '상담사 지원', dot: 'indigo' },
  { value: 'inquiry', label: '상담사 문의', dot: 'blue' },
  { value: 'other', label: '기타 문의', dot: 'gray' },
]

const CATEGORY_LABEL: Record<string, string> = {
  application: '지원',
  general: '지원',
  inquiry: '문의',
  other: '기타',
}

const CATEGORY_BADGE_COLOR: Record<string, BadgeColor> = {
  application: 'indigo',
  general: 'indigo',
  inquiry: 'blue',
  other: 'gray',
}

const PAGE_SIZE = 20

export default function CounselorApplyList() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<StatusValue>('all')
  const [category, setCategory] = useState<CategoryValue>('all')
  const [q, setQ] = useState('')
  const [pendingQ, setPendingQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (status && status !== 'all') params.set('status', status)
    if (category && category !== 'all') params.set('category', category)
    if (q) params.set('q', q)
    params.set('page', String(page))
    params.set('limit', String(PAGE_SIZE))

    setLoading(true)
    setError(null)
    api<Resp>(`/admin/counselor-apply?${params}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : '조회 실패'))
      .finally(() => setLoading(false))
  }, [status, category, q, page])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setQ(pendingQ.trim())
    setPage(1)
  }
  const onReset = () => {
    setQ('')
    setPendingQ('')
    setStatus('all')
    setCategory('all')
    setPage(1)
  }

  return (
    <div className="space-y-3">
      {/* 타이틀 */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">상담사 신청 내역</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          사용자 가입 페이지에서 접수된 상담사 신청 — 사진/사업자 파일 확인 후 상담사로 등록하세요.
        </p>
      </div>

      {/* 상태 칩 */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500 mr-1">상태</span>
        {STATUS_FILTERS.map((f) => (
          <Chip
            key={f.value}
            label={f.label}
            dotColor={f.dot}
            active={status === f.value}
            onClick={() => {
              setStatus(f.value)
              setPage(1)
            }}
          />
        ))}
      </div>

      {/* 종류 칩 */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500 mr-1">종류</span>
        {CATEGORY_FILTERS.map((f) => (
          <Chip
            key={f.value}
            label={f.label}
            dotColor={f.dot}
            active={category === f.value}
            onClick={() => {
              setCategory(f.value)
              setPage(1)
            }}
          />
        ))}
      </div>

      {/* 검색 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 w-fit max-w-full">
        <form className="flex flex-wrap gap-3 items-end" onSubmit={onSearch}>
          <div className="w-[260px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">검색</label>
            <input
              type="text"
              value={pendingQ}
              onChange={(e) => setPendingQ(e.target.value)}
              placeholder="휴대폰 / 이메일 / 예명 / 실명 / 제목"
              className={inputCls}
            />
          </div>
          <div className="flex gap-2 ml-auto">
            <button
              type="submit"
              className="px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white inline-flex items-center gap-1.5 font-medium"
            >
              <Search className="w-4 h-4" /> 검색
            </button>
            <button
              type="button"
              onClick={onReset}
              className="px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              초기화
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* 결과 카운트 */}
      {data && !loading && <ResultCount total={data.total} unit="건" />}

      {/* 목록 테이블 */}
      <TableShell>
        <THead>
          <Th align="right">번호</Th>
          <Th align="center">종류</Th>
          <Th align="center">상태</Th>
          <Th align="left">예명 / 실명</Th>
          <Th align="left">분야 / 지역</Th>
          <Th align="left">휴대폰</Th>
          <Th align="left">이메일</Th>
          <Th align="left">회원</Th>
          <Th align="center">첨부</Th>
          <Th align="left">신청일시</Th>
        </THead>
        <TBody>
          {loading ? (
            <EmptyRow colSpan={10} loading />
          ) : !data || data.items.length === 0 ? (
            <EmptyRow colSpan={10} />
          ) : (
            data.items.map((it) => {
              const catKey = it.category && it.category !== 'general' ? it.category : 'application'
              return (
                <Tr key={it.id} onClick={() => navigate(`/members/counselor-apply/${it.id}`)}>
                  <IdCell id={it.id} />
                  <Td align="center">
                    <Badge color={CATEGORY_BADGE_COLOR[catKey] ?? 'gray'}>
                      {CATEGORY_LABEL[catKey] ?? catKey}
                    </Badge>
                  </Td>
                  <Td align="center">
                    <Badge color={STATUS_BADGE_COLOR[it.status] ?? 'gray'}>
                      {STATUS_LABEL[it.status] ?? it.status}
                    </Badge>
                  </Td>
                  <Td align="left">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {it.pen_name ?? '-'}
                    </div>
                    <div className="text-[11px] text-gray-500">{it.real_name ?? '-'}</div>
                  </Td>
                  <Td align="left" className="text-xs">
                    <div className="text-gray-700">{it.field ?? '-'}</div>
                    <div className="text-[11px] text-gray-500">{it.region ?? '-'}</div>
                  </Td>
                  <Td align="left" className="font-mono text-xs text-gray-600">
                    {it.applicant_phone ?? <span className="text-gray-300">-</span>}
                  </Td>
                  <Td align="left" className="text-xs text-gray-600">
                    {it.applicant_email ?? <span className="text-gray-300">-</span>}
                  </Td>
                  <Td align="left" className="text-xs">
                    {it.member_id ? (
                      <Link
                        to={`/members/customers/${it.member_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-brand-600 hover:underline"
                      >
                        {it.member_mb_id ?? it.member_name ?? `#${it.member_id}`}
                      </Link>
                    ) : (
                      <span className="text-gray-400">비회원</span>
                    )}
                  </Td>
                  <Td align="center">
                    <div className="inline-flex items-center gap-2 text-xs text-gray-600">
                      <span
                        className={`inline-flex items-center gap-0.5 ${
                          it.has_profile_photo ? '' : 'text-gray-300'
                        }`}
                        title="프로필 사진"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />P
                      </span>
                      <span
                        className={`inline-flex items-center gap-0.5 ${
                          it.has_wide_photo ? '' : 'text-gray-300'
                        }`}
                        title="와이드 사진"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />W
                      </span>
                      <span
                        className={`inline-flex items-center gap-0.5 ${
                          it.contract_count > 0 ? '' : 'text-gray-300'
                        }`}
                        title="사업자/계약서"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {it.contract_count}
                      </span>
                    </div>
                  </Td>
                  <Td align="left" className="text-xs text-gray-500 tabular-nums">
                    {fmtDate(it.created_at)}
                  </Td>
                </Tr>
              )
            })
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
          unit="건"
        />
      )}
    </div>
  )
}
