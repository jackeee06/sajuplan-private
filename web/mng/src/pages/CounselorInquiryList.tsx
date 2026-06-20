import { useCallback, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { api } from '../lib/api'
import { FILE_BASE } from '../lib/runtime-env'
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
  InfoBox,
} from '../components/table'

/**
 * 상담사 → 운영자 1:1 고객센터 문의 관리.
 * 상담사 마이페이지 "문의하기"(분류: 이용안내/상담/정산/서비스상품)로 들어온 문의를
 * 운영자가 확인하고 답변한다.
 *
 *  GET    /api/admin/counselor-inquiries
 *  GET    /api/admin/counselor-inquiries/:id
 *  POST   /api/admin/counselor-inquiries/:id/reply
 *  DELETE /api/admin/counselor-inquiries/:id/reply
 */

interface InquiryRow {
  id: number
  member_id: number
  mb_id: string | null
  counselor_name: string | null
  category: string
  title: string
  content: string
  status: string
  photo_count: number
  replied_at: string | null
  created_at: string
}

interface ListResp {
  items: InquiryRow[]
  total: number
  page: number
  limit: number
}

interface DetailDto {
  id: number
  member_id: number
  mb_id: string | null
  counselor_name: string | null
  category: string
  title: string
  content: string
  status: string
  photos: string[]
  reply_content: string | null
  reply_admin_name: string | null
  replied_at: string | null
  created_at: string
}

const CATEGORIES = ['이용안내', '상담', '정산', '서비스상품']
const PAGE_SIZE = Number(import.meta.env.VITE_LIST_PAGE_SIZE ?? 50) // 첫 화면 50줄 (2026-06-19)

const ctrlCls =
  'text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400'

