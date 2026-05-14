import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError, reviewsApi } from '../lib/api'
import { FILE_BASE } from '../lib/runtime-env'
import { SecretCheckbox } from './CounselorReviewNew'

/**
 * 상담 후기 수정 — 라우트: /mypage/my-reviews/:id/edit
 *
 *  - GET /user/reviews/:id 로 prefill (본인 후기만)
 *  - PATCH /user/reviews/:id 로 저장
 *  - 사진 1장 교체/제거 가능. webp 사이블링은 업로드 endpoint 가 함께 반환.
 */
const MAX_PHOTOS = 1

export default function MyReviewEdit() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const reviewId = Number(id ?? '') || 0

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [secret, setSecret] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  /** 화면 표시용 미리보기 URL. blob:이면 새로 선택한 파일, 그 외엔 서버 URL. */
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  /** 현재 저장 시 사용할 서버 측 photo_url. null 이면 사진 없음(또는 제거). */
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoUrlWebp, setPhotoUrlWebp] = useState<string | null>(null)
  /** 폼이 더러워졌는지 — 사진 필드를 보냈는지 판단 */
  const [photoDirty, setPhotoDirty] = useState(false)

  const [photoUploading, setPhotoUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!reviewId) {
      setLoadError('잘못된 접근입니다.')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    reviewsApi
      .detail(reviewId)
      .then((r) => {
        if (cancelled) return
        setTitle(r.title ?? '')
        setContent(r.content ?? '')
        setPhotoUrl(r.photo_url)
        setPhotoUrlWebp(r.photo_url_webp)
        setPhotoPreview(r.photo_url ? resolveFileUrl(r.photo_url) : null)
        setLoadError(null)
      })
      .catch((e) => {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 401) {
          navigate('/login')
          return
        }
        setLoadError(e instanceof Error ? e.message : '후기를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reviewId, navigate])

  // blob: 미리보기 정리
  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (photoPreview && photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    const localUrl = URL.createObjectURL(file)
    setPhotoPreview(localUrl)
    setPhotoUrl(null)
    setPhotoUrlWebp(null)
    setPhotoDirty(true)
    setPhotoUploading(true)
    setError(null)
    try {
      const r = await reviewsApi.uploadImage(file)
      setPhotoUrl(r.url)
      setPhotoUrlWebp(r.url_webp)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '사진 업로드에 실패했습니다.')
      URL.revokeObjectURL(localUrl)
      setPhotoPreview(null)
    } finally {
      setPhotoUploading(false)
    }
  }

  const removePhoto = () => {
    if (photoPreview && photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(null)
    setPhotoUrl(null)
    setPhotoUrlWebp(null)
    setPhotoDirty(true)
  }

  const canSubmit =
    !!reviewId &&
    title.trim().length > 0 &&
    content.trim().length > 0 &&
    !submitting &&
    !photoUploading

  const onSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await reviewsApi.update(reviewId, {
        title: title.trim(),
        content: content.trim(),
        is_secret: secret,
        // 사진을 건드린 경우에만 변경값 전송. 그렇지 않으면 서버측 값 유지.
        ...(photoDirty ? { photo_url: photoUrl, photo_url_webp: photoUrlWebp } : {}),
      })
      navigate(`/mypage/my-reviews/${reviewId}`, { replace: true })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '후기 수정에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const photoCount = photoPreview ? 1 : 0

  return (
    <div className="mobile-frame flex flex-col pb-10">
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
          상담 후기 수정
        </h1>
      </header>

      <main className="flex-1 px-4 pt-4 flex flex-col gap-5">
        {loading && (
          <p className="py-20 text-center text-[14px] text-[#99A1AF]">불러오는 중…</p>
        )}
        {!loading && loadError && (
          <p className="py-20 text-center text-[14px] text-[#FB2C36]">{loadError}</p>
        )}

        {!loading && !loadError && (
          <>
            <article className="bg-[#F3EEFE] border border-[#E1D2FB] rounded-[12px] px-4 py-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <img src="/img/ic_reviewer.svg" alt="" className="w-4 h-4 shrink-0" />
                <p className="text-[15px] leading-[130%] font-semibold text-[#8259F5]">
                  솔직한 후기를 남겨주세요.
                </p>
              </div>
              <p className="text-[14px] leading-[130%] text-[#4A5565]">
                솔직한 후기는 상담 품질 향상에 큰 도움이 됩니다.
              </p>
            </article>

            <SecretCheckbox checked={secret} onChange={setSecret} />

            <FormField label="제목" required>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="제목을 입력해주세요."
                className="w-full h-12 px-4 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] text-[14px] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none focus:border-[#9B7AF7]"
              />
            </FormField>

            <FormField label="후기 내용" required>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="솔직한 상담 후기를 상담사님과 다른 사람들에게 공유해주세요."
                rows={8}
                className="w-full px-4 py-3 rounded-[16px] bg-[#F9FAFB] border border-[#F3F4F6] text-[14px] leading-[140%] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none focus:border-[#9B7AF7] resize-none"
              />
            </FormField>

            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-[16px] leading-[130%] font-semibold text-[#1E2939]">
                  후기 사진
                </label>
                <span className="text-[14px] leading-[120%] text-[#6A7282]">
                  ({photoCount}/{MAX_PHOTOS})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="사진 등록"
                  disabled={photoCount >= MAX_PHOTOS || photoUploading}
                  className="w-[84px] h-[84px] rounded-[12px] bg-[#F9FAFB] border border-[#F3F4F6] flex flex-col items-center justify-center gap-1 text-[#6A7282] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UploadIcon />
                  <span className="text-[13px] leading-[120%]">사진 등록</span>
                </button>
                {photoPreview && (
                  <div className="relative w-[84px] h-[84px]">
                    <img src={photoPreview} alt="" className="w-full h-full rounded-[12px] object-cover" />
                    {photoUploading && (
                      <div className="absolute inset-0 rounded-[12px] bg-black/40 flex items-center justify-center">
                        <span className="text-white text-[12px]">업로드 중…</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={removePhoto}
                      aria-label="사진 제거"
                      disabled={photoUploading}
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#1E2939]/70 flex items-center justify-center"
                    >
                      <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" aria-hidden>
                        <path d="M3 3l6 6M9 3l-6 6" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  className="hidden"
                />
              </div>
            </section>

            {error && (
              <p className="text-[13px] text-[#FB2C36] text-center">{error}</p>
            )}

            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={!canSubmit}
              className={`mt-3 h-12 rounded-full text-white text-[16px] font-medium transition ${
                canSubmit ? 'bg-[#9B7AF7] hover:bg-[#8259F5]' : 'bg-[#9B7AF7]/60 cursor-not-allowed'
              }`}
            >
              {submitting ? '저장 중…' : '수정완료'}
            </button>
          </>
        )}
      </main>
    </div>
  )
}

function FormField({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <label className="text-[16px] leading-[130%] font-semibold text-[#1E2939]">
        {label}
        {required && <span className="text-[#8259F5] ml-0.5">*</span>}
      </label>
      {children}
    </section>
  )
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" aria-hidden>
      <path
        d="M12 16V4M6 10l6-6 6 6M4 20h16"
        stroke="#6A7282"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * 백엔드가 내려주는 상대경로 (/uploads/...) 를 API 도메인 절대경로로 변환.
 * UploadedImage 와 같은 규칙. 미리보기 <img> 단독 사용용.
 */
function resolveFileUrl(u: string): string {
  if (/^https?:\/\//.test(u)) return u
  if (u.startsWith('/')) {
    return `${FILE_BASE}${u}`
  }
  return u
}
