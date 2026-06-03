import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import CounselorDetailLayout from '../components/CounselorDetailLayout'
import type { Badge, CounselorDetailData } from '../data/counselorDetails'
import {
  ApiError,
  counselorQnaApi,
  counselorsApi,
  type PublicCounselorDetail,
  type PublicCounselorQnaItem,
} from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { FILE_BASE } from '../lib/runtime-env'

function resolveImageUrl(u: string | null): string {
  if (!u) return '/img/sample_img01.jpg'
  if (/^https?:\/\//.test(u)) return u
  if (u.startsWith('/')) return `${FILE_BASE}${u}`
  return u
}

function mapDetail(r: PublicCounselorDetail, qnaTotal: number): CounselorDetailData {
  const badge: Badge = (r.category === '기타' ? '사주' : r.category) as Badge
  return {
    id: r.id,
    badge,
    name: r.nickname || r.name,
    code: r.dtmfno ?? r.csrid ?? String(r.id).padStart(6, '0'),
    tagline: r.headline ?? '',
    hashtags: r.hashtags,
    pricePerHalfMin: r.unit_cost ?? 0,
    likeCount: r.fan_count > 999 ? '999+' : String(r.fan_count),
    liked: r.is_liked,
    heroImg: resolveImageUrl(r.hero_image),
    heroImgWebp: r.hero_image_webp ? resolveImageUrl(r.hero_image_webp) : null,
    fields: r.fields.length > 0 ? r.fields : ['전문 상담'],
    styles: r.traits.length > 0 ? r.traits : ['친절한'],
    career: r.career.length > 0 ? r.career : ['상담사 약력 준비 중입니다.'],
    noticeDate: formatDate(r.notice_date),
    noticeContent: r.notice_content ?? '아직 등록된 공지가 없습니다.',
    introText: r.intro ?? '상담사 소개가 준비 중입니다.',
    liveViewers: r.live_viewers,
    reviewTotal: r.review_count.toLocaleString(),
    qnaTotal: qnaTotal.toLocaleString(),
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

/**
 * 상담사 상세 — 문의 탭 (Figma 92:4694)
 * 라우트: /counselors/:id/qna
 *
 * 백엔드 연동:
 *   GET /user/counselors/:id            → 상담사 정보
 *   GET /user/counselors/:id/qna        → 문의 목록 + 총 건수
 */
export default function CounselorQna() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<CounselorDetailData | null>(null)
  const [qnas, setQnas] = useState<PublicCounselorQnaItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) {
      setError('상담사 ID가 없습니다.')
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    setError(null)

    Promise.all([counselorsApi.detail(id), counselorQnaApi.list(id, { limit: 20 })])
      .then(([detail, q]) => {
        if (!alive) return
        setData(mapDetail(detail, q.total))
        setQnas(q.items)
      })
      .catch((e) => {
        if (!alive) return
        if (e instanceof ApiError && e.status === 404) {
          setError('해당 상담사를 찾을 수 없습니다.')
        } else {
          setError(e instanceof Error ? e.message : '상담사 정보를 불러오지 못했습니다.')
        }
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [id])

  if (loading) {
    return (
      <div className="mobile-frame flex flex-col">
        <div className="w-full h-[192px] bg-[#F3F4F6] animate-pulse" />
        <div className="px-4 py-6 flex flex-col gap-4">
          <div className="h-5 w-1/2 bg-[#F3F4F6] animate-pulse rounded" />
          <div className="h-4 w-2/3 bg-[#F3F4F6] animate-pulse rounded" />
          <div className="h-4 w-1/3 bg-[#F3F4F6] animate-pulse rounded" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mobile-frame flex flex-col items-center justify-center min-h-screen px-6 text-center gap-4">
        <p className="text-[15px] text-[#4A5565]">{error ?? '상담사 정보를 불러올 수 없습니다.'}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="h-10 px-5 rounded-full border border-[#E5E7EB] text-[14px] text-[#364153]"
        >
          뒤로 가기
        </button>
      </div>
    )
  }

  return (
    <CounselorDetailLayout data={data} activeTab="qna">
      <div className="flex flex-col gap-3">
        {/* 안내 카드 */}
        <article className="bg-[#F9FAFB] rounded-[12px] p-4 flex flex-col gap-2">
          <img src="/img/review_visual_img.png" alt="" className="w-[46px] h-auto" />
          <p className="text-[14px] leading-[130%] text-[#4A5565]">
            문의 시 전화번호, SNS 등의 개인정보를 남기실 시 이용이 제한될 수 있습니다.
          </p>
          <a
            href="#"
            className="inline-flex items-center gap-1 text-[14px] leading-[130%] font-medium text-[#4A5565]"
          >
            상담문의 운영정책
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
              <path d="M6 4L10 8L6 12" stroke="#4A5565" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </article>

        {/* 문의 작성하기 — outline-primary */}
        <Link
          to={`/counselors/${id}/qna/new`}
          className="h-10 rounded-full bg-white border border-[#f472b6] text-[#ec4899] text-[14px] font-medium flex items-center justify-center gap-1 transition hover:bg-[#fdf2f8]"
        >
          <PencilLineIcon />
          문의 작성하기
        </Link>
      </div>

      {/* 카운터 + 나의 문의 */}
      <div className="px-0 pb-3 flex items-center justify-between border-b border-[#F3F4F6]">
        <p className="text-[15px] leading-[130%] text-[#4A5565]">
          전체 <span className="font-medium text-[#ec4899]">{data.qnaTotal}</span>건
        </p>
        <Link
          to="/mypage/my-qnas"
          className="flex items-center gap-1 text-[13px] text-[#6A7282]"
        >
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
          qnas.map((q) => <QnaCard key={q.id} qna={q} counselorId={id ?? ''} />)
        )}
      </section>
    </CounselorDetailLayout>
  )
}

/* ───────────── 문의 카드 ───────────── */

const REPORT_REASONS = ['욕설·비하', '스팸·광고', '허위 정보', '음란·성적', '개인정보 노출', '기타']

function QnaCard({ qna, counselorId }: { qna: PublicCounselorQnaItem; counselorId: string }) {
  const { id, status, title, content, is_secret, reviewer_name, created_at } = qna
  const { member } = useAuth()
  const hasReply = status === '답변완료'
  const dateText = formatDate(created_at)
  const bodyText = is_secret ? null : (content || title)
  const [reported, setReported] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [selectedReason, setSelectedReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const openReport = (e: React.MouseEvent) => {
    e.preventDefault()
    if (reported) return
    setSelectedReason('')
    setCustomReason('')
    setReportOpen(true)
  }

  const submitReport = async () => {
    const reason = selectedReason === '기타' ? (customReason.trim() || '기타') : selectedReason
    if (!reason) return
    setSubmitting(true)
    try {
      await counselorQnaApi.report(counselorId, id, reason)
      setReported(true)
      setReportOpen(false)
    } catch {
      setReported(true)
      setReportOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Link
        to={`/counselors/${counselorId}/qna/${id}`}
        className="block px-0 py-4 border-b border-[#F3F4F6] transition"
      >
        {/* 작성자 · 날짜 · 신고 */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-medium text-[#364153]">{reviewer_name}</span>
            <span className="text-[12px] text-[#99A1AF]">{dateText}</span>
          </div>
          {/* 공개글 + 로그인 상태일 때만 신고 버튼 노출 */}
          {!is_secret && member && (
            <button
              type="button"
              onClick={openReport}
              className="text-[12px] text-[#99A1AF] shrink-0"
            >
              {reported ? '신고됨' : '신고하기'}
            </button>
          )}
        </div>

        {/* 내용 */}
        {is_secret ? (
          <p className="text-[14px] text-[#99A1AF] flex items-center gap-1">
            비밀글입니다. <LockIcon />
          </p>
        ) : (
          <p className="text-[14px] leading-[150%] text-[#6A7282] line-clamp-2 whitespace-pre-line">
            {bodyText}
          </p>
        )}

        {/* 답변완료 — 핑크 박스 */}
        {hasReply && (
          <div className="mt-2 bg-[#fdf2f8] rounded-[8px] px-3 py-2">
            <p className="text-[13px] text-[#ec4899] font-medium">답변이 달렸습니다.</p>
          </div>
        )}
      </Link>

      {/* 신고 이유 바텀시트 */}
      {reportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setReportOpen(false) }}
        >
          <div className="w-full max-w-[600px] bg-white rounded-t-[20px] px-4 pt-5 pb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[17px] font-semibold text-[#030712]">신고 이유를 선택해주세요</h2>
              <button type="button" onClick={() => setReportOpen(false)} className="text-[#99A1AF] p-1">
                <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none">
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedReason(r)}
                  className={`px-3 py-2 rounded-full text-[14px] border transition ${
                    selectedReason === r
                      ? 'bg-[#fdf2f8] border-[#f472b6] text-[#ec4899] font-medium'
                      : 'bg-[#F9FAFB] border-[#F3F4F6] text-[#6A7282]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {selectedReason === '기타' && (
              <textarea
                className="w-full px-3 py-2.5 text-[14px] border border-[#D1D5DB] rounded-[10px] bg-[#F9FAFB] focus:outline-none focus:border-[#9b7af7] min-h-[80px] resize-none mb-4"
                placeholder="신고 이유를 직접 입력해주세요 (선택)"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                maxLength={200}
              />
            )}

            <button
              type="button"
              disabled={!selectedReason || submitting}
              onClick={submitReport}
              className="w-full h-[52px] rounded-[14px] bg-[#ec4899] text-white text-[16px] font-semibold disabled:opacity-40"
            >
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
