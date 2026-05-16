import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CounselorDetailLayout from '../components/CounselorDetailLayout'
import type { Badge, CounselorDetailData } from '../data/counselorDetails'
import { counselorsApi, type PublicCounselorDetail, ApiError } from '../lib/api'
import { FILE_BASE } from '../lib/runtime-env'

function resolveImageUrl(u: string | null): string {
  if (!u) return '/img/sample_img01.jpg'
  if (/^https?:\/\//.test(u)) return u
  if (u.startsWith('/')) return `${FILE_BASE}${u}`
  return u
}

/** 백엔드 PublicCounselorDetail → CounselorDetailLayout 이 받는 CounselorDetailData 어댑터 */
function mapDetail(r: PublicCounselorDetail): CounselorDetailData {
  // category '기타' 면 기본 뱃지 '사주' 로 폴백 (BADGE_BG 의 키 외엔 아직 정의 안 됨)
  const badge: Badge = (r.category === '기타' ? '사주' : r.category) as Badge

  return {
    id: r.id,
    badge,
    name: r.nickname || r.name,
    code: r.dtmfno || r.csrid || String(r.id).padStart(6, '0'),
    tagline: r.headline ?? '',
    hashtags: r.hashtags,
    pricePerHalfMin: r.unit_cost ?? 0,
    likeCount: r.fan_count > 999 ? '999+' : String(r.fan_count),
    liked: r.is_liked,
    heroImg: resolveImageUrl(r.hero_image),
    heroImgWebp: r.hero_image_webp ? resolveImageUrl(r.hero_image_webp) : null,
    wideHeadline: r.wide_headline ?? null,
    wideSubcaption: r.wide_subcaption ?? null,
    fields: r.fields.length > 0 ? r.fields : ['전문 상담'],
    styles: r.traits.length > 0 ? r.traits : ['친절한'],
    career: r.career.length > 0 ? r.career : ['상담사 약력 준비 중입니다.'],
    noticeDate: formatNoticeDate(r.notice_date),
    noticeContent: r.notice_content ?? '아직 등록된 공지가 없습니다.',
    introText: r.intro ?? '상담사 소개가 준비 중입니다.',
    liveViewers: r.live_viewers,
    reviewTotal: r.review_count.toLocaleString(),
    qnaTotal: '0',
  }
}

function formatNoticeDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

/**
 * 상담사 상세 — 소개 탭. 라우트: /counselors/:id
 * 백엔드 GET /api/user/counselors/:id 에서 풀 정보 fetch.
 */
export default function CounselorDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<CounselorDetailData | null>(null)
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
    counselorsApi
      .detail(id)
      .then((r) => {
        if (alive) setData(mapDetail(r))
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
    <CounselorDetailLayout data={data} activeTab="intro">
      <p className="text-[14px] leading-[140%] text-[#4A5565] whitespace-pre-line">
        {data.introText}
      </p>
    </CounselorDetailLayout>
  )
}
