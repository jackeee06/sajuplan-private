import { useEffect, useState } from 'react'
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
          className="h-10 rounded-full bg-white border border-[#9B7AF7] text-[#8259F5] text-[14px] font-medium flex items-center justify-center gap-1 transition hover:bg-[#F3EEFE]"
        >
          <PencilLineIcon />
          문의 작성하기
        </Link>
      </div>

      {/* 카운터 */}
      <div className="px-0 pb-3 flex items-center border-b border-[#F3F4F6]">
        <p className="text-[15px] leading-[130%] text-[#4A5565]">
          전체 <span className="font-medium text-[#8259F5]">{data.qnaTotal}</span>건
        </p>
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

function QnaCard({ qna, counselorId }: { qna: PublicCounselorQnaItem; counselorId: string }) {
  const { id, status, title, content, is_secret, reviewer_name, created_at } = qna
  const statusActive = status === '답변완료'
  const dateText = formatDate(created_at)

  return (
    <Link
      to={`/counselors/${counselorId}/qna/${id}`}
      className="block px-0 py-4 flex flex-col gap-2 border-b border-[#F3F4F6] hover:bg-[#F9FAFB]/40 transition"
    >
      {/* 뱃지 + 제목 */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          <span
            className={`inline-flex items-center px-2 py-[3px] rounded-full text-[12px] leading-[110%] font-medium shrink-0 ${
              statusActive ? 'bg-[#F3EEFE] text-[#8259F5]' : 'bg-[#F3F4F6] text-[#6A7282]'
            }`}
          >
            {status}
          </span>
          {is_secret && <LockIcon />}
          <h3 className="text-[16px] leading-[130%] font-medium text-[#1E2939] truncate">
            {title}
          </h3>
        </div>
      </div>

      {/* 본문 */}
      <p className="text-[14px] leading-[150%] text-[#6A7282] line-clamp-2 whitespace-pre-line">
        {is_secret && !content ? '비밀 문의입니다.' : content}
      </p>

      {/* 작성자 · 날짜 */}
      <div className="flex items-center gap-1 text-[13px] leading-[130%] text-[#99A1AF]">
        <span>{reviewer_name}</span>
        <span aria-hidden>∙</span>
        <span>{dateText}</span>
      </div>
    </Link>
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
      <path d="M11.5 2.5l2 2-7 7H4.5v-2l7-7z" stroke="#8259F5" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M2.5 14h11" stroke="#8259F5" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
