import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import ConfirmModal from '../components/ConfirmModal'
import FloatingActions from '../components/FloatingActions'
import UploadedImage from '../components/UploadedImage'
import { ApiError, counselorQnaApi, myQnaApi, type PublicCounselorQnaDetail } from '../lib/api'
import { FILE_BASE } from '../lib/runtime-env'
import { useAuth } from '../lib/auth-context'

function resolveImageUrl(u: string | null): string | null {
  if (!u) return null
  if (/^https?:\/\//.test(u)) return u
  if (u.startsWith('/')) return `${FILE_BASE}${u}`
  return u
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}.${m}.${day} ${hh}:${mm}`
}

/**
 * 문의 상세 — Figma 92:6485 (답변 있음) / 92:6381 (답변 없음)
 * 라우트: /counselors/:id/qna/:qnaId
 *
 * 백엔드: GET /api/user/counselors/:id/qna/:qnaId
 *  - 비밀글이면 본인/상담사가 아닌 한 본문 빈 문자열로 노출.
 */
export default function CounselorQnaDetail() {
  const { id, qnaId } = useParams<{ id: string; qnaId: string }>()
  const navigate = useNavigate()
  const [qna, setQna] = useState<PublicCounselorQnaDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id || !qnaId) {
      setError('잘못된 문의입니다.')
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    setError(null)
    counselorQnaApi
      .detail(id, qnaId)
      .then((r) => {
        if (alive) setQna(r)
      })
      .catch((e) => {
        if (!alive) return
        if (e instanceof ApiError && e.status === 404) {
          setError('문의를 찾을 수 없습니다.')
        } else {
          setError(e instanceof Error ? e.message : '문의를 불러오지 못했습니다.')
        }
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [id, qnaId])

  return (
    <div className="mobile-frame flex flex-col">
      {/* 헤더 — hd5 */}
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">상담 문의</h1>
        {/* 본인 글 + 답변 없을 때 수정/삭제 */}
        {qna?.is_mine && !qna?.has_reply && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setEditTitle(qna.title); setEditContent(qna.content); setEditOpen(true) }}
              className="h-8 px-3 rounded-full border border-[#D1D5DB] text-[14px] text-[#4A5565] bg-white"
            >수정</button>
            <button
              type="button"
              onClick={() => setDeleteTarget(true)}
              className="h-8 px-3 rounded-full border border-[#FB2C36] text-[14px] font-medium text-[#FB2C36] bg-white"
            >삭제</button>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col pb-10">
        {loading && (
          <div className="px-4 py-6 flex flex-col gap-4">
            <div className="h-5 w-2/3 bg-[#F3F4F6] animate-pulse rounded" />
            <div className="h-4 w-1/3 bg-[#F3F4F6] animate-pulse rounded" />
            <div className="h-4 w-full bg-[#F3F4F6] animate-pulse rounded" />
            <div className="h-4 w-5/6 bg-[#F3F4F6] animate-pulse rounded" />
          </div>
        )}

        {!loading && error && (
          <p className="text-center text-[14px] text-[#FF6467] py-20">{error}</p>
        )}

        {!loading && qna && (
          <>
            {/* 본문 그룹 */}
            <div className="px-4 pt-4 pb-4 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h2 className="text-[18px] leading-[130%] font-medium text-[#1E2939]">
                  {qna.title}
                </h2>
                <div className="flex items-center gap-1 text-[14px] leading-[130%] text-[#99A1AF]">
                  <span>{qna.reviewer_name}</span>
                  <span aria-hidden>∙</span>
                  <span>{formatDateTime(qna.created_at)}</span>
                </div>
              </div>

              <p className="text-[14px] leading-[150%] text-[#4A5565] whitespace-pre-line">
                {qna.is_secret && !qna.content && !qna.is_mine ? '비밀 문의입니다.' : qna.content}
              </p>
            </div>

            <ReplySection qna={qna} className="mt-6" />

            {/* 목록으로 — 가운데 정렬 */}
            <div className="px-4 mt-10 flex justify-center">
              <Link
                to={`/counselors/${id}/qna`}
                className="inline-flex items-center justify-center w-[120px] h-10 px-4 rounded-full bg-white border border-[#f472b6] text-[#ec4899] text-[14px] font-medium"
              >
                목록으로
              </Link>
            </div>
          </>
        )}
      </main>

      <FloatingActions bottomOffset={16} showKakao={false} />
      <BottomNav />

      {/* 수정 모달 */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) setEditOpen(false) }}>
          <div className="w-full max-w-[600px] bg-white rounded-t-[20px] px-4 pt-5 pb-8">
            <h2 className="text-[17px] font-semibold text-[#030712] mb-4">문의 수정</h2>
            <div className="mb-3">
              <label className="block text-[13px] font-medium text-[#4A5565] mb-1">제목</label>
              <input
                className="w-full px-3 py-2.5 text-[15px] border border-[#D1D5DB] rounded-[10px] bg-[#F9FAFB] focus:outline-none focus:border-[#9b7af7]"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={255}
              />
            </div>
            <div className="mb-4">
              <label className="block text-[13px] font-medium text-[#4A5565] mb-1">내용</label>
              <textarea
                className="w-full px-3 py-2.5 text-[15px] border border-[#D1D5DB] rounded-[10px] bg-[#F9FAFB] focus:outline-none focus:border-[#9b7af7] min-h-[120px] resize-none"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditOpen(false)} className="btn btn-outline-gray btn--base flex-1">취소</button>
              <button type="button" disabled={saving} className="btn btn-primary btn--base flex-1"
                onClick={async () => {
                  if (!qna || !editTitle.trim() || !editContent.trim()) return
                  setSaving(true)
                  const newTitle = editTitle.trim()
                  const newContent = editContent.trim()
                  let success = false
                  try {
                    await myQnaApi.update(Number(id), qna.id, { title: newTitle, content: newContent })
                    success = true
                  } catch { /* 저장 실패 무시 */ } finally {
                    setSaving(false)
                    setEditOpen(false)
                    if (success) setQna({ ...qna, title: newTitle, content: newContent })
                  }
                }}
              >{saving ? '저장 중...' : '저장'}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={deleteTarget}
        message="문의를 삭제하시겠습니까?"
        subMessage="삭제 후 복구할 수 없습니다."
        actionLabel="삭제"
        tone="danger"
        onConfirm={async () => {
          if (!qna) return
          setDeleting(true)
          let success = false
          try {
            await myQnaApi.remove(Number(id), qna.id)
            success = true
          } catch { /* 삭제 실패 — 모달 닫고 대기 */ } finally {
            setDeleting(false)
            setDeleteTarget(false)
            if (success) navigate(-1)
          }
        }}
        onCancel={() => setDeleteTarget(false)}
      />
    </div>
  )
}

/* ───────────── 답변 섹션 ───────────── */

function ReplySection({ qna, className = '' }: { qna: PublicCounselorQnaDetail; className?: string }) {
  const reply = qna.reply
  const profileImg = resolveImageUrl(reply?.counselor_profile_image ?? null)
  const profileImgWebp = resolveImageUrl(reply?.counselor_profile_image_webp ?? null)

  return (
    <section className={`flex flex-col gap-6 ${className}`}>
      <div className="px-4 pb-3 flex items-center border-b border-[#F3F4F6]">
        <p className="text-[15px] leading-[130%] text-[#364153]">
          상담사 답변{' '}
          <span className="font-medium text-[#ec4899]">{reply ? 1 : 0}</span>건
        </p>
      </div>

      {reply ? (
        <article className="px-4 flex flex-col gap-3">
          <p className="text-[14px] leading-[150%] text-[#4A5565] whitespace-pre-line">
            {reply.content}
          </p>
          <div className="flex items-center gap-2">
            {profileImg ? (
              <UploadedImage
                src={profileImg}
                srcWebp={profileImgWebp}
                alt=""
                className="w-7 h-7 rounded-full object-cover border border-[#F9FAFB] shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#F3F4F6] shrink-0" aria-hidden />
            )}
            <div className="flex items-center gap-1 text-[13px] leading-[130%] text-[#6A7282]">
              <span className="font-medium text-[#1E2939]">{reply.counselor_nickname}</span>
              <span aria-hidden>∙</span>
              <span>{formatDateTime(reply.created_at)}</span>
            </div>
          </div>
        </article>
      ) : (
        <div className="h-[230px] flex flex-col items-center justify-center gap-3 px-4">
          <div className="w-[60px] h-[60px] rounded-full bg-[#fdf2f8] flex items-center justify-center">
            <SpeechBubbleIcon />
          </div>
          <p className="text-[14px] leading-[130%] text-[#99A1AF]">등록된 답변이 없습니다.</p>
        </div>
      )}
    </section>
  )
}

function SpeechBubbleIcon() {
  return (
    <svg viewBox="0 0 28 28" className="w-7 h-7" fill="none" aria-hidden>
      <path
        d="M5 8c0-1.66 1.34-3 3-3h12c1.66 0 3 1.34 3 3v8c0 1.66-1.34 3-3 3h-6l-4.5 4v-4H8c-1.66 0-3-1.34-3-3V8z"
        stroke="#f472b6"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
