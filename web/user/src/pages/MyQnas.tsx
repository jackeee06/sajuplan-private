import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import ConfirmModal from '../components/ConfirmModal'
import FloatingActions from '../components/FloatingActions'
import { useAuth } from '../lib/auth-context'
import { myQnaApi, type MyQnaItem } from '../lib/api'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${dd}`
}

export default function MyQnas() {
  const navigate = useNavigate()
  const { member, loading: authLoading } = useAuth()
  const [items, setItems] = useState<MyQnaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  // ⋮ 드롭다운
  const containerRef = useRef<HTMLDivElement>(null)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)

  // 삭제
  const [deleteTarget, setDeleteTarget] = useState<MyQnaItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  // 수정 모달
  const [editTarget, setEditTarget] = useState<MyQnaItem | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [toast, setToast] = useState<string | null>(null)

  // ⋮ 외부 클릭 닫기
  useEffect(() => {
    if (openMenuId == null) return
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpenMenuId(null)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenMenuId(null)
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [openMenuId])

  // 토스트 자동 소멸
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (authLoading || !member) return
    let mounted = true
    setLoading(true)
    myQnaApi
      .list({ limit: 50, offset: 0 })
      .then((res) => { if (mounted) setItems(res.items) })
      .catch((e) => { if (mounted) setError((e as Error).message || '문의 목록을 불러오지 못했습니다.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [authLoading, member, reload])

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await myQnaApi.remove(deleteTarget.counselor_id, deleteTarget.id)
      setDeleteTarget(null)
      setToast('문의가 삭제되었습니다.')
      setReload((x) => x + 1)
    } catch (e) {
      setToast(e instanceof Error ? e.message : '삭제 실패')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const openEdit = (q: MyQnaItem) => {
    setEditTarget(q)
    setEditTitle(q.title)
    setEditContent(q.content)
    setEditError(null)
    setOpenMenuId(null)
  }

  const submitEdit = async () => {
    if (!editTarget) return
    const title = editTitle.trim()
    const content = editContent.trim()
    if (!title) { setEditError('제목을 입력해주세요.'); return }
    if (!content) { setEditError('내용을 입력해주세요.'); return }
    setSaving(true)
    setEditError(null)
    try {
      await myQnaApi.update(editTarget.counselor_id, editTarget.id, { title, content })
      setEditTarget(null)
      setToast('문의가 수정되었습니다.')
      setReload((x) => x + 1)
    } catch (e) {
      setEditError(e instanceof Error ? e.message : '수정 실패')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading) {
    return (
      <div className="mobile-frame flex flex-col pb-[100px] items-center justify-center min-h-[60vh]">
        <p className="text-[14px] text-[#6A7282]">불러오는 중...</p>
      </div>
    )
  }

  if (!member) return <Navigate to="/login?redirect=/mypage/my-qnas" replace />

  return (
    <div ref={containerRef} className="mobile-frame flex flex-col pb-[100px]">
      {/* 헤더 */}
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">
          나의 상담문의
        </h1>
      </header>

      <main className="flex-1 px-4">
        {loading ? (
          <p className="py-10 text-center text-[14px] text-[#6A7282]">불러오는 중...</p>
        ) : error ? (
          <p className="py-10 text-center text-[14px] text-[#E84263]">{error}</p>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-[14px] text-[#6A7282]">작성한 상담문의가 없습니다.</p>
        ) : (
          items.map((q) => (
            <article key={q.id} className="py-4 border-b border-[#F3F4F6] relative">
              <div className="flex items-center gap-2">
                <span className="text-[16px] font-bold text-[#030712]">{q.counselor_name}</span>
                {q.counselor_code && (
                  <span className="text-[15px] font-medium text-[#ec4899]">{q.counselor_code}</span>
                )}
                {/* ⋮ 메뉴 — 답변 전에만 수정·삭제 가능 */}
                {!q.has_reply && (
                  <div className="ml-auto relative">
                    <button
                      type="button"
                      aria-label="더보기"
                      className="w-7 h-7 flex items-center justify-center text-[#9CA3AF]"
                      onClick={() => setOpenMenuId((v) => (v === q.id ? null : q.id))}
                    >
                      ⋮
                    </button>
                    {openMenuId === q.id && (
                      <div
                        role="menu"
                        className="absolute top-full right-0 mt-1 z-30 min-w-[100px] bg-white rounded-[10px] border border-[#E5E7EB] shadow-[0_8px_20px_rgba(16,24,40,0.10)] py-1"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => openEdit(q)}
                          className="w-full px-4 py-2 text-left text-[14px] text-[#030712] hover:bg-[#F9FAFB]"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => { setOpenMenuId(null); setDeleteTarget(q) }}
                          className="w-full px-4 py-2 text-left text-[14px] text-[#FB2C36] hover:bg-[#FEEBEE]"
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span
                  className={
                    q.status === '답변완료'
                      ? 'h-[24px] px-2 inline-flex items-center rounded text-[12px] font-medium bg-[#fdf2f8] text-[#ec4899]'
                      : 'h-[24px] px-2 inline-flex items-center rounded text-[12px] font-medium bg-[#F3F4F6] text-[#6A7282]'
                  }
                >
                  {q.status}
                </span>
                {q.is_secret && (
                  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" aria-hidden>
                    <rect x="5" y="11" width="14" height="9" rx="2" stroke="#030712" strokeWidth="1.6" />
                    <path d="M8 11V8a4 4 0 018 0v3" stroke="#030712" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                )}
                <span className="text-[15px] font-semibold text-[#030712] truncate">{q.title}</span>
              </div>

              {q.content && (
                <p className="mt-1 text-[14px] text-[#6A7282] line-clamp-2 whitespace-pre-line">
                  {q.content}
                </p>
              )}
              <p className="mt-2 text-[12px] text-[#99A1AF]">
                {q.reviewer_name} · {formatDate(q.created_at)}
              </p>
            </article>
          ))
        )}
      </main>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="문의 삭제"
        message="문의를 삭제하시겠습니까?"
        subMessage="삭제 후 복구할 수 없습니다."
        actionLabel="삭제"
        actionClassName="bg-[#FB2C36] text-white hover:bg-[#E0192A]"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* 수정 모달 */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) setEditTarget(null) }}>
          <div className="w-full max-w-[600px] bg-white rounded-t-[20px] px-4 pt-5 pb-8">
            <h2 className="text-[17px] font-semibold text-[#030712] mb-4">문의 수정</h2>
            <div className="mb-3">
              <label className="block text-[13px] font-medium text-[#4A5565] mb-1">제목</label>
              <input
                className="input-field w-full"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={255}
              />
            </div>
            <div className="mb-4">
              <label className="block text-[13px] font-medium text-[#4A5565] mb-1">내용</label>
              <textarea
                className="textarea-field w-full min-h-[120px]"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
            </div>
            {editError && (
              <p className="mb-3 text-[13px] text-[#FB2C36]">{editError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="btn btn-outline-gray btn--base flex-1"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submitEdit}
                disabled={saving}
                className="btn btn-primary btn--base flex-1"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-[100px] left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-[#1E2939] text-white text-[13px] rounded-[20px] shadow-md whitespace-nowrap">
          {toast}
        </div>
      )}

      <FloatingActions bottomOffset={24} />
      <BottomNav />
    </div>
  )
}
