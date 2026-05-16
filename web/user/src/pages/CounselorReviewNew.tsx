import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

/**
 * 상담 후기 작성 — Figma 163:19798
 * 라우트: /counselors/:id/reviews/new
 *
 * 구조:
 *  [hd5 헤더: ← + 상담 후기 작성]
 *  [안내 카드: bg #F3EEFE radius 12, padding 16, ✓ + 제목(보라) + 본문(회색)]
 *  [비밀글로 작성 체크박스 row]
 *  [제목* 라벨 + input]
 *  [후기 내용* 라벨 + textarea]
 *  [후기 사진 라벨 + (N/1) 카운터]
 *    · 사진 등록 박스 (84×84 점선) + 업로드된 사진 미리보기 (84×84, X 버튼)
 *  [작성완료 풀폭 보라 버튼]
 */

const MAX_PHOTOS = 1

export default function CounselorReviewNew() {
  const { id = '3' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  /**
   * Figma 시안과 동일하게 샘플 사진 1장이 이미 첨부된 상태로 렌더 시작.
   * 검증 시 "사진 첨부 UI가 어떻게 생겼나" 즉시 확인 가능.
   * 실제 제출 시에는 사용자가 직접 X로 제거하거나 새 파일로 교체.
   */
  const [photos, setPhotos] = useState<string[]>(['/img/sample_img02.jpg'])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const newUrls = files.slice(0, MAX_PHOTOS - photos.length).map((f) => URL.createObjectURL(f))
    setPhotos((prev) => [...prev, ...newUrls])
    e.target.value = ''
  }

  const removePhoto = (idx: number) => {
    setPhotos((prev) => {
      const next = [...prev]
      const removed = next.splice(idx, 1)[0]
      if (removed) URL.revokeObjectURL(removed)
      return next
    })
  }

  const canSubmit = title.trim().length > 0 && content.trim().length > 0

  const onSubmit = () => {
    if (!canSubmit) return
    // TODO: 실제 API 연동 시 이 자리에 fetch
    navigate(`/counselors/${id}/reviews`)
  }

  return (
    <div className="mobile-frame flex flex-col pb-10">
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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">
          상담 후기 작성
        </h1>
      </header>

      <main className="flex-1 px-4 pt-4 flex flex-col gap-5">
        {/* 안내 카드 */}
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

        {/* 비밀글 옵션 제거 (2026-05-15) — 후기는 항상 공개. 비밀 의도가 있으면 문의(Q&A) 사용 */}

        {/* 제목 */}
        <FormField label="제목" required>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력해주세요."
            className="w-full h-12 px-4 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] text-[14px] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none focus:border-[#9B7AF7]"
          />
        </FormField>

        {/* 후기 내용 */}
        <FormField label="후기 내용" required>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="솔직한 상담 후기를 상담사님과 다른 사람들에게 공유해주세요."
            rows={8}
            className="w-full px-4 py-3 rounded-[16px] bg-[#F9FAFB] border border-[#F3F4F6] text-[14px] leading-[140%] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none focus:border-[#9B7AF7] resize-none"
          />
        </FormField>

        {/* 후기 사진 */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[16px] leading-[130%] font-semibold text-[#1E2939]">
              후기 사진
            </label>
            <span className="text-[14px] leading-[120%] text-[#6A7282]">
              ({photos.length}/{MAX_PHOTOS})
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* 업로드 박스 — Figma 시안에서 사진 첨부 후에도 함께 노출되므로 항상 렌더.
                max 도달 시에는 disabled 처리 (클릭해도 동작 안 함) */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="사진 등록"
              disabled={photos.length >= MAX_PHOTOS}
              className="w-[84px] h-[84px] rounded-[12px] bg-[#F9FAFB] border border-[#F3F4F6] flex flex-col items-center justify-center gap-1 text-[#6A7282] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UploadIcon />
              <span className="text-[13px] leading-[120%]">사진 등록</span>
            </button>
            {photos.map((url, idx) => (
              <div key={url} className="relative w-[84px] h-[84px]">
                <img src={url} alt="" className="w-full h-full rounded-[12px] object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  aria-label="사진 제거"
                  className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#1E2939]/70 flex items-center justify-center"
                >
                  <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" aria-hidden>
                    <path d="M3 3l6 6M9 3l-6 6" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onFileChange}
              className="hidden"
            />
          </div>
        </section>

        {/* 작성완료 */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className={`mt-3 h-12 rounded-full text-white text-[16px] font-medium transition ${
            canSubmit ? 'bg-[#9B7AF7] hover:bg-[#8259F5]' : 'bg-[#9B7AF7]/60 cursor-not-allowed'
          }`}
        >
          작성완료
        </button>
      </main>
    </div>
  )
}

/* ───────────── 공용 폼 헬퍼 ───────────── */

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

export function SecretCheckbox({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-[22px] h-[22px]"
      />
      <span className="text-[15px] leading-[130%] text-[#6A7282]">비밀글로 작성</span>
    </label>
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
