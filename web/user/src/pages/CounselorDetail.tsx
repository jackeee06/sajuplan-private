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

/**
 * 상담사 소개 HTML 안전 처리 — Toast UI 에디터 본문을 그대로 렌더하기 전에 위험 태그/속성 제거.
 *  - <script>, <iframe>, <object>, <embed>, <link>, <style>, <meta>, <base> 태그 통째 제거
 *  - on* 이벤트 핸들러 속성 제거 (onclick, onerror, onload ...)
 *  - javascript:/data: URL 스킴 차단 (href, src)
 * 100% sanitizer 는 아니지만 신청 단계의 운영자 승인 + Toast UI 자체 필터와 결합해 실용적으로 안전.
 * 비어있으면 빈 문자열 반환 → 호출처에서 빈 안내 분기.
 */
function sanitizeIntroHtml(raw: string): string {
  if (!raw) return ''
  let html = raw
  // 위험 태그 통째 제거 (여는 태그~닫는 태그 포함)
  html = html.replace(/<(script|iframe|object|embed|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
  // 단독 위험 태그
  html = html.replace(/<(link|meta|base)\b[^>]*>/gi, '')
  // on* 이벤트 속성 제거
  html = html.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  // javascript:/data: URL 차단 (href/src)
  html = html.replace(/(href|src)\s*=\s*(["'])\s*(javascript|data|vbscript):[^"']*\2/gi, '$1="#"')
  return html
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
    introText: sanitizeIntroHtml(r.intro ?? '') || '상담사 소개가 준비 중입니다.',
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

  // OG 메타 태그 동적 주입 — 카카오톡/페이스북 등 외부 메신저 카드 미리보기 + 인앱 브라우저 검증용.
  useEffect(() => {
    if (typeof document === 'undefined' || !data) return
    const abs = (u: string) => (/^https?:\/\//.test(u) ? u : `${window.location.origin}${u}`)
    const tags: Array<[string, string]> = [
      ['og:type', 'website'],
      ['og:title', `${data.name} 선생님 | 사주플랜`],
      ['og:description', `${data.badge} · ${data.code}번 · ${data.pricePerHalfMin.toLocaleString()}원/30초`],
      ['og:image', abs(data.heroImg)],
      ['og:url', window.location.href],
      ['og:site_name', '사주플랜'],
    ]
    const created: HTMLMetaElement[] = []
    for (const [property, content] of tags) {
      let el = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute('property', property)
        document.head.appendChild(el)
        created.push(el)
      }
      el.setAttribute('content', content)
    }
    const prevTitle = document.title
    document.title = `${data.name} 선생님 | 사주플랜`
    return () => {
      created.forEach((el) => el.remove())
      document.title = prevTitle
    }
  }, [data])

  if (loading) {
    return (
      <div className="mobile-frame flex flex-col">
        <div className="w-full aspect-[5/4] bg-[#F3F4F6] animate-pulse" />
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
      <div
        className="counselor-intro text-[14px] leading-[160%] text-[#4A5565]"
        // 본문은 mapDetail 에서 sanitizeIntroHtml() 통과해 안전화됨.
        dangerouslySetInnerHTML={{ __html: data.introText }}
      />
    </CounselorDetailLayout>
  )
}
