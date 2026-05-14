import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import FloatingActions from '../components/FloatingActions'
import UploadedImage from '../components/UploadedImage'
import { ApiError, counselorQnaApi, type PublicCounselorQnaDetail } from '../lib/api'
import { FILE_BASE } from '../lib/runtime-env'

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
                {qna.is_secret && !qna.content ? '비밀 문의입니다.' : qna.content}
              </p>
            </div>

            <ReplySection qna={qna} className="mt-6" />

            {/* 목록으로 — 가운데 정렬 */}
            <div className="px-4 mt-10 flex justify-center">
              <Link
                to={`/counselors/${id}/qna`}
                className="inline-flex items-center justify-center w-[120px] h-10 px-4 rounded-full bg-white border border-[#9B7AF7] text-[#8259F5] text-[14px] font-medium"
              >
                목록으로
              </Link>
            </div>
          </>
        )}
      </main>

      <FloatingActions bottomOffset={16} showKakao={false} />
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
          <span className="font-medium text-[#8259F5]">{reply ? 1 : 0}</span>건
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
          <div className="w-[60px] h-[60px] rounded-full bg-[#F3EEFE] flex items-center justify-center">
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
        stroke="#9B7AF7"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
