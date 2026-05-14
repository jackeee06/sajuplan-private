import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import ConfirmModal from '../components/ConfirmModal'
import FloatingActions from '../components/FloatingActions'
import UploadedImage from '../components/UploadedImage'
import { ApiError, counselorApplyApi, type CounselorApplyDetail as Detail } from '../lib/api'

const STATUS_LABEL: Record<string, string> = {
  pending: '검토중',
  accepted: '승인',
  rejected: '반려',
  cancelled: '취소',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'border-[#9B7AF7] text-[#8259F5]',
  accepted: 'border-[#16A34A] text-[#16A34A]',
  rejected: 'border-[#FB2C36] text-[#FB2C36]',
  cancelled: 'border-[#9CA3AF] text-[#6A7282]',
}

function formatDateTime(s: string): string {
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

/**
 * 상담사 신청 상세 — Figma 136:16353
 *  - 본인 신청은 본인만 열람 (서버에서 ForbiddenException → UI 안내)
 *  - 공지(category='notice')는 누구나 열람
 *  - 본인 + status=pending 인 경우에만 "신청 취소" 노출 (수정 기능은 백엔드 미구현 — 숨김)
 */
export default function CounselorApplyDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const numericId = id ? Number(id) : NaN

  const [data, setData] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toastOpen, setToastOpen] = useState(false)

  useEffect(() => {
    if (!numericId || isNaN(numericId)) {
      setError('잘못된 접근입니다.')
      setLoading(false)
      return
    }
    let mounted = true
    setLoading(true)
    setError(null)
    counselorApplyApi
      .detail(numericId)
      .then((r) => {
        if (mounted) setData(r)
      })
      .catch((e) => {
        if (!mounted) return
        if (e instanceof ApiError && e.status === 401) {
          navigate('/login', { replace: true, state: { from: `/mypage/counselor-apply/${numericId}` } })
          return
        }
        if (e instanceof ApiError && e.status === 403) {
          setError('본인이 작성한 신청글만 열람할 수 있습니다.')
          return
        }
        setError(e instanceof Error ? e.message : '글을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [numericId, navigate])

  const handleCancel = async () => {
    if (!data) return
    setBusy(true)
    try {
      await counselorApplyApi.cancel(data.id)
      setCancelOpen(false)
      setToastOpen(true)
      setTimeout(() => {
        setToastOpen(false)
        navigate('/mypage/counselor-apply')
      }, 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : '취소에 실패했습니다.')
      setCancelOpen(false)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="mobile-frame flex flex-col pb-[100px]">
        <Header onBack={() => navigate(-1)} />
        <p className="text-center text-[14px] text-[#99A1AF] py-10">불러오는 중…</p>
        <BottomNav />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mobile-frame flex flex-col pb-[100px]">
        <Header onBack={() => navigate(-1)} />
        <p className="text-center text-[14px] text-[#FB2C36] py-10 px-6 break-keep">
          {error ?? '존재하지 않는 신청입니다.'}
        </p>
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/mypage/counselor-apply')}
            className="h-[44px] px-7 rounded-full border border-[#9B7AF7] text-[15px] font-medium text-[#8259F5]"
          >
            목록으로
          </button>
        </div>
        <BottomNav />
      </div>
    )
  }

  const extras = (data.extras ?? {}) as {
    real_name?: string
    pen_name?: string
    region?: string
    field?: string
    specialties?: string[]
    profile_photo_url?: string | null
    wide_photo_url?: string | null
    photo_url?: string | null
    intro?: string
  }
  const profilePhoto = extras.profile_photo_url ?? extras.photo_url ?? null
  const widePhoto = extras.wide_photo_url ?? null
  const isNotice = data.category === 'notice'
  const canCancel = data.is_mine && !isNotice && data.status === 'pending'

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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">
          상담 신청 상세
        </h1>
        {canCancel && (
          <button
            type="button"
            aria-label="신청 취소"
            onClick={() => setCancelOpen(true)}
            className="w-[30px] h-[30px] flex items-center justify-center"
          >
            <img src="/img/ic_trash_r.svg" alt="" className="w-6 h-6" />
          </button>
        )}
      </header>

      {toastOpen && (
        <div className="fixed top-[68px] left-1/2 -translate-x-1/2 z-50 max-w-[400px] w-[calc(100%-32px)] mx-auto pointer-events-none">
          <div className="mx-auto inline-block bg-[#1E2939] text-white text-[14px] leading-[140%] px-4 py-2.5 rounded-[10px] shadow-[0_4px_12px_rgba(0,0,0,0.18)]">
            신청이 취소되었습니다.
          </div>
        </div>
      )}

      <main className="flex-1 px-4 pt-2">
        <div className="flex items-center gap-2">
          {isNotice && (
            <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-white border border-[#9B7AF7] text-[12px] leading-none font-medium text-[#8259F5]">
              공지
            </span>
          )}
          {!isNotice && data.is_mine && (
            <span
              className={`inline-flex items-center h-[22px] px-2 rounded-full bg-white border text-[12px] leading-none font-medium ${
                STATUS_COLOR[data.status] ?? STATUS_COLOR.pending
              }`}
            >
              {STATUS_LABEL[data.status] ?? data.status}
            </span>
          )}
        </div>
        <h2 className="mt-2 text-[18px] leading-[140%] font-bold text-[#030712]">
          {data.title}
        </h2>
        <p className="mt-1 text-[13px] leading-[140%] text-[#99A1AF]">
          {data.author_nickname ?? '회원'} · {formatDateTime(data.created_at)} · 조회 {data.view_count.toLocaleString()}
        </p>

        {(extras.real_name || extras.pen_name || extras.region || extras.field || (extras.specialties && extras.specialties.length > 0)) && (
          <div className="mt-4 border-t border-[#F3F4F6] pt-4">
            <dl className="flex flex-col gap-2">
              {extras.real_name && <Row label="이름" value={extras.real_name} />}
              {extras.pen_name && <Row label="예명" value={extras.pen_name} />}
              {extras.region && <Row label="지역" value={extras.region} />}
              {data.applicant_phone && <Row label="핸드폰 번호" value={data.applicant_phone} />}
              {data.applicant_email && <Row label="이메일" value={data.applicant_email} />}
              {extras.field && <Row label="상담분야" value={extras.field} />}
              {extras.specialties && extras.specialties.length > 0 && (
                <Row label="전문 상담분야" value={extras.specialties.join(', ')} />
              )}
            </dl>
          </div>
        )}

        {(data.content || extras.intro || profilePhoto || widePhoto) && (
          <div className="mt-5 border-t border-[#F3F4F6] pt-4">
            <p className="text-[14px] leading-[140%] font-semibold text-[#030712] mb-2">
              본인소개
            </p>
            <p className="text-[15px] leading-[160%] text-[#364153] whitespace-pre-line">
              {data.content || extras.intro || ''}
            </p>
            {widePhoto && (
              <UploadedImage
                src={widePhoto}
                alt="와이드 사진"
                className="mt-3 w-full aspect-[65/32] rounded-[12px] object-cover"
              />
            )}
            {profilePhoto && (
              <UploadedImage
                src={profilePhoto}
                alt="프로필 사진"
                className="mt-3 w-[160px] aspect-square rounded-[12px] object-cover"
              />
            )}
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/mypage/counselor-apply')}
            className="h-[44px] px-7 rounded-full border border-[#9B7AF7] text-[15px] font-medium text-[#8259F5]"
          >
            목록으로
          </button>
        </div>
      </main>

      <ConfirmModal
        open={cancelOpen && !busy}
        message={'신청을 취소하시겠습니까?'}
        actionLabel="취소"
        tone="danger"
        onCancel={() => setCancelOpen(false)}
        onConfirm={handleCancel}
      />

      <FloatingActions bottomOffset={100} />
      <BottomNav />
    </div>
  )
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
      <button
        type="button"
        onClick={onBack}
        aria-label="뒤로"
        className="w-[30px] h-[30px] flex items-center justify-center"
      >
        <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
      </button>
      <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">
        상담 신청 상세
      </h1>
    </header>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="w-[80px] shrink-0 text-[14px] leading-[140%] text-[#6A7282]">
        {label}
      </dt>
      <dd className="flex-1 text-[14px] leading-[140%] text-[#030712]">{value}</dd>
    </div>
  )
}
