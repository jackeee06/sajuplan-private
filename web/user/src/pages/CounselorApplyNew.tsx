import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConfirmModal from '../components/ConfirmModal'
import {
  APPLY_FIELD_OPTIONS,
  APPLY_REGION_OPTIONS,
  APPLY_SPECIALTY_OPTIONS,
  APPLY_STATUS_OPTIONS,
} from '../data/myPageMockData'

/**
 * 상담사 신청 작성 — Figma 142:17256 (폼) / 142:21364 (작성완료 토스트 노출)
 *
 * 모달:
 *  - 작성취소(142:21334): "작성중인 글이 있습니다.\n이 페이지에서 나가겠습니까?" — 뒤로가기 시 입력값 있으면 노출
 *  - 작성완료(142:21292): "입력하신 내용으로 신청하시겠습니까?" — 작성완료 버튼 누르면 노출
 *
 * 토스트(142:21364): "상담사 신청이 완료되었습니다." — 작성완료 컨펌 후 표시 → 자동 닫힘 → 목록으로 이동
 */

type SimpleSelectProps = {
  value: string
  options: readonly string[]
  placeholder: string
  onChange: (v: string) => void
}

function SimpleSelect({ value, options, placeholder, onChange }: SimpleSelectProps) {
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
        className="w-full h-[48px] px-4 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] flex items-center justify-between text-[15px] text-[#1E2939]"
      >
        <span className={value ? 'text-[#1E2939]' : 'text-[#99A1AF]'}>
          {value || placeholder}
        </span>
        <svg
          viewBox="0 0 16 16"
          className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          aria-hidden
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="#6A7282"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
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
                    selected
                      ? 'text-[#8259F5] font-medium bg-[#F3EEFE]'
                      : 'text-[#1E2939] hover:bg-[#F9FAFB]'
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

const INTRO_MAX = 100

export default function CounselorApplyNew() {
  const navigate = useNavigate()

  const [status, setStatus] = useState('')
  const [title, setTitle] = useState('')
  const [name, setName] = useState('')
  const [penName, setPenName] = useState('')
  const [region, setRegion] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [field, setField] = useState('')
  const [birth, setBirth] = useState('')
  const [specialties, setSpecialties] = useState<string[]>(['운세', '속마음', '연애', '취업'])
  const [photo, setPhoto] = useState<string | null>('/img/sample_img04.jpg')
  const [intro, setIntro] = useState('')
  const [pw, setPw] = useState('')
  const [pwVisible, setPwVisible] = useState(false)
  const [captcha, setCaptcha] = useState('')

  const [submitOpen, setSubmitOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [toastOpen, setToastOpen] = useState(false)

  const toggleSpecialty = (v: string) => {
    setSpecialties((prev) =>
      prev.includes(v) ? prev.filter((s) => s !== v) : [...prev, v],
    )
  }

  const isDirty =
    status || title || name || penName || region || phone || email || field || birth ||
    specialties.length > 0 || photo || intro || pw || captcha

  const handleBack = () => {
    if (isDirty) setCancelOpen(true)
    else navigate(-1)
  }

  const handleSubmitClick = () => setSubmitOpen(true)

  const handleSubmitConfirm = () => {
    setSubmitOpen(false)
    setToastOpen(true)
    setTimeout(() => {
      setToastOpen(false)
      navigate('/mypage/counselor-apply')
    }, 1600)
  }

  return (
    <div className="mobile-frame flex flex-col pb-[40px] relative">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={handleBack}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">
          상담사 신청
        </h1>
      </header>

      {toastOpen && (
        <div className="fixed top-[68px] left-1/2 -translate-x-1/2 z-50 max-w-[400px] w-[calc(100%-32px)] mx-auto pointer-events-none">
          <div className="mx-auto inline-block bg-[#1E2939] text-white text-[14px] leading-[140%] px-4 py-2.5 rounded-[10px] shadow-[0_4px_12px_rgba(0,0,0,0.18)]">
            상담사 신청이 완료되었습니다.
          </div>
        </div>
      )}

      <main className="flex-1 px-4 pt-2">
        <div className="rounded-[12px] bg-[#F3EEFE] px-3 py-2.5 flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="#8259F5" strokeWidth="1.6" />
            <path d="M8.5 12.5L11 15L16 9.5" stroke="#8259F5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[13px] leading-[140%] font-medium text-[#8259F5]">
            신청 후 빠른 시일 내에 담당자가 연락드립니다.
          </span>
        </div>

        <div className="mt-5 space-y-4">
          <Field label="신청상태" required>
            <SimpleSelect value={status} options={APPLY_STATUS_OPTIONS} placeholder="문의 종류 선택" onChange={setStatus} />
          </Field>
          <Field label="제목" required>
            <TextInput value={title} onChange={setTitle} placeholder="제목을 입력해주세요." />
          </Field>
          <Field label="이름" required>
            <TextInput value={name} onChange={setName} placeholder="이름을 입력해주세요." />
          </Field>
          <Field label="예명" required>
            <TextInput value={penName} onChange={setPenName} placeholder="예명을 입력해주세요." />
          </Field>
          <Field label="지역" required>
            <SimpleSelect value={region} options={APPLY_REGION_OPTIONS} placeholder="지역 선택" onChange={setRegion} />
          </Field>
          <Field label="휴대폰번호" required>
            <TextInput value={phone} onChange={setPhone} placeholder="'-' 없이 숫자만 입력해주세요." inputMode="numeric" />
          </Field>
          <Field label="이메일">
            <TextInput value={email} onChange={setEmail} placeholder="이메일 주소를 입력해주세요." />
          </Field>
          <Field label="상담분야" required>
            <SimpleSelect value={field} options={APPLY_FIELD_OPTIONS} placeholder="상담분야 선택" onChange={setField} />
          </Field>
          <Field label="생년월일" required>
            <TextInput value={birth} onChange={setBirth} placeholder="YYYY-MM-DD" />
          </Field>

          <div>
            <p className="text-[14px] leading-[140%] font-semibold text-[#030712] mb-2">
              전문 상담분야<span className="text-[#FF6467] ml-0.5">*</span>
            </p>
            <ul className="grid grid-cols-3 gap-2">
              {APPLY_SPECIALTY_OPTIONS.map((s) => {
                const active = specialties.includes(s)
                return (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => toggleSpecialty(s)}
                      className={
                        active
                          ? 'w-full h-[40px] rounded-full bg-[#9B7AF7] text-white text-[14px] font-medium'
                          : 'w-full h-[40px] rounded-full border border-[#E5E7EB] bg-white text-[#6A7282] text-[14px] font-medium'
                      }
                    >
                      {s}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <Field label="본인 사진" required>
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => setPhoto(photo ? null : '/img/sample_img04.jpg')}
                className="w-[80px] h-[80px] rounded-[12px] border border-dashed border-[#9B7AF7] bg-white flex flex-col items-center justify-center gap-1"
              >
                <img src="/img/ic_upload.svg" alt="" className="w-5 h-5" />
                <span className="text-[12px] leading-none text-[#8259F5]">사진 등록</span>
              </button>
              {photo && (
                <div className="relative w-[80px] h-[80px] rounded-[12px] overflow-hidden bg-[#F3F4F6]">
                  <img src={photo} alt="첨부 사진" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhoto(null)}
                    aria-label="사진 삭제"
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
                  >
                    <img src="/img/ic_close_sm.svg" alt="" className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </Field>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[14px] leading-[140%] font-semibold text-[#030712]">
                본인 소개<span className="text-[#FF6467] ml-0.5">*</span>
              </p>
              <span className="text-[12px] leading-[140%] text-[#99A1AF]">
                ({intro.length}/{INTRO_MAX})
              </span>
            </div>
            <textarea
              value={intro}
              onChange={(e) => setIntro(e.target.value.slice(0, INTRO_MAX))}
              placeholder="본인 소개를 입력해주세요."
              rows={4}
              className="w-full px-4 py-3 rounded-[12px] bg-[#F9FAFB] border border-[#F3F4F6] text-[15px] leading-[150%] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none resize-none"
            />
          </div>

          <Field label="비밀번호" required>
            <div className="relative">
              <input
                type={pwVisible ? 'text' : 'password'}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="비밀번호를 입력해주세요."
                className="w-full h-[48px] px-4 pr-11 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] text-[15px] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none"
              />
              <button
                type="button"
                aria-label={pwVisible ? '비밀번호 숨기기' : '비밀번호 보기'}
                onClick={() => setPwVisible((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5"
              >
                <img
                  src={pwVisible ? '/img/ic_input_eye.svg' : '/img/ic_input_eye_closed.svg'}
                  alt=""
                  className="w-5 h-5"
                />
              </button>
            </div>
          </Field>

          <Field label="자동등록방지" required>
            <div className="flex gap-2 items-center">
              <div
                className="h-[48px] px-4 rounded-[8px] bg-[#FFE0EC] flex items-center justify-center"
                style={{
                  fontFamily: 'serif',
                  fontStyle: 'italic',
                  fontWeight: 700,
                  fontSize: 18,
                  letterSpacing: 4,
                  color: '#8259F5',
                  textDecoration: 'line-through',
                }}
              >
                547365
              </div>
              <input
                type="text"
                value={captcha}
                onChange={(e) => setCaptcha(e.target.value)}
                className="flex-1 h-[48px] px-4 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] text-[15px] text-[#1E2939] focus:outline-none"
              />
              <button
                type="button"
                aria-label="새로고침"
                className="w-[48px] h-[48px] rounded-full bg-[#F9FAFB] border border-[#F3F4F6] flex items-center justify-center"
              >
                <img src="/img/ic_reset.svg" alt="" className="w-5 h-5" />
              </button>
            </div>
          </Field>
        </div>

        <div className="mt-8">
          <button
            type="button"
            onClick={handleSubmitClick}
            className="w-full h-[52px] rounded-full bg-[#9B7AF7] text-[16px] font-medium text-white"
          >
            작성완료
          </button>
          <button
            type="button"
            onClick={handleBack}
            className="mt-3 w-full text-center text-[14px] leading-[140%] text-[#6A7282]"
          >
            취소
          </button>
        </div>
      </main>

      <ConfirmModal
        open={submitOpen}
        message="입력하신 내용으로 신청하시겠습니까?"
        actionLabel="작성 완료"
        onCancel={() => setSubmitOpen(false)}
        onConfirm={handleSubmitConfirm}
      />
      <ConfirmModal
        open={cancelOpen}
        message={'작성중인 글이 있습니다.\n이 페이지에서 나가겠습니까?'}
        actionLabel="나가기"
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => {
          setCancelOpen(false)
          navigate(-1)
        }}
      />
    </div>
  )
}

/* ─────────── 내부 small 컴포넌트 ─────────── */

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
      <label className="block text-[14px] leading-[140%] font-semibold text-[#030712] mb-2">
        {label}
        {required && <span className="text-[#FF6467] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  inputMode?: 'numeric' | 'text'
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      className="w-full h-[48px] px-4 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] text-[15px] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none"
    />
  )
}
