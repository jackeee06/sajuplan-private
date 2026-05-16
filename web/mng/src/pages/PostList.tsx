import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Search, Trash2 } from 'lucide-react'
import { api } from '../lib/api'

/**
 * 통합 게시판 리스트 (slug 기반).
 *
 * sample/adm/admin.menu350.php 게시판 메뉴:
 *   review        → 상담후기 관리
 *   wish          → 소원다락방
 *   wish_event    → 소원다락방 EVENT
 *   qa            → 상담문의
 *   qa_counselor  → 1:1문의(상담사)
 */

interface AdminReply {
  content: string
  replied_at: string
  replied_by: string
  replied_by_id: number
}

interface Post {
  id: number
  wr_id: number | null
  member_id: number | null
  mb_id: string | null
  member_name: string | null
  member_nickname: string | null
  title: string
  content: string | null
  category: string | null
  view_count: number
  like_count: number
  dislike_count: number
  is_secret: boolean
  has_file: boolean
  rating?: number | null
  counselor_id?: number | null
  counselor_name?: string | null
  /** 후기 신고 누적 (review slug 응답에만 포함, 2026-05-15) */
  report_count?: number
  report_pending_count?: number
  /** 어드민 답변 (qa / qa_counselor 만, Phase 12) */
  extras?: { admin_reply?: AdminReply }
  created_at: string
}

interface Resp { items: Post[]; total: number; page: number; limit: number }

const SLUG_INFO: Record<string, { title: string; desc: string }> = {
  review: { title: '상담후기 관리', desc: '회원이 작성한 상담사 후기' },
  wish: { title: '소원다락방', desc: '회원이 등록한 소원' },
  wish_event: { title: '소원다락방 EVENT', desc: '소원다락방 이벤트 게시글' },
  qa: { title: '상담문의', desc: '일반 상담 관련 문의' },
  qa_counselor: { title: '1:1문의(상담사)', desc: '상담사가 등록한 1:1문의' },
}

const PAGE_SIZE = 20

