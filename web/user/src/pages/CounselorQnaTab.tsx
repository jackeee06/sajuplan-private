import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { counselorQnaApi, type PublicCounselorQnaItem } from '../lib/api'
import { useAuth } from '../lib/auth-context'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

const REPORT_REASONS = ['욕설·비하', '스팸·광고', '허위 정보', '음란·성적', '개인정보 노출', '기타']

/** 상담사 상세 — 문의 탭 내용 (레이아웃 없이 content만) */
export default function CounselorQnaTab({ counselorId }: { counselorId: string }) {
  const [qnas, setQnas] = useState<PublicCounselorQnaItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!counselorId) return
    let alive = true
    setLoading(true)
    counselorQnaApi.list(counselorId, { limit: 20 })
      .then((q) => {
        if (!alive) return
        setQnas(q.items)
        setTotal(q.total)
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [counselorId])

  if (loading) {
    return (
      <div className="flex flex-col gap-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-[#F3F4F6] rounded-[8px]" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 안내 카드 */}
      <article className="bg-[#F9FAFB] rounded-[12px] p-4 flex flex-col gap-2">
        <img src="/img/review_visual_img.png" alt="" className="w-[46px] h-auto" />
        <p className="text-[14px] leading-[130%] text-[#4A5565]">
          문의 시 전화번호, SNS 등의 개인정보를 남기실 시 이용이 제한될 수 있습니다.
        </p>
        <a href="#" className="inline-flex items-center gap-1 text-[14px] leading-[130%] font-medium text-[#4A5565]">
          상담문의 운영정책
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
            <path d="M6 4L10 8L6 12" stroke="#4A5565" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </article>

      <Link
        to={`/counselors/${counselorId}/qna/new`}
        className="h-10 rounded-full bg-white border border-[#f472b6] text-[#ec4899] text-[14px] font-medium flex items-center justify-center gap-1 transition hover:bg-[#fdf2f8]"
      >
        <PencilLineIcon />
        문의 작성하기
      </Link>

      {/* 카운터 + 나의 문의 */}
      <div className="px-0 pb-3 flex items-center justify-between border-b border-[#F3F4F6]">
        <p className="text-[15px] leading-[130%] text-[#4A5565]">
          전체 <span className="font-medium text-[#ec4899]">{total.toLocaleString()}</span>건
        </p>
        <Link to="/mypage/my-qnas" className="flex items-center gap-1 text-[13px] text-[#6A7282]">
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
            <path d="M13 3H3a1 1 0 00-1 1v8a1 1 0 001 1h10a1 1 0 001-1V4a1 1 0 00-1-1z" stroke="#6A7282" strokeWidth="1.3" />
            <path d="M5 7h6M5 10h4" stroke="#6A7282" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          나의 문의
        </Link>
      </div>

      {/* 문의 카드 리스트 */}
      <section className="flex flex-col -mt-2">
        {qnas.length === 0 ? (
          <p className="text-center text-[14px] text-[#99A1AF] py-10">아직 문의가 없습니다.</p>
        ) : (
          qnas.map((q) => (
            <QnaCard key={q.id} qna={q} counselorId={counselorId} onReported={(msg) => setToast(msg)} />
          ))
        )}
      </section>

      {toast && (
        <div className="fixed bottom-[100px] left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-[#1E2939] text-white text-[13px] rounded-[20px] shadow-md whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  )
}

function QnaCard({ qna, counselorId, onReported }: { qna: PublicCounselorQnaItem; counselorId: string; onReported: (msg: string) => void }) {
  const { id, status, title, content, is_secret, reviewer_name, created_at, is_mine } = qna
  const { member } = useAuth()
  const hasReply = status === '답변완료'
  const bodyText = (is_secret && !is_mine) ? null : (content || title)
  const [reported, setReported] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [selectedReason, setSelectedReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const openReport = (e: React.MouseEvent) => {
    e.preventDefault()
    if (reported) return
    setSelectedReason(''); setCustomReason(''); setReportOpen(true)
  }

  const submitReport = async () => {
    const reason = selectedReason === '기타' ? (customReason.trim() || '기타') : selectedReason
    if (!reason) return
    setSubmitting(true)
    try {
      await counselorQnaApi.report(counselorId, id, reason)
      setReported(true); setReportOpen(false); onReported('신고가 접수되었습니다.')
    } catch (e) {
      setReportOpen(false)
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('이미 신고')) { setReported(true); onReported('이미 신고한 문의입니다.') }
      else onReported('신고 중 오류가 발생했습니다.')
    } finally { setSubmitting(false) }
  }

  return (
    <>
      <Link to={`/counselors/${counselorId}/qna/${id}`} className="block px-0 py-4 border-b border-[#F3F4F6] transition">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-medium text-[#364153]">{reviewer_name}</span>
            <span className="text-[12px] text-[#99A1AF]">{formatDate(created_at)}</span>
          </div>
          {!is_secret && member && (
            <button type="button" onClick={openReport} className="text-[12px] text-[#99A1AF] shrink-0">
              {reported ? '신고됨' : '신고하기'}
            </button>
          )}
        </div>

        {is_secret && !is_mine ? (
          <p className="text-[14px] text-[#99A1AF] flex items-center gap-1">비밀글입니다. <LockIcon /></p>
        ) : (
          <p className="text-[14px] leading-[150%] text-[#6A7282] line-clamp-2 whitespace-pre-line">{bodyText}</p>
        )}

        {hasReply && (
          <div className="mt-2 bg-[#fdf2f8] rounded-[8px] px-3 py-2">
            <p className="text-[13px] text-[#ec4899] font-medium">답변이 달렸습니다.</p>
          </div>
        )}
      </Link>

      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) setReportOpen(false) }}>
          <div className="w-full max-w-[600px] bg-white rounded-t-[20px] px-4 pt-5 pb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[17px] font-semibold text-[#030712]">신고 이유를 선택해주세요</h2>
              <button type="button" onClick={() => setReportOpen(false)} className="text-[#99A1AF] p-1">
                <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {REPORT_REASONS.map((r) => (
                <button key={r} type="button" onClick={() => setSelectedReason(r)}
                  className={`px-3 py-2 rounded-full text-[14px] border transition ${selectedReason === r ? 'bg-[#fdf2f8] border-[#f472b6] text-[#ec4899] font-medium' : 'bg-[#F9FAFB] border-[#F3F4F6] text-[#6A7282]'}`}>
                  {r}
                </button>
              ))}
            </div>
            {selectedReason === '기타' && (
              <textarea className="w-full px-3 py-2.5 text-[14px] border border-[#D1D5DB] rounded-[10px] bg-[#F9FAFB] focus:outline-none focus:border-[#9b7af7] min-h-[80px] resize-none mb-4"
                placeholder="신고 이유를 직접 입력해주세요 (선택)" value={customReason}
                onChange={(e) => setCustomReason(e.target.value)} maxLength={200} />
            )}
            <button type="button" disabled={!selectedReason || submitting} onClick={submitReport}
              className="w-full h-[52px] rounded-[14px] bg-[#ec4899] text-white text-[16px] font-semibold disabled:opacity-40">
              {submitting ? '신고 중...' : '신고하기'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4 shrink-0" fill="none" aria-hidden>
      <rect x="3" y="7" width="10" height="6.5" rx="1.3" stroke="#1E2939" strokeWidth="1.4" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="#1E2939" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function PencilLineIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
      <path d="M11.5 2.5l2 2-7 7H4.5v-2l7-7z" stroke="#ec4899" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M2.5 14h11" stroke="#ec4899" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
