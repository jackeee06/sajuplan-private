import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
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
} from '../components/table'

/**
 * 어드민 — 후기 신고 관리 (2026-05-15 신설).
 *  - 목록 (status 필터: 전체/대기/검토완료/숨김/반려)
 *  - row 클릭 → 상세 모달에서 후기 본문 + 신고자 + 처리
 *  - 처리: status 변경 + admin_memo 저장
 */

interface ReportListItem {
  id: number
  review_id: number
  reporter_member_id: number
  reason_category: string
  reason: string | null
  status: string
  admin_memo: string | null
  created_at: string
  resolved_at: string | null
  review_title: string | null
  reporter_nickname: string | null
  reporter_mb_id: string | null
}

interface ReportDetail extends ReportListItem {
  resolved_by: number | null
  review_content: string | null
  review_member_id: number | null
  review_member_nickname: string | null
  review_member_mb_id: string | null
}

const STATUS_LABELS: Record<string, { label: string; color: BadgeColor }> = {
  pending: { label: '대기', color: 'amber' },
  reviewed: { label: '검토 완료', color: 'blue' },
  hidden: { label: '숨김', color: 'rose' },
  dismissed: { label: '반려', color: 'gray' },
}

const FILTER_DOT: Record<string, BadgeColor | undefined> = {
  pending: 'amber',
  all: undefined,
  reviewed: 'blue',
  hidden: 'rose',
  dismissed: 'gray',
}

const CATEGORY_LABELS: Record<string, string> = {
  abuse: '욕설·비방',
  false: '허위 사실',
  ad: '광고·스팸',
  privacy: '개인정보 노출',
  other: '기타',
}

const STATUS_FILTERS = [
  { value: 'pending', label: '대기' },
  { value: 'all', label: '전체' },
  { value: 'reviewed', label: '검토 완료' },
  { value: 'hidden', label: '숨김' },
  { value: 'dismissed', label: '반려' },
]