export default function PostList() {
  const { slug = 'review' } = useParams<{ slug: string }>()
  const info = SLUG_INFO[slug] ?? { title: '게시판', desc: '' }

  const [filter, setFilter] = useState({ q: '', fr_date: '', to_date: '', page: 1 })
  const [pending, setPending] = useState({ q: '', fr_date: '', to_date: '' })
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  // CS 답변 모달 (Phase 12 — qa, qa_counselor 만)
  const [replyPost, setReplyPost] = useState<Post | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [replySubmitting, setReplySubmitting] = useState(false)
  const isQa = slug === 'qa' || slug === 'qa_counselor'

  const openReply = (p: Post) => {
    setReplyPost(p)
    setReplyContent(p.extras?.admin_reply?.content ?? '')
  }

  const submitReply = async () => {
    if (!replyPost || !replyContent.trim()) return
    setReplySubmitting(true)
    try {
      await api(`/admin/posts/${slug}/${replyPost.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ content: replyContent.trim() }),
      })
      setReplyPost(null)
      setSuccess(replyPost.extras?.admin_reply ? '답변 수정 완료' : '답변 등록 완료')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '답변 저장 실패')
    } finally {
      setReplySubmitting(false)
    }
  }

  const deleteReply = async () => {
    if (!replyPost) return
    if (!confirm('답변을 삭제하시겠습니까?')) return
    setReplySubmitting(true)
    try {
      await api(`/admin/posts/${slug}/${replyPost.id}/reply`, { method: 'DELETE' })
      setReplyPost(null)
      setSuccess('답변 삭제 완료')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '답변 삭제 실패')
    } finally {
      setReplySubmitting(false)
    }
  }

  // slug 변경 시 검색 초기화
  useEffect(() => {
    setFilter({ q: '', fr_date: '', to_date: '', page: 1 })
    setPending({ q: '', fr_date: '', to_date: '' })
  }, [slug])

  const load = () => {
    const params = new URLSearchParams()
    if (filter.q) params.set('q', filter.q)
    if (filter.fr_date) params.set('fr_date', filter.fr_date)
    if (filter.to_date) params.set('to_date', filter.to_date)
    params.set('page', String(filter.page))
    params.set('limit', String(PAGE_SIZE))
    setLoading(true); setError(null)
    api<Resp>(`/admin/posts/${slug}?${params}`).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }
  useEffect(load, [slug, filter])

  const onDelete = async (p: Post) => {
    if (!confirm(`"${p.title}"를 삭제하시겠습니까?`)) return
    try {
      await api(`/admin/posts/${slug}/${p.id}`, { method: 'DELETE' })
      setSuccess('삭제 완료')
      load()
    } catch (e) { setError(e instanceof Error ? e.message : '삭제 실패') }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{info.title}</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{info.desc}</p>
      </div>

      {data && (
        <div className="text-xs text-gray-500">
          전체 <span className="font-semibold text-gray-700 dark:text-gray-300">{data.total.toLocaleString()}</span>건
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <input type="text" value={pending.q} onChange={(e) => setPending({ ...pending, q: e.target.value })} placeholder="제목/내용/회원 검색"
            className={`w-64 ${cls}`} onKeyDown={(e) => e.key === 'Enter' && setFilter({ ...filter, ...pending, page: 1 })} />
          <span className="mx-1 text-xs text-gray-400">|</span>
          <input type="date" value={pending.fr_date} onChange={(e) => setPending({ ...pending, fr_date: e.target.value })} className={`w-36 ${cls}`} />
          <span className="text-gray-400">~</span>
          <input type="date" value={pending.to_date} onChange={(e) => setPending({ ...pending, to_date: e.target.value })} className={`w-36 ${cls}`} />
          <button onClick={() => setFilter({ ...filter, ...pending, page: 1 })} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white">
            <Search className="w-4 h-4" /> 검색
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{success}</div>}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-brand-600 dark:bg-brand-700 text-[11px] text-white">
              <tr>
                <th className="px-3 py-2 text-left font-medium">번호</th>
                <th className="px-3 py-2 text-left font-medium">제목</th>
                {slug === 'review' && <th className="px-3 py-2 text-left font-medium">상담사</th>}
                {slug === 'review' && <th className="px-3 py-2 text-right font-medium text-gray-400" title="현재 사용자 페이지에 노출하지 않는 비활성 기능 — 데이터는 누적 중">평점 <span className="text-[10px] font-normal">(미사용)</span></th>}
                {slug === 'review' && <th className="px-3 py-2 text-center font-medium" title="후기 신고 누적 — 빨강은 미처리 신고">신고</th>}
                <th className="px-3 py-2 text-left font-medium">작성자</th>
                <th className="px-3 py-2 text-right font-medium">조회</th>
                <th className="px-3 py-2 text-left font-medium">작성일</th>
                <th className="px-3 py-2 text-center font-medium">상태</th>
                <th className="px-3 py-2 text-right font-medium">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading && !data ? (
                <tr><td colSpan={slug === 'review' ? 11 : 8} className="px-4 py-8 text-center text-sm text-gray-500">로딩...</td></tr>
              ) : !data || data.items.length === 0 ? (
                <tr><td colSpan={slug === 'review' ? 11 : 8} className="px-4 py-8 text-center text-sm text-gray-400">자료가 없습니다.</td></tr>
              ) : (
                data.items.map((p, idx) => {
                  const num = data.total - (filter.page - 1) * PAGE_SIZE - idx
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-3 py-2 text-gray-500">{num}</td>
                      <td className="px-3 py-2 max-w-[400px] truncate">
                        {p.is_secret && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 mr-1" title={slug === 'review' ? '구버전 비밀후기 — 2026-05-15 이후 신규 비밀후기는 작성 불가' : '비밀글'}>비밀</span>}
                        {p.has_file && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 mr-1">파일</span>}
                        {p.title}
                      </td>
                      {slug === 'review' && (
                        <td className="px-3 py-2 whitespace-nowrap">
                          {p.counselor_id ? (
                            <Link to={`/members/counselors/${p.counselor_id}`} className="text-brand-600 hover:underline">{p.counselor_name || `#${p.counselor_id}`}</Link>
                          ) : <span className="text-gray-400">-</span>}
                        </td>
                      )}
                      {slug === 'review' && <td className="px-3 py-2 text-right text-gray-400">{p.rating ? `${p.rating}/5` : '-'}</td>}
                      {slug === 'review' && (
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          {(p.report_count ?? 0) === 0 ? (
                            <span className="text-gray-300">-</span>
                          ) : (
                            <Link to="/review-reports" title={`총 ${p.report_count}건 (미처리 ${p.report_pending_count ?? 0}건)`}>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${(p.report_pending_count ?? 0) > 0 ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-600'}`}>
                                {(p.report_pending_count ?? 0) > 0 ? '⚠' : ''}
                                {p.report_count}건
                              </span>
                            </Link>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2 whitespace-nowrap">
                        {p.member_id && p.mb_id ? (
                          <Link to={`/members/customers/${p.member_id}`} className="text-brand-600 hover:underline">{p.mb_id}</Link>
                        ) : (
                          <span className="text-gray-400">{p.member_nickname || p.member_name || '-'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500">{p.view_count.toLocaleString()}</td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{formatDT(p.created_at)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="text-[10px] text-gray-500">👍 {p.like_count} / 👎 {p.dislike_count}</span>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {isQa && (
                          <button
                            onClick={() => openReply(p)}
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded border mr-1 ${
                              p.extras?.admin_reply
                                ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                : 'border-amber-200 text-amber-700 hover:bg-amber-50'
                            }`}
                          >
                            {p.extras?.admin_reply ? '✓ 답변완료' : '✋ 답변작성'}
                          </button>
                        )}
                        <button onClick={() => onDelete(p)} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-rose-200 text-rose-700 hover:bg-rose-50">
                          <Trash2 className="w-3.5 h-3.5" /> 삭제
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {data && data.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-gray-500">
            <div>총 {data.total.toLocaleString()}건 · {filter.page} / {totalPages}</div>
            <div className="flex gap-1">
              <button onClick={() => setFilter((f) => ({ ...f, page: Math.max(1, f.page - 1) }))} disabled={filter.page <= 1} className="px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-40">이전</button>
              <button onClick={() => setFilter((f) => ({ ...f, page: Math.min(totalPages, f.page + 1) }))} disabled={filter.page >= totalPages} className="px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-40">다음</button>
            </div>
          </div>
        )}
      </div>

      {/* CS 답변 모달 (Phase 12) */}
      {replyPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl mx-4 p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">CS 답변</h3>
              <button onClick={() => setReplyPost(null)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div className="p-3 rounded bg-gray-50 dark:bg-gray-700 text-sm">
                <div className="font-medium">{replyPost.title}</div>
                <div className="mt-1 text-xs text-gray-500">
                  작성자: {replyPost.mb_id || replyPost.member_nickname || '익명'} · {formatDT(replyPost.created_at)}
                </div>
                <div className="mt-2 text-xs whitespace-pre-wrap text-gray-700 dark:text-gray-300 max-h-40 overflow-y-auto">
                  {replyPost.content || '(내용 없음)'}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">답변 내용</label>
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  rows={6}
                  placeholder="답변을 작성해주세요. 회원/상담사가 이 내용을 볼 수 있습니다."
                  className="w-full mt-1 px-3 py-2 border rounded text-sm bg-white dark:bg-gray-700"
                />
              </div>
              {replyPost.extras?.admin_reply && (
                <div className="text-xs text-gray-500">
                  마지막 답변: {replyPost.extras.admin_reply.replied_by} ·{' '}
                  {formatDT(replyPost.extras.admin_reply.replied_at)}
                </div>
              )}
              <div className="flex gap-2 justify-end pt-2">
                {replyPost.extras?.admin_reply && (
                  <button
                    onClick={() => void deleteReply()}
                    disabled={replySubmitting}
                    className="px-4 py-2 text-sm rounded border border-rose-200 text-rose-700 disabled:opacity-40"
                  >
                    답변 삭제
                  </button>
                )}
                <button onClick={() => setReplyPost(null)} className="px-4 py-2 text-sm border rounded">
                  취소
                </button>
                <button
                  disabled={!replyContent.trim() || replySubmitting}
                  onClick={() => void submitReply()}
                  className="px-4 py-2 text-sm rounded bg-brand-600 text-white disabled:opacity-50"
                >
                  {replySubmitting ? '처리 중...' : replyPost.extras?.admin_reply ? '답변 수정' : '답변 등록'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const cls = 'px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none'

function formatDT(s: string): string {
  const dt = new Date(s); if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
