import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import { counselorInquiryApi, type CounselorInquiryDetailDto } from '../lib/api'
import { FILE_BASE } from '../lib/runtime-env'

/**
 * 08마이페이지_상담사_문의하기 상세 (상담사 → 운영자 1:1 고객센터 문의)
 * Figma node-id: 179:15850
 *
 * 상태칩 / 카테고리 + 제목 / 날짜 / 본문 + 첨부사진 / 운영팀 답변
 */
export default function CounselorMyQnaDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [qna, setQna] = useState<CounselorInquiryDetailDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewer, setViewer] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [deleting, setDeleting] = useState(false)

  // 본인 문의 삭제 (소프트 삭제). 성공 시 목록으로.
  const handleDelete = () => {
    if (!id || deleting) return
    if (!window.confirm('이 문의를 삭제할까요? 삭제하면 목록에서 사라집니다.')) return
    setDeleting(true)
    counselorInquiryApi
      .remove(id)
      .then(() => navigate('/counselor/mypage/qnas'))
      .catch((e) => {
        alert(e instanceof Error ? e.message : '삭제에 실패했어요.')
        setDeleting(false)
      })
  }

  const openViewer = (src: string) => {
    setZoom(1)
    setViewer(src)
  }
  const closeViewer = () => {
    setZoom(1)
    setViewer(null)
  }

  useEffect(() => {
    if (!id) return
    let alive = true
    setLoading(true)
    setError('')
    counselorInquiryApi
      .detail(id)
      .then((res) => alive && setQna(res))
      .catch((e) => alive && setError(e instanceof Error ? e.message : '문의를 불러오지 못했어요.'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [id])

  const resolveImg = (u: string) => (u.startsWith('/') ? `${FILE_BASE}${u}` : u)

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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">문의하기</h1>
        {qna && !loading && !error && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            aria-label="문의 삭제"
            className="w-[30px] h-[30px] flex items-center justify-center text-[#C0C4CC] hover:text-[#FF6467] disabled:opacity-40"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </button>
        )}
      </header>

      <main className="flex-1 px-4 pt-2">
        {loading ? (
          <p className="py-10 text-center text-[14px] text-[#99A1AF]">불러오는 중…</p>
        ) : error || !qna ? (
          <p className="py-10 text-center text-[14px] text-[#FF6467]">{error || '문의를 찾을 수 없습니다.'}</p>
        ) : (
          <>
            <span
              className={`inline-flex items-center h-[22px] px-2 rounded-full text-[12px] leading-none font-medium ${
                qna.status === 'answered'
                  ? 'bg-[#f3f0ff] text-[#8259F5]'
                  : 'bg-[#F3F4F6] text-[#6A7282]'
              }`}
            >
              {qna.status === 'answered' ? '답변완료' : '답변대기'}
            </span>

            <div className="mt-2">
              <h2 className="text-[18px] font-bold leading-[140%] break-keep">
                <span className="text-[#8259F5] mr-1">{qna.category}</span>
                <span className="text-[#030712]">{qna.title}</span>
              </h2>
            </div>

            <p className="mt-1 text-[13px] leading-[140%] text-[#99A1AF]">{formatDateTime(qna.created_at)}</p>

            <p className="mt-4 text-[15px] leading-[160%] text-[#1E2939] whitespace-pre-line">
              {qna.content}
            </p>

            {qna.photos.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {qna.photos.map((p, idx) => (
                  <button
                    key={`${p}-${idx}`}
                    type="button"
                    onClick={() => openViewer(resolveImg(p))}
                    aria-label={`첨부 ${idx + 1} 크게 보기`}
                    className="w-[88px] h-[88px] rounded-[12px] overflow-hidden bg-[#F3F4F6] block"
                  >
                    <img src={resolveImg(p)} alt={`첨부 ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            <div className="mt-6 border-t border-[#F3F4F6]" />

            <p className="mt-4 text-[14px] font-semibold text-[#1E2939]">
              답변 <span className="text-[#8259F5]">{qna.status === 'answered' ? 1 : 0}</span>건
            </p>

            {qna.status === 'answered' && qna.reply_content ? (
              <div className="mt-3 py-4 rounded-[12px] bg-[#FAF8FF] px-4">
                <p className="text-[15px] leading-[160%] text-[#1E2939] whitespace-pre-line">
                  {qna.reply_content}
                </p>
                <p className="mt-2 text-[13px] leading-[140%] text-[#99A1AF]">
                  {qna.reply_admin_name ?? '사주플랜 운영팀'}
                  {qna.replied_at ? ` · ${formatDateTime(qna.replied_at)}` : ''}
                </p>
              </div>
            ) : (
              <p className="mt-3 py-8 text-center text-[14px] text-[#99A1AF]">
                아직 답변이 등록되지 않았습니다.
              </p>
            )}

            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => navigate('/counselor/mypage/qnas')}
                className="h-10 px-6 rounded-full border border-[#8259F5] text-[14px] font-medium text-[#8259F5]"
              >
                목록으로
              </button>
            </div>
          </>
        )}
      </main>

      <FloatingActions bottomOffset={24} />
      <BottomNav myHref="/counselor/mypage" />

      {/* 첨부 사진 전체화면 뷰어 (앱 WebView 안전 — 새 창 안 씀)
          확대: 사진 탭(1→2→3배) 또는 하단 +/− 버튼. 확대 상태에선 드래그로 이동(스크롤). */}
      {viewer && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 overflow-auto"
          onClick={closeViewer}
          role="dialog"
          aria-label="첨부 사진 보기"
        >
          <div className="min-h-full min-w-full flex items-center justify-center">
            <img
              src={viewer}
              alt="첨부 사진"
              draggable={false}
              onClick={(e) => {
                e.stopPropagation()
                setZoom((z) => (z >= 3 ? 1 : z + 1))
              }}
              className="object-contain select-none"
              style={
                zoom === 1
                  ? { maxWidth: '94vw', maxHeight: '88vh' }
                  : { width: `${zoom * 92}vw`, maxWidth: 'none', height: 'auto' }
              }
            />
          </div>

          {/* 닫기 */}
          <button
            type="button"
            onClick={closeViewer}
            aria-label="닫기"
            className="fixed top-4 right-4 w-10 h-10 rounded-full bg-white/15 flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" aria-hidden>
              <path d="M6 6L18 18M18 6L6 18" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          {/* 확대/축소 컨트롤 */}
          <div
            className="fixed left-1/2 -translate-x-1/2 bottom-6 flex items-center gap-1 bg-white/15 rounded-full px-2 py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="축소"
              onClick={() => setZoom((z) => Math.max(1, z - 1))}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[22px] leading-none disabled:opacity-40"
              disabled={zoom <= 1}
            >
              −
            </button>
            <span className="min-w-[44px] text-center text-white text-[14px] font-medium tabular-nums">{zoom}배</span>
            <button
              type="button"
              aria-label="확대"
              onClick={() => setZoom((z) => Math.min(3, z + 1))}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[22px] leading-none disabled:opacity-40"
              disabled={zoom >= 3}
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}.${m}.${day} ${hh}:${mm}`
}
