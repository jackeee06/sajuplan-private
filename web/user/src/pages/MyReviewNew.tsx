import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError, reviewsApi } from '../lib/api'

/**
 * 상담 후기 작성 (마이페이지에서 진입) — Figma 147:12530
 * 라우트: /mypage/my-reviews/new?consultation_id=38&counselor_id=77
 *
 * 진입 흐름:
 *   1) 마이페이지 > 전화/채팅 내역 카드 "후기 작성하기"
 *   2) 상담사 상세 페이지 "후기 작성" (consultation_id 없이 counselor_id 만 올 수도 있음)
 *
 * 사진은 한 장만 등록(MAX_PHOTOS=1).
 * 백엔드 :
 *   POST /api/user/reviews/upload-image  (multipart, optional)
 *   POST /api/user/reviews                ({ counselor_id, title, content, photo_url, ... })
 *   - 동일 consultation_id 후기 중복 작성 차단
 *   - 본인 상담만 후기 가능 (서버 검증)
 */

const MAX_PHOTOS = 1

export default function MyReviewNew() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const counselorId = Number(searchParams.get('counselor_id') ?? '') || 0
  const consultationId = Number(searchParams.get('consultation_id') ?? '') || 0

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  /** 화면 표시용 미리보기 URL (objectURL 또는 업로드된 서버 URL). 최대 1장. */
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  /** 서버 업로드 후 받은 URL — 제출 시 photo_url 로 전달. null 이면 사진 없음. */
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  /** WebP 사이블링 URL (있으면) */
  const [uploadedWebpUrl, setUploadedWebpUrl] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // counselor_id 누락 — 잘못된 진입. 1초 후 뒤로.
  useEffect(() => {
    if (!counselorId) {
      setError('상담사 정보가 없습니다.')
      const t = setTimeout(() => navigate(-1), 1500)
      return () => clearTimeout(t)
    }
  }, [counselorId, navigate])

  // 화면 unmount 시 objectURL 해제 — 메모리 누수 방지.
  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    // 기존 미리보기 정리
    if (photoPreview && photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    const localUrl = URL.createObjectURL(file)
    setPhotoPreview(localUrl)
    setUploadedUrl(null)
    setUploadedWebpUrl(null)
    setPhotoUploading(true)
    setError(null)
    try {
      const r = await reviewsApi.uploadImage(file)
      setUploadedUrl(r.url)
      setUploadedWebpUrl(r.url_webp)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '사진 업로드에 실패했습니다.')
      // 미리보기 되돌림
      URL.revokeObjectURL(localUrl)
      setPhotoPreview(null)
    } finally {
      setPhotoUploading(false)
    }
  }

  const removePhoto = () => {
    if (photoPreview && photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(null)
    setUploadedUrl(null)
    setUploadedWebpUrl(null)
  }

  const canSubmit =
    !!counselorId &&
    title.trim().length > 0 &&
    content.trim().length > 0 &&
    !submitting &&
    !photoUploading

  const onSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await reviewsApi.create({
        counselor_id: counselorId,
        title: title.trim(),
        content: content.trim(),
        // 비밀글 기능 제거 (2026-05-15) — 후기는 항상 공개. 백엔드도 무시.
        is_secret: false,
        photo_url: uploadedUrl,
        photo_url_webp: uploadedWebpUrl,
        consultation_id: consultationId || null,
      })
      navigate('/mypage/my-reviews', { replace: true })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '후기 작성에 실패했습니다.')
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
          상담 후기 작성
        </h1>
      </header>

      <main className="flex-1 px-4 pt-4 flex flex-col gap-5">
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

        {/* 비밀글 옵션 제거 (2026-05-15) — 후기는 항상 공개 */}

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
          {submitting ? '작성 중…' : '작성완료'}
        </button>
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
