import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import UploadedImage from '../components/UploadedImage'
import { useAuth } from '../lib/auth-context'
import {
  counselorCustomerQnaApi,
  type CounselorCustomerQnaDetailDto,
} from '../lib/api'

/**
 * 08마이페이지_상담사_고객 문의 관리 (상세)
 * Figma node-id: 160:10685 (답변 있음) / 162:11279 (답변 없음)
 *
 * 데이터: GET /api/user/counselor/customer-qnas/:id
 * 답변:  POST /api/user/counselor/customer-qnas/:id/reply (1답변 한정)
 */
function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}.${m}.${dd} ${hh}:${mm}`
}

export default function CounselorMyCustomerQnaDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { member, loading: authLoading, isCounselor } = useAuth()
  const [qna, setQna] = useState<CounselorCustomerQnaDetailDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // 답변 케밥 메뉴 / 수정 / 삭제
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // 외부 클릭 / Esc 로 케밥 메뉴 닫기
  useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const startEdit = () => {
    if (!qna?.reply) return
    setEditDraft(qna.reply.content)
    setEditError(null)
    setEditing(true)
    setMenuOpen(false)
  }

  const cancelEdit = () => {
    setEditing(false)
    setEditError(null)
    setEditDraft('')
  }

  const onSaveEdit = async () => {
    const content = editDraft.trim()
    if (!content || !id || editSubmitting) return
    setEditSubmitting(true)
    setEditError(null)
    try {
      await counselorCustomerQnaApi.updateReply(id, content)
      cancelEdit()
      loadDetail()
    } catch (e) {
      setEditError((e as Error).message || '답변 수정에 실패했습니다.')
    } finally {
      setEditSubmitting(false)
    }
  }

  const onDelete = async () => {
    if (!id) return
    setMenuOpen(false)
    if (!window.confirm('답변을 삭제하시겠어요?')) return
    try {
      await counselorCustomerQnaApi.deleteReply(id)
      loadDetail()
    } catch (e) {
      alert((e as Error).message || '답변 삭제에 실패했습니다.')
    }
  }

  const loadDetail = () => {
    if (!id) return
    setLoading(true)
    counselorCustomerQnaApi
      .detail(id)
      .then((res) => {
        setQna(res)
        setError(null)
      })
      .catch((e) => {
        setError((e as Error).message || '문의를 불러오지 못했습니다.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (authLoading || !member || !isCounselor || !id) return
    loadDetail()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, member, isCounselor, id])

  const onSubmit = async () => {
    const content = draft.trim()
    if (!content || !id || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await counselorCustomerQnaApi.reply(id, content)
      setDraft('')
      loadDetail()
    } catch (e) {
      setSubmitError((e as Error).message || '답변 등록에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="mobile-frame flex flex-col pb-[100px] items-center justify-center min-h-[60vh]">
        <p className="text-[14px] text-[#6A7282]">불러오는 중...</p>
      </div>
    )
  }

  if (!member) {
    return <Navigate to={`/login?redirect=/counselor/mypage/customer-qnas/${id ?? ''}`} replace />
  }

  if (!isCounselor) {
    return <Navigate to="/mypage" replace />
  }

  if (loading) {
    return (
      <div className="mobile-frame flex flex-col pb-[100px] items-center justify-center min-h-[60vh]">
        <p className="text-[14px] text-[#6A7282]">불러오는 중...</p>
      </div>
    )
  }

  if (error || !qna) {
    return (
      <div className="mobile-frame flex flex-col pb-[100px]">
        <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="뒤로"
            className="w-[30px] h-[30px] flex items-center justify-center"
          >
            <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
          </button>
          <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">고객 문의 관리</h1>
        </header>
        <div className="flex items-center justify-center min-h-[50vh] text-[#6A7282] text-[14px]">
          {error || '문의를 찾을 수 없습니다.'}
        </div>
      </div>
    )
  }

  const hasReply = !!qna.reply
  const replyImg = qna.reply?.counselor_profile_image ?? null
  const replyImgWebp = qna.reply?.counselor_profile_image_webp ?? null

  return (
    <div className="mobile-frame flex flex-col pb-[100px]">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">고객 문의 관리</h1>
      </header>

      <main className="flex-1 px-4 pt-2">
        <h2 className="text-[18px] font-bold leading-[140%] text-[#030712] break-keep">{qna.title}</h2>
        <p className="mt-1 text-[13px] leading-[140%] text-[#99A1AF]">
          {qna.reviewer_name} · {formatDateTime(qna.created_at)}
        </p>
        <p className="mt-4 text-[15px] leading-[160%] text-[#1E2939] whitespace-pre-line">
          {qna.content}
        </p>

        <div className="mt-6 border-t border-[#F3F4F6]" />

        <p className="mt-4 text-[14px] font-semibold text-[#1E2939]">
          {hasReply ? '상담사 답변 ' : '답변목록 '}
          <span className="text-[#8259F5]">{hasReply ? 1 : 0}</span>건
        </p>

        {hasReply && qna.reply ? (
          <ul className="mt-3 flex flex-col">
            <li className="py-4 border-b border-[#F3F4F6] last:border-b-0">
              {editing ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    rows={3}
                    disabled={editSubmitting}
                    className="w-full min-h-[88px] px-3 py-2 rounded-[10px] bg-[#F9FAFB] border border-[#8259F5] text-[14px] leading-[160%] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none disabled:opacity-50 resize-none"
                    placeholder="답변을 입력해주세요."
                  />
                  {editError && <p className="text-[13px] text-[#E84263]">{editError}</p>}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={editSubmitting}
                      className="h-9 px-4 rounded-full border border-[#E5E7EB] text-[13px] font-medium text-[#6A7282] disabled:opacity-50"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={onSaveEdit}
                      disabled={editSubmitting || !editDraft.trim()}
                      className="h-9 px-4 rounded-full bg-[#8259F5] text-[13px] font-medium text-white disabled:opacity-50"
                    >
                      {editSubmitting ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-2">
                    <p className="flex-1 text-[15px] leading-[160%] text-[#1E2939] whitespace-pre-line">
                      {qna.reply.content}
                    </p>
                    <div ref={menuRef} className="relative shrink-0">
                      <button
                        type="button"
                        aria-label="더보기"
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen((v) => !v)}
                        className="w-5 h-5 flex items-center justify-center"
                      >
                        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" aria-hidden>
                          <circle cx="12" cy="6" r="1.4" fill="#6A7282" />
                          <circle cx="12" cy="12" r="1.4" fill="#6A7282" />
                          <circle cx="12" cy="18" r="1.4" fill="#6A7282" />
                        </svg>
                      </button>
                      {menuOpen && (
                        <ul
                          role="menu"
                          className="absolute right-0 top-[calc(100%+4px)] z-30 w-[100px] py-1 bg-white border border-[#F3F4F6] rounded-[10px] shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                        >
                          <li>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={startEdit}
                              className="w-full px-3 py-2 text-left text-[13px] text-[#1E2939] hover:bg-[#f3f0ff] hover:text-[#8259F5]"
                            >
                              수정
                            </button>
                          </li>
                          <li>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={onDelete}
                              className="w-full px-3 py-2 text-left text-[13px] text-[#E84263] hover:bg-[#FEF2F2]"
                            >
                              삭제
                            </button>
                          </li>
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {replyImg ? (
                      <UploadedImage
                        src={replyImg}
                        srcWebp={replyImgWebp}
                        alt=""
                        className="w-7 h-7 rounded-full object-cover border border-[#F9FAFB] shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-[#F3F4F6] shrink-0" aria-hidden />
                    )}
                    <p className="text-[13px] leading-[140%] text-[#99A1AF]">
                      {qna.reply.counselor_nickname} · {formatDateTime(qna.reply.created_at)}
                    </p>
                  </div>
                </>
              )}
            </li>
          </ul>
        ) : (
          <div className="py-12 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#f3f0ff] flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" aria-hidden>
                <path
                  d="M21 11.5C21 16.7467 16.9706 21 12 21C10.4 21 8.9 20.55 7.6 19.85L3 21L4.18 16.5C3.42 15.05 3 13.32 3 11.5C3 6.25 7.03 2 12 2C16.97 2 21 6.25 21 11.5Z"
                  stroke="#8259F5"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-[14px] text-[#6A7282]">등록된 답변이 없습니다.</p>
          </div>
        )}

        {/* 답변 입력 — 답변이 이미 있으면 숨김 (1문의 1답변 정책) */}
        {!hasReply && (
          <div className="mt-4">
            <div className="relative">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    onSubmit()
                  }
                }}
                placeholder="답변을 입력해주세요."
                disabled={submitting}
                className="w-full h-[44px] pl-4 pr-14 rounded-full bg-[#F9FAFB] border border-[#8259F5] text-[14px] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none disabled:opacity-50"
              />
              {draft.trim() && (
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={submitting}
                  aria-label="보내기"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#8259F5] flex items-center justify-center disabled:opacity-50"
                >
                  <img src="/img/ic_send.svg" alt="" className="w-4 h-4" />
                </button>
              )}
            </div>
            {submitError && (
              <p className="mt-2 text-[13px] text-[#E84263]">{submitError}</p>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/counselor/mypage/customer-qnas')}
            className="h-10 px-6 rounded-full border border-[#8259F5] text-[14px] font-medium text-[#8259F5]"
          >
            목록으로
          </button>
        </div>
      </main>

      <FloatingActions bottomOffset={24} />
      <BottomNav myHref="/counselor/mypage" />
      </div>
  )
}
