import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ImageIcon, FileText } from 'lucide-react'
import { api } from '../lib/api'

/**
 * 상담사 신청 내역 — 사용자 가입 페이지에서 들어온 신청을 관리자에 노출.
 *
 *  - 사용자 측: web/user/src/pages/CounselorApplyNew.tsx → POST /api/user/counselor-apply
 *  - 백엔드:   api/src/admin/counselor-apply/counselor-apply.{controller,service}.ts
 *  - status:  pending(검토중) / accepted(승인) / rejected(반려) / cancelled(취소)
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

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '검토중' },
  { value: 'accepted', label: '승인' },
  { value: 'rejected', label: '반려' },
  { value: 'cancelled', label: '취소' },
  { value: 'superseded', label: '대체됨' },
]

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  accepted: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  rejected: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  superseded: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

const STATUS_LABEL: Record<string, string> = {
  pending: '검토중',
  accepted: '승인',
  rejected: '반려',
  cancelled: '취소',
  superseded: '대체됨',
}

const PAGE_SIZE = 20

export default function CounselorApplyList() {
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const [pendingQ, setPendingQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (status && status !== 'all') params.set('status', status)
    if (q) params.set('q', q)
    params.set('page', String(page))
    params.set('limit', String(PAGE_SIZE))

    setLoading(true)
    setError(null)
    api<Resp>(`/admin/counselor-apply?${params}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : '조회 실패'))
      .finally(() => setLoading(false))
  }, [status, q, page])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">상담사 신청 내역</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          사용자 가입 페이지에서 접수된 상담사 신청 — 사진/사업자 파일 확인 후 상담사로 등록하세요.
        </p>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setStatus(f.value)
                setPage(1)
              }}
              className={`px-3 py-1.5 rounded-md text-xs border transition ${
                status === f.value
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <form
          className="flex items-center gap-2 ml-auto"
          onSubmit={(e) => {
            e.preventDefault()
            setQ(pendingQ.trim())
            setPage(1)
          }}
        >
          <input
            type="text"
            value={pendingQ}
            onChange={(e) => setPendingQ(e.target.value)}
            placeholder="휴대폰/이메일/예명/실명/제목"
            className="w-64 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-md bg-brand-500 hover:bg-brand-600 text-white"
          >
            <Search className="w-3.5 h-3.5" />
            검색
          </button>
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ('')
                setPendingQ('')
                setPage(1)
              }}
              className="px-3 py-2 text-xs rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              초기화
            </button>
          )}
        </form>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* 목록 테이블 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/40 text-gray-600 dark:text-gray-300 text-xs">
              <tr>
                <th className="px-4 py-2 text-left font-medium">번호</th>
                <th className="px-4 py-2 text-left font-medium">상태</th>
                <th className="px-4 py-2 text-left font-medium">예명 / 실명</th>
                <th className="px-4 py-2 text-left font-medium">분야 / 지역</th>
                <th className="px-4 py-2 text-left font-medium">휴대폰</th>
                <th className="px-4 py-2 text-left font-medium">이메일</th>
                <th className="px-4 py-2 text-left font-medium">회원</th>
                <th className="px-4 py-2 text-left font-medium">첨부</th>
                <th className="px-4 py-2 text-left font-medium">신청일시</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                    로딩 중…
                  </td>
                </tr>
              )}
              {!loading && data && data.items.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                    신청 내역이 없습니다.
                  </td>
                </tr>
              )}
              {!loading &&
                data?.items.map((it) => (
                  <tr key={it.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{it.id}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                          STATUS_BADGE[it.status] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {STATUS_LABEL[it.status] ?? it.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-800 dark:text-gray-100">
                      <div className="font-medium">{it.pen_name ?? '-'}</div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">{it.real_name ?? '-'}</div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                      <div>{it.field ?? '-'}</div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">{it.region ?? '-'}</div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 font-mono text-xs">
                      {it.applicant_phone ?? '-'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 text-xs">
                      {it.applicant_email ?? '-'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 text-xs">
                      {it.member_id ? (
                        <Link
                          to={`/members/customers/${it.member_id}`}
                          className="text-brand-600 hover:underline"
                        >
                          {it.member_mb_id ?? it.member_name ?? `#${it.member_id}`}
                        </Link>
                      ) : (
                        <span className="text-gray-400">비회원</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                        <span className={`inline-flex items-center gap-0.5 ${it.has_profile_photo ? '' : 'text-gray-300 dark:text-gray-600'}`} title="프로필 사진">
                          <ImageIcon className="w-3.5 h-3.5" />
                          P
                        </span>
                        <span className={`inline-flex items-center gap-0.5 ${it.has_wide_photo ? '' : 'text-gray-300 dark:text-gray-600'}`} title="와이드 사진">
                          <ImageIcon className="w-3.5 h-3.5" />
                          W
                        </span>
                        <span className={`inline-flex items-center gap-0.5 ${it.contract_count > 0 ? '' : 'text-gray-300 dark:text-gray-600'}`} title="사업자/계약서">
                          <FileText className="w-3.5 h-3.5" />
                          {it.contract_count}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap">
                      {formatDate(it.created_at)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        to={`/members/counselor-apply/${it.id}`}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        상세
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 + 총 건수 */}
        {data && data.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
            <div>
              총 <span className="font-medium text-gray-800 dark:text-gray-100">{data.total.toLocaleString()}</span>건 · {page} / {totalPages} 페이지
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                이전
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
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

function formatDate(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
}
