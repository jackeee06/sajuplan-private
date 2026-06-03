import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Search, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { defaultLast7Days } from '../lib/dateRange'
import { DateRangeChips } from '../components/DateRangeChips'
import {
  Th,
  Td,
  Tr,
  TableShell,
  THead,
  TBody,
  EmptyRow,
  Badge,
  PaginationBar,
  inputCls,
} from '../components/table'

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
  /** 후기 신고 누적 */
  report_count?: number
  report_pending_count?: number
  /** 어드민 답변 (qa / qa_counselor 만) */
  extras?: { admin_reply?: AdminReply }
  /** counselor_qna 전용 */
  is_hidden?: boolean
  has_reply?: boolean
  created_at: string
}

interface Resp {
  items: Post[]
  total: number
  page: number
  limit: number
}

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

  const _init = defaultLast7Days()
  const [filter, setFilter] = useState({ q: '', fr_date: _init.from, to_date: _init.to, page: 1 })
  const [pending, setPending] = useState({ q: '', fr_date: _init.from, to_date: _init.to })
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [replyPost, setReplyPost] = useState<Post | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [replySubmitting, setReplySubmitting] = useState(false)
  const [viewPost, setViewPost] = useState<Post | null>(null)
  const isQa = slug === 'qa' || slug === 'qa_counselor'
  const isCounselorQna = slug === 'qa_counselor'

  const onRowClick = (p: Post) => {
    if (isCounselorQna) setViewPost(p)   // 읽기 전용 보기
    else if (isQa) openReply(p)
    else setViewPost(p)
  }

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

  useEffect(() => {
    const init = defaultLast7Days()
    setFilter({ q: '', fr_date: init.from, to_date: init.to, page: 1 })
    setPending({ q: '', fr_date: init.from, to_date: init.to })
  }, [slug])

  const load = () => {
    const params = new URLSearchParams()
    if (filter.q) params.set('q', filter.q)
    if (filter.fr_date) params.set('fr_date', filter.fr_date)
    if (filter.to_date) params.set('to_date', filter.to_date)
    params.set('page', String(filter.page))
    params.set('limit', String(PAGE_SIZE))
    setLoading(true)
    setError(null)
    api<Resp>(`/admin/posts/${slug}?${params}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [slug, filter])

  const onDelete = async (p: Post) => {
    if (!confirm(`"${p.title}"를 삭제하시겠습니까?`)) return
    try {
      await api(`/admin/posts/${slug}/${p.id}`, { method: 'DELETE' })
      setSuccess('삭제 완료')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  const colSpan = slug === 'review' ? 11 : slug === 'qa_counselor' ? 9 : 8

  return (
    <div className="space-y-3 max-w-[1100px]">
      {/* 타이틀 */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{info.title}</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{info.desc}</p>
      </div>

      {/* 상단 카운트 */}
      {data && (
        <div className="text-xs text-gray-500">
          전체 <span className="text-brand-600 font-semibold">{data.total.toLocaleString()}</span>건
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
              onChange={(e) => setPending({ ...pending, q: e.target.value })}
              placeholder="제목 / 내용 / 회원 검색"
              className={inputCls}
              onKeyDown={(e) => e.key === 'Enter' && setFilter({ ...filter, ...pending, page: 1 })}
            />
          </div>
          <div className="w-[160px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">시작일</label>
            <input
              type="date"
              value={pending.fr_date}
              onChange={(e) => setPending({ ...pending, fr_date: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="w-[160px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">종료일</label>
            <input
              type="date"
              value={pending.to_date}
              onChange={(e) => setPending({ ...pending, to_date: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="ml-auto">
            <button
              onClick={() => setFilter({ ...filter, ...pending, page: 1 })}
              className="px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white inline-flex items-center gap-1.5 font-medium"
            >
              <Search className="w-4 h-4" /> 검색
            </button>
          </div>
        </div>
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

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{success}</div>}

      {/* 테이블 */}
      <TableShell>
        <THead>
          <Th align="right">번호</Th>
          <Th align="left">제목</Th>
          {(slug === 'review' || slug === 'qa_counselor') && <Th align="left">상담사</Th>}
          {slug === 'review' && (
            <Th align="right">
              평점 <span className="text-[10px] font-normal normal-case tracking-normal">(미사용)</span>
            </Th>
          )}
          {slug === 'review' && <Th align="center">신고</Th>}
          <Th align="left">작성자</Th>
          <Th align="right">조회</Th>
          <Th align="left">작성일</Th>
          <Th align="center">상태</Th>
          <Th align="center">관리</Th>
        </THead>
        <TBody>
          {loading && !data ? (
            <EmptyRow colSpan={colSpan} loading />
          ) : !data || data.items.length === 0 ? (
            <EmptyRow colSpan={colSpan} />
          ) : (
            data.items.map((p, idx) => {
              const num = data.total - (filter.page - 1) * PAGE_SIZE - idx
              return (
                <Tr key={p.id} onClick={() => onRowClick(p)}>
                  <Td align="right" className="text-gray-400 tabular-nums">{num}</Td>
                  <Td align="left" className="max-w-[400px] truncate">
                    {p.is_secret && (
                      <Badge color="gray">
                        <span title={slug === 'review' ? '구버전 비밀후기' : '비밀글'}>비밀</span>
                      </Badge>
                    )}
                    {p.is_hidden && (
                      <span className="ml-1"><Badge color="rose">숨김</Badge></span>
                    )}
                    {p.has_file && (
                      <span className="ml-1">
                        <Badge color="blue">파일</Badge>
                      </span>
                    )}
                    <span className={p.is_secret || p.has_file || p.is_hidden ? 'ml-1.5' : ''}>{p.title}</span>
                  </Td>
                  {(slug === 'review' || slug === 'qa_counselor') && (
                    <Td align="left">
                      {p.counselor_id ? (
                        <Link
                          to={`/members/counselors/${p.counselor_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-brand-600 hover:underline font-medium"
                        >
                          {p.counselor_name || `#${p.counselor_id}`}
                        </Link>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </Td>
                  )}
                  {slug === 'review' && (
                    <Td align="right" className="text-xs text-gray-300 tabular-nums">
                      {p.rating ? `${p.rating}/5` : '-'}
                    </Td>
                  )}
                  {slug === 'review' && (
                    <Td align="center">
                      {(p.report_count ?? 0) === 0 ? (
                        <span className="text-gray-300">-</span>
                      ) : (
                        <Link
                          to="/review-reports"
                          onClick={(e) => e.stopPropagation()}
                          title={`총 ${p.report_count}건 (미처리 ${p.report_pending_count ?? 0}건)`}
                        >
                          <Badge color={(p.report_pending_count ?? 0) > 0 ? 'rose' : 'gray'}>
                            {(p.report_pending_count ?? 0) > 0 ? '⚠ ' : ''}
                            {p.report_count}건
                          </Badge>
                        </Link>
                      )}
                    </Td>
                  )}
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
                      <span className="text-gray-400">
                        {p.member_nickname || p.member_name || '-'}
                      </span>
                    )}
                  </Td>
                  <Td align="right" className="tabular-nums text-gray-500">
                    {p.view_count === 0 ? (
                      <span className="text-gray-300">0</span>
                    ) : (
                      p.view_count.toLocaleString()
                    )}
                  </Td>
                  <Td align="left" className="text-xs text-gray-500 tabular-nums">
                    {formatDT(p.created_at)}
                  </Td>
                  <Td align="center" className="text-[11px] text-gray-500">
                    {slug === 'qa_counselor' ? (
                      p.has_reply
                        ? <Badge color="emerald">답변완료</Badge>
                        : <Badge color="amber">답변대기</Badge>
                    ) : (
                      `👍 ${p.like_count} / 👎 ${p.dislike_count}`
                    )}
                  </Td>
                  <Td align="center">
                    <div className="flex items-center justify-center gap-1">
                      {isQa && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openReply(p) }}
                          className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border font-medium ${
                            p.extras?.admin_reply
                              ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                              : 'border-amber-200 text-amber-700 hover:bg-amber-50'
                          }`}
                        >
                          {p.extras?.admin_reply ? '✓ 답변완료' : '✋ 답변작성'}
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); void onDelete(p) }}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </Td>
                </Tr>
              )
            })
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

      {/* 본문 미리보기 모달 */}
      {viewPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setViewPost(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-2xl mx-4 p-5 max-h-[85vh] overflow-y-auto border border-gray-200 dark:border-gray-700 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {isCounselorQna && viewPost.is_hidden && <span className="mr-1.5 text-xs px-1.5 py-0.5 bg-red-50 text-red-500 rounded">숨김</span>}
                {viewPost.title}
              </h3>
              <button onClick={() => setViewPost(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="text-xs text-gray-500 mb-3 flex flex-wrap gap-2">
              <span>작성자: {viewPost.mb_id || viewPost.member_nickname || viewPost.member_name || '익명'}</span>
              <span>·</span>
              <span>{formatDT(viewPost.created_at)}</span>
              {isCounselorQna && viewPost.counselor_name && (
                <><span>·</span><span>상담사: <strong>{viewPost.counselor_name}</strong></span></>
              )}
              {!isCounselorQna && (
                <><span>·</span><span>조회 {viewPost.view_count.toLocaleString()}</span></>
              )}
            </div>
            {!isCounselorQna && slug === 'review' && viewPost.counselor_name && (
              <div className="text-xs mb-3 text-gray-600">
                <span className="font-medium">상담사:</span> {viewPost.counselor_name}
              </div>
            )}
            {/* 문의 본문 */}
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm border border-gray-200 dark:border-gray-700 whitespace-pre-wrap text-gray-700 dark:text-gray-300 max-h-64 overflow-y-auto">
              {viewPost.is_secret ? <span className="text-gray-400 italic">비밀글입니다.</span> : (viewPost.content || <span className="text-gray-400">(내용 없음)</span>)}
            </div>
            {/* counselor_qna 전용: 상담사 답변 */}
            {isCounselorQna && (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-500 mb-1.5">상담사 답변</p>
                {viewPost.has_reply && viewPost.extras?.admin_reply ? (
                  <div className="p-3 rounded-lg bg-pink-50 border border-pink-100 text-sm whitespace-pre-wrap text-gray-700 max-h-48 overflow-y-auto">
                    <p className="text-xs text-gray-400 mb-1">{viewPost.extras.admin_reply.replied_by as string} · {formatDT(viewPost.extras.admin_reply.replied_at as string)}</p>
                    {viewPost.extras.admin_reply.content as string}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">아직 답변이 없습니다.</p>
                )}
                <p className="text-[11px] text-gray-400 mt-2">* 답변은 상담사가 앱에서 직접 작성합니다.</p>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  void onDelete(viewPost)
                  setViewPost(null)
                }}
                className="px-3 py-2 text-sm rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50 font-medium"
              >
                삭제
              </button>
              <button onClick={() => setViewPost(null)} className="px-4 py-2 text-sm rounded-md border border-gray-200 hover:bg-gray-50">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CS 답변 모달 */}
      {replyPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-2xl mx-4 p-5 max-h-[85vh] overflow-y-auto border border-gray-200 dark:border-gray-700 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">CS 답변</h3>
              <button onClick={() => setReplyPost(null)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm border border-gray-200 dark:border-gray-700">
                <div className="font-medium text-gray-900 dark:text-gray-100">{replyPost.title}</div>
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
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 outline-none"
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
                    className="px-4 py-2 text-sm rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                  >
                    답변 삭제
                  </button>
                )}
                <button
                  onClick={() => setReplyPost(null)}
                  className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  취소
                </button>
                <button
                  disabled={!replyContent.trim() || replySubmitting}
                  onClick={() => void submitReply()}
                  className="px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white font-medium disabled:opacity-50"
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

function formatDT(s: string): string {
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