export default function ReviewReports() {
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ items: ReportListItem[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    api<{ items: ReportListItem[]; total: number }>(
      `/admin/review-reports?status=${encodeURIComponent(statusFilter)}&page=${page}&limit=30`,
    )
      .then((r) => setData(r))
      .catch((e) => setError(e instanceof ApiError ? e.message : '불러오기 실패'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [statusFilter, page])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 30)) : 1

  return (
    <div className="space-y-3 max-w-[1100px]">
      {/* 타이틀 */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">후기 신고 관리</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">사용자가 신고한 후기 목록 — 검토 후 처리 (숨김/반려)</p>
      </div>

      {/* 필터 칩 */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Chip
            key={f.value}
            label={f.label}
            dotColor={FILTER_DOT[f.value]}
            active={statusFilter === f.value}
            onClick={() => {
              setStatusFilter(f.value)
              setPage(1)
            }}
          />
        ))}
      </div>

      {/* 테이블 */}
      <TableShell>
        <THead>
          <Th align="right">ID</Th>
          <Th align="left">신고일</Th>
          <Th align="left">사유</Th>
          <Th align="left">후기 제목</Th>
          <Th align="left">신고자</Th>
          <Th align="center">상태</Th>
        </THead>
        <TBody>
          {loading && !data ? (
            <EmptyRow colSpan={6} loading />
          ) : error ? (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-rose-500">{error}</td></tr>
          ) : !data || data.items.length === 0 ? (
            <EmptyRow colSpan={6} />
          ) : (
            data.items.map((r) => {
              const st = STATUS_LABELS[r.status] ?? { label: r.status, color: 'gray' as BadgeColor }
              return (
                <Tr key={r.id} onClick={() => setSelectedId(r.id)}>
                  <IdCell id={r.id} />
                  <Td align="left" className="text-xs text-gray-600 tabular-nums">
                    {new Date(r.created_at).toLocaleString('ko-KR')}
                  </Td>
                  <Td align="left" className="text-gray-700">{CATEGORY_LABELS[r.reason_category] ?? r.reason_category}</Td>
                  <Td align="left" className="max-w-[400px] truncate">
                    {r.review_title ?? <span className="text-gray-400">(삭제됨)</span>}
                  </Td>
                  <Td align="left" className="text-gray-700">
                    {r.reporter_nickname || r.reporter_mb_id || `#${r.reporter_member_id}`}
                  </Td>
                  <Td align="center">
                    <Badge color={st.color}>{st.label}</Badge>
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
          pageSize={30}
          onChange={setPage}
          unit="건"
        />
      )}

      {/* 상세 모달 */}
      {selectedId !== null && (
        <ReportDetailModal
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={() => {
            setSelectedId(null)
            load()
          }}
        />
      )}
    </div>
  )
}

/* ───────────── 상세 + 처리 모달 ───────────── */

function ReportDetailModal({ id, onClose, onUpdated }: { id: number; onClose: () => void; onUpdated: () => void }) {
  const [detail, setDetail] = useState<ReportDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('reviewed')
  const [adminMemo, setAdminMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    api<ReportDetail>(`/admin/review-reports/${id}`)
      .then((r) => {
        setDetail(r)
        setStatus(r.status === 'pending' ? 'reviewed' : r.status)
        setAdminMemo(r.admin_memo ?? '')
      })
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : '불러오기 실패'))
  }, [id])

  const submit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await api<ReportDetail>(`/admin/review-reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, admin_memo: adminMemo || null }),
      })
      onUpdated()
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : '처리 실패')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <header className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900">
          <h2 className="text-lg font-semibold">신고 상세 — #{id}</h2>
          <button type="button" onClick={onClose} className="text-2xl text-gray-400 hover:text-gray-600 leading-none">×</button>
        </header>

        <div className="px-5 py-4 space-y-4">
          {loadError ? (
            <p className="text-sm text-rose-500">{loadError}</p>
          ) : !detail ? (
            <p className="text-sm text-gray-500">로딩...</p>
          ) : (
            <>
              {/* 신고 정보 */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">신고 정보</h3>
                <dl className="text-sm grid grid-cols-[120px_1fr] gap-y-1.5">
                  <dt className="text-gray-500">신고일</dt><dd>{new Date(detail.created_at).toLocaleString('ko-KR')}</dd>
                  <dt className="text-gray-500">사유 카테고리</dt><dd>{CATEGORY_LABELS[detail.reason_category] ?? detail.reason_category}</dd>
                  <dt className="text-gray-500">상세 사유</dt><dd className="whitespace-pre-wrap">{detail.reason || <span className="text-gray-400">(없음)</span>}</dd>
                  <dt className="text-gray-500">신고자</dt><dd>{detail.reporter_nickname || detail.reporter_mb_id || `#${detail.reporter_member_id}`}</dd>
                </dl>
              </section>

              {/* 후기 본문 */}
              <section className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">신고 대상 후기</h3>
                {detail.review_title === null ? (
                  <p className="text-sm text-gray-400">(후기가 삭제되었습니다.)</p>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <p className="font-semibold mb-1">{detail.review_title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{detail.review_content || <span className="text-gray-400">(본문 없음)</span>}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      작성자: {detail.review_member_nickname || detail.review_member_mb_id || `#${detail.review_member_id}`}
                      {' · '}
                      <a href={`/mng/posts/review/${detail.review_id}`} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">후기 원본 보기 ↗</a>
                    </p>
                  </div>
                )}
              </section>

              {/* 처리 */}
              <section className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">처리</h3>
                <div className="flex flex-col gap-2">
                  <label className="text-sm">
                    <span className="block mb-1 text-gray-500">상태</span>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full max-w-xs px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                    >
                      <option value="pending">대기 (보류)</option>
                      <option value="reviewed">검토 완료 — 후기 유지</option>
                      <option value="hidden">숨김 — 후기 비공개 처리 필요</option>
                      <option value="dismissed">반려 — 무효 신고</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="block mb-1 text-gray-500">처리 메모 (선택)</span>
                    <textarea
                      value={adminMemo}
                      onChange={(e) => setAdminMemo(e.target.value)}
                      rows={3}
                      placeholder="처리 사유, 후속 조치 메모 등"
                      className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm resize-none"
                    />
                  </label>
                  {status === 'hidden' && (
                    <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded p-2">
                      ⚠ '숨김' 처리는 신고 상태만 변경합니다. <strong>후기 실제 삭제는 후기 원본 페이지에서 별도로 진행</strong>해 주세요.
                    </p>
                  )}
                  {submitError && <p className="text-sm text-rose-500">{submitError}</p>}
                </div>
              </section>
            </>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2 sticky bottom-0 bg-white dark:bg-gray-900">
          <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50">닫기</button>
          <button type="button" onClick={submit} disabled={submitting || !detail} className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50">{submitting ? '저장 중...' : '저장'}</button>
        </footer>
      </div>
    </div>
  )
}
