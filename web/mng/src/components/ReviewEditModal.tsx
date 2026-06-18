import { useState } from 'react'
import { api } from '../lib/api'

/**
 * 관리자 후기 수정 모달.
 *  - 시딩 후기(extras._seed): 제목·내용·작성자명·작성일 전부 수정.
 *  - 진짜 후기(고객 글): 제목·내용만 (작성자·날짜 불변 — 조작 방지).
 */

export type EditablePost = {
  id: number
  title: string
  content: string | null
  created_at: string
  extras?: { _seed?: boolean; _seed_name?: string } | null
}

const DATE_PRESETS: { label: string; days: number }[] = [
  { label: '지금', days: 0 },
  { label: '1일 전', days: 1 },
  { label: '3일 전', days: 3 },
  { label: '1주 전', days: 7 },
  { label: '2주 전', days: 14 },
  { label: '한 달 전', days: 30 },
]

function pad(n: number) { return String(n).padStart(2, '0') }
function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function daysAgoLocalInput(days: number) { return toLocalInput(new Date(Date.now() - days * 86400000)) }
function isoToLocalInput(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? daysAgoLocalInput(0) : toLocalInput(d)
}

export default function ReviewEditModal({
  post,
  onClose,
  onSuccess,
}: {
  post: EditablePost
  onClose: () => void
  onSuccess: (msg: string) => void
}) {
  const isSeed = !!post.extras?._seed
  const [title, setTitle] = useState(post.title)
  const [content, setContent] = useState(post.content ?? '')
  const [reviewerName, setReviewerName] = useState(post.extras?._seed_name ?? '')
  const [createdAt, setCreatedAt] = useState(isoToLocalInput(post.created_at))
  const [showPicker, setShowPicker] = useState(true) // 기존 날짜 그대로 보여주며 시작
  const [activePreset, setActivePreset] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputCls =
    'w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-400'
  const chipCls = (on: boolean) =>
    `px-2.5 py-1 text-xs rounded-full border font-medium transition-colors ${
      on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-brand-300 hover:bg-brand-50/50'
    }`

  const submit = async () => {
    setError(null)
    if (!title.trim()) { setError('제목을 입력해주세요.'); return }
    if (!content.trim()) { setError('내용을 입력해주세요.'); return }
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = { title: title.trim(), content: content.trim() }
      if (isSeed) {
        body.reviewer_name = reviewerName.trim()
        body.created_at = new Date(createdAt).toISOString()
      }
      await api(`/admin/posts/reviews/${post.id}/edit`, { method: 'PATCH', body: JSON.stringify(body) })
      onSuccess('후기 수정 완료')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-[640px] max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            후기 수정 {isSeed && <span className="text-xs text-brand-600 font-medium">· 시딩</span>}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {!isSeed && (
          <p className="text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-md px-3 py-2">
            고객이 작성한 후기입니다. 조작 방지를 위해 <strong>제목·내용만</strong> 수정할 수 있습니다.
          </p>
        )}

        {/* 작성자 이름 (시딩만) */}
        {isSeed && (
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">작성자 이름 (별표 표시)</label>
            <input value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} className={inputCls} />
          </div>
        )}

        {/* 작성일 (시딩만) */}
        {isSeed && (
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">작성일</label>
            <div className="flex flex-wrap gap-1.5">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => { setCreatedAt(daysAgoLocalInput(p.days)); setActivePreset(p.days); setShowPicker(false) }}
                  className={chipCls(!showPicker && activePreset === p.days)}
                >{p.label}</button>
              ))}
              <button onClick={() => { setShowPicker(true); setActivePreset(null) }} className={chipCls(showPicker)}>직접 지정</button>
            </div>
            {showPicker && (
              <input type="datetime-local" value={createdAt} onChange={(e) => setCreatedAt(e.target.value)} className={inputCls + ' mt-2'} />
            )}
            <p className="text-[10px] text-gray-400 mt-1.5">
              → {new Date(createdAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
        )}

        {/* 제목 */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">제목</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </div>

        {/* 내용 */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">내용</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} className={inputCls + ' resize-y'} />
        </div>

        {error && <div className="text-sm text-rose-600 bg-rose-50 rounded-md px-3 py-2">{error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50">취소</button>
          <button
            onClick={() => void submit()}
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white font-medium disabled:opacity-50"
          >
            {submitting ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