function fmt(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function CounselorInquiryList() {
  const [items, setItems] = useState<InquiryRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [detail, setDetail] = useState<DetailDto | null>(null)
  const [replyText, setReplyText] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (category) params.set('category', category)
    if (keyword.trim()) params.set('q', keyword.trim())
    params.set('page', String(page))
    params.set('limit', String(PAGE_SIZE))
    api<ListResp>(`/admin/counselor-inquiries?${params}`)
      .then((res) => {
        setItems(res.items)
        setTotal(res.total)
      })
      .catch((e) => setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [status, category, keyword, page])

  useEffect(() => {
    load()
  }, [load])

  const openDetail = async (id: number) => {
    try {
      const d = await api<DetailDto>(`/admin/counselor-inquiries/${id}`)
      setDetail(d)
      setReplyText(d.reply_content ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : '상세를 불러오지 못했습니다.')
    }
  }

  const submitReply = async () => {
    if (!detail || !replyText.trim()) return
    setSaving(true)
    try {
      await api(`/admin/counselor-inquiries/${detail.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ content: replyText.trim() }),
      })
      setDetail(null)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '답변 저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const deleteReply = async () => {
    if (!detail) return
    if (!confirm('답변을 삭제하시겠습니까? (문의는 답변대기로 돌아갑니다)')) return
    setSaving(true)
    try {
      await api(`/admin/counselor-inquiries/${detail.id}/reply`, { method: 'DELETE' })
      setDetail(null)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '답변 삭제 실패')
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const resolveImg = (u: string) => (u.startsWith('/') ? `${FILE_BASE}${u}` : u)

  return (
    <div className="space-y-2 max-w-[1100px]">
      {/* 타이틀 — 한 줄, 부제·카운트 인라인 (상담후기 관리 표준) */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">상담사 고객센터 문의</h1>
        <span className="text-xs text-gray-500 dark:text-gray-400">상담사가 마이페이지 "문의하기"로 보낸 문의 — 확인 후 답변</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          · 전체 <span className="text-brand-600 font-semibold tabular-nums">{total.toLocaleString()}</span>건
        </span>
      </div>

      {/* 운영 안내 */}
      <InfoBox
        title="📋 고객센터 문의 안내"
        rows={[
          { label: '분류', value: '이용안내 / 상담 / 정산 / 서비스상품' },
          { label: '상태', value: '답변대기(미응답) → 답변완료. 답변을 저장하면 상담사 화면에 "답변완료"로 표시됨' },
          { label: '답변', value: '행을 클릭해 본문·첨부 확인 후 운영팀 답변 등록. 답변 삭제 시 다시 답변대기로 전환' },
        ]}
      />

      {/* 툴바 — 상태·분류·검색 한 줄 (좌측 정렬) */}
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          className={ctrlCls}
        >
          <option value="">전체 상태</option>
          <option value="pending">답변대기</option>
          <option value="answered">답변완료</option>
        </select>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value)
            setPage(1)
          }}
          className={ctrlCls}
        >
          <option value="">전체 분류</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="relative">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1)
                load()
              }
            }}
            placeholder="제목·내용·상담사 검색"
            className={`${ctrlCls} pl-8 w-48`}
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
      </div>

      {error && <p className="text-sm text-rose-500">{error}</p>}

      {/* 목록 */}
      <TableShell>
        <THead>
          <Th align="center">상태</Th>
          <Th align="left">분류</Th>
          <Th align="left">제목</Th>
          <Th align="left">상담사</Th>
          <Th align="left">작성일</Th>
        </THead>
        <TBody>
          {loading ? (
            <EmptyRow colSpan={5} loading />
          ) : items.length === 0 ? (
            <EmptyRow colSpan={5} />
          ) : (
            items.map((it) => (
              <Tr key={it.id} onClick={() => openDetail(it.id)}>
                <Td align="center">
                  <Badge color={it.status === 'answered' ? 'indigo' : 'gray'}>
                    {it.status === 'answered' ? '답변완료' : '답변대기'}
                  </Badge>
                </Td>
                <Td align="left" className="text-brand-600">{it.category}</Td>
                <Td align="left" className="text-gray-800 dark:text-gray-100">
                  {it.title}
                  {it.photo_count > 0 && <span className="ml-1 text-xs text-gray-400">📷{it.photo_count}</span>}
                </Td>
                <Td align="left" className="text-gray-600">
                  <span className="inline-block max-w-[150px] truncate align-bottom" title={String(it.counselor_name || it.mb_id || '')}>
                    {it.counselor_name ?? it.mb_id ?? `#${it.member_id}`}
                  </span>
                </Td>
                <Td align="left" className="text-gray-500 tabular-nums">{fmt(it.created_at)}</Td>
              </Tr>
            ))
          )}
        </TBody>
      </TableShell>

      <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onChange={setPage} />

      {/* 상세 + 답변 모달 */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-xl bg-white dark:bg-gray-900 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  detail.status === 'answered' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {detail.status === 'answered' ? '답변완료' : '답변대기'}
              </span>
              <span className="text-sm font-medium text-violet-600">{detail.category}</span>
            </div>

            <h2 className="mt-2 text-lg font-bold text-gray-900 dark:text-gray-100 break-keep">{detail.title}</h2>
            <p className="mt-1 text-xs text-gray-400">
              {detail.counselor_name ?? detail.mb_id ?? `#${detail.member_id}`} · {fmt(detail.created_at)}
            </p>

            <p className="mt-3 text-sm leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-line">
              {detail.content}
            </p>

            {detail.photos.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {detail.photos.map((p, i) => (
                  <a key={i} href={resolveImg(p)} target="_blank" rel="noreferrer">
                    <img
                      src={resolveImg(p)}
                      alt={`첨부 ${i + 1}`}
                      className="w-20 h-20 rounded-lg object-cover border border-gray-200"
                    />
                  </a>
                ))}
              </div>
            )}

            <div className="mt-5 border-t border-gray-100 dark:border-gray-800 pt-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                운영팀 답변
              </label>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={5}
                placeholder="답변 내용을 입력하세요. 저장하면 상담사 화면에 '답변완료'로 표시됩니다."
                className="w-full text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setDetail(null)}
                className="px-4 py-2 text-sm rounded-md border border-gray-200 text-gray-600"
              >
                닫기
              </button>
              {detail.status === 'answered' && (
                <button
                  onClick={deleteReply}
                  disabled={saving}
                  className="px-4 py-2 text-sm rounded-md border border-red-200 text-red-500 disabled:opacity-50"
                >
                  답변 삭제
                </button>
              )}
              <button
                onClick={submitReply}
                disabled={saving || !replyText.trim()}
                className="px-4 py-2 text-sm rounded-md bg-violet-600 text-white font-medium disabled:opacity-50"
              >
                {detail.status === 'answered' ? '답변 수정' : '답변 등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
