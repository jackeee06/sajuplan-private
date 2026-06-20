import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import ConfirmModal from '../components/ConfirmModal'
import { useAuth } from '../lib/auth-context'
import { supportInquiryApi, type SupportInquiryDetailDto } from '../lib/api'

function formatDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${y}.${m}.${dd} ${hh}:${mi}`
}

/** 고객센터 1:1 문의 상세 + 운영팀 답변. 라우트: /mypage/support-inquiries/:id */
export default function SupportInquiryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { member, loading: authLoading } = useAuth()
  const [data, setData] = useState<SupportInquiryDetailDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (authLoading || !member || !id) return
    let mounted = true
    setLoading(true)
    supportInquiryApi
      .detail(id)
      .then((res) => {
        if (mounted) setData(res)
      })
      .catch((e) => {
        if (mounted) setError((e as Error).message || '문의를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [authLoading, member, id, reload])

  const openEdit = () => {
    if (!data) return
    setEditTitle(data.title)
    setEditContent(data.content)
    setEditError(null)
    setEditing(true)
  }

  const submitEdit = async () => {
    if (!data) return
    const title = editTitle.trim()
    const content = editContent.trim()
    if (!title) {
      setEditError('제목을 입력해주세요.')
      return
    }
    if (!content) {
      setEditError('내용을 입력해주세요.')
      return
    }
    setSaving(true)
    setEditError(null)
    try {
      await supportInquiryApi.update(data.id, { title, content })
      setEditing(false)
      setReload((x) => x + 1)
    } catch (e) {
      setEditError(e instanceof Error ? e.message : '수정에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!data) return
    setDeleting(true)
    try {
      await supportInquiryApi.remove(data.id)
      navigate('/mypage/support-inquiries', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제에 실패했습니다.')
      setDeleteOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="mobile-frame flex flex-col pb-[100px] items-center justify-center min-h-[60vh]">
        <p className="text-[14px] text-[#6A7282]">불러오는 중...</p>
      </div>
    )
  }
  if (!member) return <Navigate to={`/login?redirect=/mypage/support-inquiries/${id}`} replace />

  return (
    <div className="mobile-frame flex flex-col pb-[100px]">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate('/mypage/support-inquiries')}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">문의 상세</h1>
      </header>

      <main className="flex-1 px-4 pt-3">
        {loading ? (
          <p className="py-10 text-center text-[14px] text-[#6A7282]">불러오는 중...</p>
        ) : error ? (
          <p className="py-10 text-center text-[14px] text-[#E84263]">{error}</p>
        ) : !data ? (
          <p className="py-10 text-center text-[14px] text-[#6A7282]">문의를 찾을 수 없습니다.</p>
        ) : (
          <>
            {/* 문의 본문 */}
            <div className="flex items-center gap-1.5">
              {data.category && (
                <span className="px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[11px] text-[#6A7282]">
                  {data.category}
                </span>
              )}
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                  data.has_reply ? 'bg-[#fdf2f8] text-[#ec4899]' : 'bg-[#F3F4F6] text-[#99A1AF]'
                }`}
              >
                {data.status}
              </span>
            </div>
            <h2 className="mt-2 text-[17px] font-bold text-[#030712] break-keep">{data.title}</h2>
            <p className="mt-1 text-[12px] text-[#99A1AF]">{formatDateTime(data.created_at)}</p>
            <p className="mt-3 text-[15px] leading-[160%] text-[#1E2939] whitespace-pre-line">{data.content}</p>

            {/* 운영팀 답변 */}
            {data.reply ? (
              <div className="mt-6 rounded-[16px] bg-[#fdf2f8] p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] font-semibold text-[#ec4899]">운영팀 답변</span>
                  <span className="text-[12px] text-[#C77DAE]">{formatDateTime(data.reply.replied_at)}</span>
                </div>
                <p className="text-[14px] leading-[160%] text-[#4A5565] whitespace-pre-line">{data.reply.content}</p>
              </div>
            ) : (
              <>
                <div className="mt-6 rounded-[16px] bg-[#F9FAFB] p-4 text-center">
                  <p className="text-[14px] text-[#6A7282]">운영팀이 확인 중입니다. 답변이 등록되면 알림으로 알려드려요.</p>
                </div>
                {/* 답변 전: 수정 / 삭제 */}
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={openEdit} className="btn btn-outline-gray btn--base flex-1">
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    className="btn btn-outline-gray btn--base flex-1 text-[#FB2C36]"
                  >
                    삭제
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </main>

      <ConfirmModal
        open={deleteOpen}
        message="문의를 삭제하시겠습니까?"
        subMessage="삭제 후 복구할 수 없습니다."
        actionLabel={deleting ? '삭제 중...' : '삭제'}
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />

      {/* 수정 모달 */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditing(false)
          }}
        >
          <div className="w-full max-w-[600px] bg-white rounded-t-[20px] px-4 pt-5 pb-8">
            <h2 className="text-[17px] font-semibold text-[#030712] mb-4">문의 수정</h2>
            <div className="mb-3">
              <label className="block text-[13px] font-medium text-[#4A5565] mb-1">제목</label>
              <input
                className="w-full px-3 py-2.5 text-[15px] text-[#030712] border border-[#D1D5DB] rounded-[10px] bg-[#F9FAFB] focus:outline-none focus:border-[#9b7af7] focus:bg-white"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={255}
              />
            </div>
            <div className="mb-4">
              <label className="block text-[13px] font-medium text-[#4A5565] mb-1">내용</label>
              <textarea
                className="w-full px-3 py-2.5 text-[15px] text-[#030712] border border-[#D1D5DB] rounded-[10px] bg-[#F9FAFB] focus:outline-none focus:border-[#9b7af7] focus:bg-white min-h-[120px] resize-none"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
            </div>
            {editError && <p className="mb-3 text-[13px] text-[#FB2C36]">{editError}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(false)} className="btn btn-outline-gray btn--base flex-1">
                취소
              </button>
              <button type="button" onClick={submitEdit} disabled={saving} className="btn btn-primary btn--base flex-1">
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
