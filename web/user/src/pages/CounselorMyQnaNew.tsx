import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { COUNSELOR_MY_QNA_CATEGORIES } from '../data/counselorMyPage'

/**
 * 08마이페이지_상담사_문의하기 작성
 * Figma node-id: 179:18451
 *
 * 폼: 분류(셀렉트) / 제목(입력) / 내용(텍스트에어리어) / 사진(0~5장)
 * 작성완료 보라 풀폭 둥근 버튼
 */
export default function CounselorMyQnaNew() {
  const navigate = useNavigate()
  const [category, setCategory] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [photos, setPhotos] = useState<string[]>(['/img/sample_img03.jpg'])

  const handleAddPhoto = () => {
    if (photos.length >= 5) return
    setPhotos((prev) => [...prev, '/img/sample_img03.jpg'])
  }

  const handleRemovePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx))
  }

  return (
    <div className="mobile-frame flex flex-col pb-6">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">문의하기 작성</h1>
      </header>

      <main className="flex-1 px-4 pt-2 flex flex-col gap-5">
        <Field label="분류" required>
          <SimpleSelect
            value={category}
            options={COUNSELOR_MY_QNA_CATEGORIES}
            placeholder="분류 선택"
            onChange={setCategory}
          />
        </Field>

        <Field label="제목" required>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력해주세요."
            className="w-full h-[48px] px-4 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] text-[15px] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none"
          />
        </Field>

        <Field label="내용" required>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="문의내용을 작성해주세요"
            rows={6}
            className="w-full px-4 py-3 rounded-[12px] bg-[#F9FAFB] border border-[#F3F4F6] text-[15px] leading-[150%] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none resize-none"
          />
        </Field>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[14px] leading-[140%] font-semibold text-[#030712]">사진</p>
            <p className="text-[13px] leading-[140%] text-[#99A1AF]">({photos.length}/5)</p>
          </div>
          <div className="flex items-start gap-2 flex-wrap">
            {photos.length < 5 && (
              <button
                type="button"
                onClick={handleAddPhoto}
                className="w-[80px] h-[80px] rounded-[12px] border border-dashed border-[#9B7AF7] bg-white flex flex-col items-center justify-center gap-1"
              >
                <img src="/img/ic_upload.svg" alt="" className="w-5 h-5" />
                <span className="text-[12px] leading-none text-[#8259F5]">사진 등록</span>
              </button>
            )}
            {photos.map((p, idx) => (
              <div
                key={`${p}-${idx}`}
                className="relative w-[80px] h-[80px] rounded-[12px] overflow-hidden bg-[#F3F4F6]"
              >
                <img src={p} alt={`첨부 ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(idx)}
                  aria-label={`첨부 ${idx + 1} 삭제`}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
                >
                  <img src="/img/ic_close_sm.svg" alt="" className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/counselor/mypage/qnas')}
          className="mt-4 w-full h-[52px] rounded-full bg-[#9B7AF7] text-white text-[16px] font-semibold"
        >
          작성완료
        </button>
      </main>
    </div>
  )
}

/* ─────────── 폼 헬퍼 ─────────── */

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-[14px] leading-[140%] font-semibold text-[#030712] mb-2">
        {label}
        {required && <span className="text-[#FF6467] ml-0.5">*</span>}
      </p>
      {children}
    </div>
  )
}

function SimpleSelect({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string
  options: readonly string[]
  placeholder: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full h-[48px] px-4 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] flex items-center justify-between text-[15px]"
      >
        <span className={value ? 'text-[#1E2939]' : 'text-[#99A1AF]'}>{value || placeholder}</span>
        <svg
          viewBox="0 0 16 16"
          className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          aria-hidden
        >
          <path d="M4 6L8 10L12 6" stroke="#6A7282" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 max-h-[260px] overflow-y-auto bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_8px_20px_rgba(16,24,40,0.08)] py-1"
        >
          {options.map((opt) => {
            const selected = value === opt
            return (
              <li key={opt}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(opt)
                    setOpen(false)
                  }}
                  className={`w-full px-4 py-2.5 text-left text-[15px] leading-5 ${
                    selected ? 'text-[#8259F5] font-medium bg-[#F3EEFE]' : 'text-[#1E2939] hover:bg-[#F9FAFB]'
                  }`}
                >
                  {opt}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
