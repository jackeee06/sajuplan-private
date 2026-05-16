import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConfirmModal from '../components/ConfirmModal'
import HtmlEditor, { type HtmlEditorHandle } from '../components/HtmlEditor'
import UploadedImage from '../components/UploadedImage'
import {
  APPLY_FIELD_OPTIONS,
  APPLY_REGION_OPTIONS,
  APPLY_SPECIALTY_OPTIONS,
  APPLY_STATUS_OPTIONS,
} from '../data/myPageMockData'
import { ApiError, captchaApi, counselorApplyApi, smsApi } from '../lib/api'
import { useAuth } from '../lib/auth-context'

/**
 * 상담사 신청 작성 — 백엔드 연동 풀 구현.
 *  - 사진: 프로필(정사각) 1장 — POST /user/counselor-apply/upload?kind=profile
 *  - 휴대폰 인증: smsApi.send → smsApi.verify → 서버에서 isVerifiedRecently(10분 내) 검증
 *  - 자동등록방지: captchaApi.issue 로 받은 SVG + token, 입력값을 그대로 서버에 전달
 *  - 휴대폰 중복: counselorApplyApi.checkPhone 으로 onBlur 시 안내 + create 시 ConflictException 처리
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

const PHONE_TIMER_SEC = 180

export default function CounselorApplyNew() {
  const navigate = useNavigate()
  const { isLoggedIn } = useAuth()

  const [status, setStatus] = useState('')
  const [title, setTitle] = useState('')
  // 계정 정보 — 승인 시 이걸 그대로 mb_id/password 로 가입.
  const [accountId, setAccountId] = useState('')
  const [accountIdStatus, setAccountIdStatus] = useState<
    null | { available: boolean; reason?: string }
  >(null)
  const [accountIdChecking, setAccountIdChecking] = useState(false)
  const [accountPw, setAccountPw] = useState('')
  const [accountPwConfirm, setAccountPwConfirm] = useState('')
  const [name, setName] = useState('')
  const [penName, setPenName] = useState('')
  const [region, setRegion] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [field, setField] = useState('')
  const [birth, setBirth] = useState('')
  const [specialties, setSpecialties] = useState<string[]>([])
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null)
  const [profilePhotoWebp, setProfilePhotoWebp] = useState<string | null>(null)
  const [contractFiles, setContractFiles] = useState<
    Array<{ url: string; original_name: string; size: number }>
  >([])
  const [intro, setIntro] = useState('')
  const profileFileRef = useRef<HTMLInputElement>(null)
  const contractFileRef = useRef<HTMLInputElement>(null)
  const introEditorRef = useRef<HtmlEditorHandle>(null)
  const [uploading, setUploading] = useState<null | 'profile' | 'contract'>(null)

  // 휴대폰 인증
  const [phoneCode, setPhoneCode] = useState('')
  const [phoneSent, setPhoneSent] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [phoneSending, setPhoneSending] = useState(false)
  const [phoneVerifying, setPhoneVerifying] = useState(false)
  const [phoneTimer, setPhoneTimer] = useState(0)
  // 휴대폰 상태 — 'accepted' 면 폼 차단, 'pending' 이면 안내만 (새 신청이 기존 대체).
  const [phoneStatus, setPhoneStatus] = useState<'accepted' | 'pending' | 'none'>('none')
  const phoneTimerRef = useRef<number | null>(null)

  // 자동등록방지
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaSvg, setCaptchaSvg] = useState('')
  const [captchaInput, setCaptchaInput] = useState('')
  const [captchaLoading, setCaptchaLoading] = useState(false)

  const [submitOpen, setSubmitOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // 캡차 발급 — 마운트 시 1회 + 새로고침 버튼
  const refreshCaptcha = async () => {
    setCaptchaLoading(true)
    try {
      const r = await captchaApi.issue()
      setCaptchaToken(r.token)
      setCaptchaSvg(r.svg)
      setCaptchaInput('')
    } catch (e) {
      setErrorMsg(`캡차 발급 실패: ${e instanceof Error ? e.message : '알 수 없음'}`)
    } finally {
      setCaptchaLoading(false)
    }
  }
  useEffect(() => {
    void refreshCaptcha()
    // 페이지 진입 시 무조건 최상단에서 시작 — 브라우저 scroll restoration 이
    // 이전 방문 시 스크롤 위치(예: 이메일 필드 근처)를 기억해서 중간에서 시작하는
    // 현상 방지. CounselorApplyNew 는 폼이 길어서 첫 화면이 가장 중요함.
    window.scrollTo(0, 0)
  }, [])

  // 휴대폰 인증 타이머
  useEffect(() => {
    if (!phoneSent || phoneVerified) return
    if (phoneTimer <= 0) {
      if (phoneTimerRef.current) window.clearInterval(phoneTimerRef.current)
      return
    }
    phoneTimerRef.current = window.setInterval(() => {
      setPhoneTimer((t) => Math.max(0, t - 1))
    }, 1000)
    return () => {
      if (phoneTimerRef.current) window.clearInterval(phoneTimerRef.current)
    }
  }, [phoneSent, phoneVerified, phoneTimer])

  const phoneTimerLabel = (() => {
    const m = Math.floor(phoneTimer / 60)
    const s = phoneTimer % 60
    return `${m}:${String(s).padStart(2, '0')}`
  })()

  const toggleSpecialty = (v: string) => {
    setSpecialties((prev) =>
      prev.includes(v) ? prev.filter((s) => s !== v) : [...prev, v],
    )
  }

  const isDirty =
    status || title || name || penName || region || phone || email || field || birth ||
    specialties.length > 0 || profilePhoto || contractFiles.length > 0 ||
    intro || captchaInput || accountId || accountPw || accountPwConfirm

  const handleBack = () => {
    if (isDirty) setCancelOpen(true)
    else navigate(-1)
  }

  // 휴대폰 상태 체크 — 11자리 입력 완료 시 자동 호출.
  //   accepted → 폼 차단 (이미 가입된 상담사)
  //   pending  → 차단 안 함, 안내만 (새 신청이 기존 건을 자동 대체)
  const onPhoneBlur = async () => {
    const digits = phone.replace(/[^0-9]/g, '')
    if (digits.length < 10) {
      setPhoneStatus('none')
      return
    }
    try {
      const r = await counselorApplyApi.checkPhone(digits)
      setPhoneStatus(r.status)
    } catch {
      // 네트워크 일시 실패는 무시 — 제출 시 서버가 다시 검증
    }
  }

  // 아이디 중복/형식 체크 — 4자 이상 입력 후 onBlur 시 호출
  const onAccountIdBlur = async () => {
    const trimmed = accountId.trim()
    if (!trimmed) {
      setAccountIdStatus(null)
      return
    }
    setAccountIdChecking(true)
    try {
      const r = await counselorApplyApi.checkMbId(trimmed)
      setAccountIdStatus(r)
    } catch {
      setAccountIdStatus(null)
    } finally {
      setAccountIdChecking(false)
    }
  }

  const handleSendCode = async () => {
    setErrorMsg(null)
    const digits = phone.replace(/[^0-9]/g, '')
    if (!/^01[016789]\d{7,8}$/.test(digits)) {
      setErrorMsg('휴대폰 번호 형식이 올바르지 않습니다.')
      return
    }
    if (phoneStatus === 'accepted') {
      setErrorMsg('이미 같은 휴대폰으로 가입된 상담사가 있습니다. 로그인 후 이용해주세요.')
      return
    }
    setPhoneSending(true)
    try {
      await smsApi.send(digits)
      setPhoneSent(true)
      setPhoneVerified(false)
      setPhoneTimer(PHONE_TIMER_SEC)
    } catch (e) {
      setErrorMsg(`인증번호 발송 실패: ${e instanceof Error ? e.message : '알 수 없음'}`)
    } finally {
      setPhoneSending(false)
    }
  }

  const handleVerifyCode = async () => {
    setErrorMsg(null)
    if (!/^\d{4,6}$/.test(phoneCode)) {
      setErrorMsg('인증번호 4~6자리를 입력해주세요.')
      return
    }
    setPhoneVerifying(true)
    try {
      const digits = phone.replace(/[^0-9]/g, '')
      await smsApi.verify(digits, phoneCode)
      setPhoneVerified(true)
    } catch (e) {
      setErrorMsg(`인증 실패: ${e instanceof Error ? e.message : '알 수 없음'}`)
    } finally {
      setPhoneVerifying(false)
    }
  }

  const handleUpload = async (
    kind: 'profile' | 'contract',
    file: File | null | undefined,
  ) => {
    if (!file) return
    setErrorMsg(null)
    setUploading(kind)
    try {
      const r = await counselorApplyApi.uploadImage(file, kind)
      if (kind === 'profile') {
        setProfilePhoto(r.url)
        setProfilePhotoWebp(r.url_webp)
      } else {
        setContractFiles((prev) => [
          ...prev,
          { url: r.url, original_name: r.original_name, size: r.size },
        ])
      }
    } catch (e) {
      setErrorMsg(`파일 업로드 실패: ${e instanceof Error ? e.message : '알 수 없음'}`)
    } finally {
      setUploading(null)
    }
  }

  // 2026-05-16: 신청 종류 매핑 — 한글 라벨 ↔ 백엔드 키
  const APPLY_TYPE_MAP: Record<string, 'application' | 'inquiry' | 'other'> = {
    '상담사 지원': 'application',
    '상담사 문의': 'inquiry',
    '기타 문의': 'other',
  }
  const applyType = APPLY_TYPE_MAP[status] ?? 'application'
  const isFullForm = applyType === 'application'

  // 누락 필드 자동 스크롤 + 빨간 깜빡 — 사용자가 "어디가 빠졌는지" 바로 알게.
  // CSS keyframe 'pulseError' 는 design.css 또는 index.css 에 정의되어 있어야 함.
  const flashField = (fieldId: string, msg: string) => {
    setErrorMsg(msg)
    // 다음 페인트 이후 스크롤/하이라이트 — state 반영 후 DOM 안정화 보장
    requestAnimationFrame(() => {
      const el = document.getElementById(`field-${fieldId}`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('field-error-flash')
      window.setTimeout(() => el.classList.remove('field-error-flash'), 2200)
    })
  }

  const handleSubmitClick = () => {
    setErrorMsg(null)
    if (!status) return flashField('status', '신청상태를 선택해주세요.')
    if (!title.trim()) return flashField('title', '제목을 입력해주세요.')

    if (isFullForm) {
      // ── 상담사 지원: 풀폼 필수 검증 ──
      if (!accountId.trim()) return flashField('accountId', '아이디를 입력해주세요.')
      if (!/^[a-zA-Z0-9_]{4,20}$/.test(accountId.trim())) {
        return flashField('accountId', '아이디는 영문/숫자/언더스코어 4~20자여야 합니다.')
      }
      if (accountIdStatus && !accountIdStatus.available) {
        return flashField('accountId', accountIdStatus.reason ?? '사용할 수 없는 아이디입니다.')
      }
      if (accountPw.length < 6) return flashField('accountPw', '비밀번호는 6자 이상 입력해주세요.')
      if (accountPw !== accountPwConfirm) return flashField('accountPw', '비밀번호가 일치하지 않습니다.')
      if (!name.trim()) return flashField('name', '이름을 입력해주세요.')
      if (!penName.trim()) return flashField('penName', '예명을 입력해주세요.')
      if (!region) return flashField('region', '지역을 선택해주세요.')
      if (!phoneVerified) return flashField('phone', '휴대폰 인증을 완료해주세요.')
      if (!field) return flashField('counselField', '상담분야를 선택해주세요.')
      if (!birth.trim()) return flashField('birth', '생년월일을 입력해주세요.')
      if (specialties.length === 0) return flashField('specialties', '전문 상담분야를 1개 이상 선택해주세요.')
      if (!profilePhoto) return flashField('profilePhoto', '프로필 사진을 등록해주세요.')
      const introHtml = (introEditorRef.current?.getHTML() ?? intro).trim()
      if (!introHtml || introHtml === '<p><br></p>') {
        return flashField('intro', '본인 소개를 입력해주세요.')
      }
      setIntro(introHtml)
    } else {
      // ── 문의 (inquiry/other): 간단 폼 필수 검증 ──
      if (!name.trim()) return flashField('name', '이름을 입력해주세요.')
      if (!phoneVerified) return flashField('phone', '휴대폰 인증을 완료해주세요.')
      const introHtml = (introEditorRef.current?.getHTML() ?? intro).trim()
      if (!introHtml || introHtml === '<p><br></p>') {
        return flashField('intro', '문의 내용을 입력해주세요.')
      }
      setIntro(introHtml)
    }
    if (!captchaInput.trim()) return flashField('captcha', '자동등록방지 문자를 입력해주세요.')
    setSubmitOpen(true)
  }

  const handleSubmitConfirm = async () => {
    setSubmitOpen(false)
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const introHtml = (introEditorRef.current?.getHTML() ?? intro).trim()
      const basePayload = {
        apply_type: applyType,
        title: title.trim(),
        content: introHtml,
        applicant_phone: phone.replace(/[^0-9]/g, ''),
        applicant_email: email.trim() || undefined,
        is_secret: true,
        captcha_token: captchaToken,
        captcha_input: captchaInput.trim(),
      }
      // 지원/문의 분기 — 풀폼만 계정/사진/분야 등 전체 전송
      if (isFullForm) {
        await counselorApplyApi.create({
          ...basePayload,
          mb_id: accountId.trim(),
          password: accountPw,
          extras: {
            status,
            real_name: name.trim(),
            pen_name: penName.trim(),
            region,
            field,
            birth: birth.trim(),
            specialties,
            intro: introHtml,
            profile_photo_url: profilePhoto,
            profile_photo_url_webp: profilePhotoWebp,
            contract_files: contractFiles,
          },
        })
      } else {
        await counselorApplyApi.create({
          ...basePayload,
          extras: {
            status,
            real_name: name.trim(),
          },
        })
      }
      // 토스트 대신 전용 완료 페이지로 이동 — 다음 단계 (관리자 검토/SMS/로그인) 안내.
      // applyType 을 state 로 전달해서 application/inquiry/other 별 문구 분기.
      navigate('/mypage/counselor-apply/done', {
        state: { applyType },
        replace: true,
      })
    } catch (e) {
      // 캡차 실패면 자동 새로고침
      if (e instanceof ApiError && /캡차|자동등록방지/.test(e.message)) {
        void refreshCaptcha()
      }
      setErrorMsg(`신청 실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}`)
      setSubmitting(false)
    }
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
          <div id="field-status">
            <Field label="신청상태" required>
              {/* 2026-05-16: select → 토글 버튼 그룹 (한눈에 옵션 다 보임) */}
              <div className="flex gap-2 flex-wrap">
                {APPLY_STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setStatus(opt)}
                    className={`flex-1 min-w-[100px] px-3 py-2.5 rounded-full text-[14px] font-medium border transition ${
                      status === opt
                        ? 'bg-[#9B7AF7] text-white border-[#9B7AF7]'
                        : 'bg-white text-[#4A5565] border-[#E5E7EB] hover:border-[#9B7AF7]'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <div id="field-title">
            <Field label="제목" required>
              <TextInput value={title} onChange={setTitle} placeholder="제목을 입력해주세요." />
            </Field>
          </div>

          {/* 계정 정보 — 승인 후 그대로 로그인용으로 사용됨 (상담사 지원에서만) */}
          {isFullForm && (
          <div id="field-accountId" className="rounded-[12px] border border-[#E5E7EB] bg-white px-4 py-4 space-y-3">
            <p className="text-[13px] font-semibold text-[#030712]">
              계정 정보 <span className="text-[#FF6467] ml-0.5">*</span>
            </p>
            <div className="rounded-[10px] bg-[#FFF8E1] border border-[#FFE08A] px-3 py-2.5 flex items-start gap-2">
              <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0 mt-0.5" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="9.5" stroke="#B45309" strokeWidth="1.6" />
                <path d="M12 7.5V13" stroke="#B45309" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="12" cy="16.5" r="1.1" fill="#B45309" />
              </svg>
              <p className="text-[12.5px] leading-[150%] text-[#92591F]">
                <span className="font-semibold">상담사 신규 가입 단계입니다.</span> 관리자가 지원을 승인하면, 아래에서 정한 아이디·비밀번호로 상담사 로그인을 하시게 됩니다. <span className="font-medium">기존 회원 아이디가 아닌 새로 정한 아이디</span>를 입력해주세요.
              </p>
            </div>
            <div>
              <label className="block text-[13px] leading-[140%] font-medium text-[#030712] mb-1.5">
                아이디<span className="text-[#FF6467] ml-0.5">*</span>
              </label>
              <input
                type="text"
                value={accountId}
                onChange={(e) => {
                  setAccountId(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20))
                  setAccountIdStatus(null)
                }}
                onBlur={onAccountIdBlur}
                placeholder="영문/숫자/언더스코어 4~20자"
                autoComplete="off"
                className="w-full h-[44px] px-4 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] text-[15px] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none"
              />
              {accountIdChecking && (
                <p className="mt-1 text-[12px] text-[#99A1AF]">중복 확인 중…</p>
              )}
              {!accountIdChecking && accountIdStatus && accountIdStatus.available && (
                <p className="mt-1 text-[12px] text-[#10B981]">✓ 사용 가능한 아이디입니다.</p>
              )}
              {!accountIdChecking && accountIdStatus && !accountIdStatus.available && (
                <p className="mt-1 text-[12px] text-[#FB2C36]">
                  {accountIdStatus.reason ?? '사용할 수 없는 아이디입니다.'}
                </p>
              )}
            </div>
            <div>
              <label className="block text-[13px] leading-[140%] font-medium text-[#030712] mb-1.5">
                비밀번호<span className="text-[#FF6467] ml-0.5">*</span>
              </label>
              <input
                type="password"
                value={accountPw}
                onChange={(e) => setAccountPw(e.target.value)}
                placeholder="6자 이상"
                autoComplete="new-password"
                className="w-full h-[44px] px-4 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] text-[15px] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[13px] leading-[140%] font-medium text-[#030712] mb-1.5">
                비밀번호 확인<span className="text-[#FF6467] ml-0.5">*</span>
              </label>
              <input
                type="password"
                value={accountPwConfirm}
                onChange={(e) => setAccountPwConfirm(e.target.value)}
                placeholder="비밀번호를 한 번 더 입력"
                autoComplete="new-password"
                className="w-full h-[44px] px-4 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] text-[15px] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none"
              />
              {accountPwConfirm && accountPw !== accountPwConfirm && (
                <p className="mt-1 text-[12px] text-[#FB2C36]">비밀번호가 일치하지 않습니다.</p>
              )}
            </div>
          </div>
          )}

          <div id="field-name">
            <Field label="이름" required>
              <TextInput value={name} onChange={setName} placeholder="이름을 입력해주세요." />
            </Field>
          </div>
          {isFullForm && (
            <>
              <div id="field-penName">
                <Field label="예명" required>
                  <TextInput value={penName} onChange={setPenName} placeholder="예명을 입력해주세요." />
                </Field>
              </div>
              <div id="field-region">
                <Field label="지역" required>
                  <SimpleSelect value={region} options={APPLY_REGION_OPTIONS} placeholder="지역 선택" onChange={setRegion} />
                </Field>
              </div>
            </>
          )}

          {/* 휴대폰 + 인증번호 */}
          <div id="field-phone">
          <Field label="휴대폰번호" required>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 11))
                  setPhoneVerified(false)
                  setPhoneSent(false)
                  setPhoneCode('')
                  setPhoneStatus('none')
                }}
                onBlur={onPhoneBlur}
                placeholder="'-' 없이 숫자만 입력해주세요."
                disabled={phoneVerified}
                className="flex-1 h-[48px] px-4 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] text-[15px] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none disabled:bg-[#F3F4F6]"
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={phoneSending || phoneVerified || phoneStatus === 'accepted'}
                className={`shrink-0 h-[48px] px-4 rounded-full text-[14px] font-medium ${
                  phoneVerified
                    ? 'bg-[#10B981] text-white'
                    : phoneSending || phoneStatus === 'accepted'
                    ? 'bg-[#D1D5DB] text-white'
                    : 'bg-[#9B7AF7] text-white'
                }`}
              >
                {phoneVerified ? '인증완료' : phoneSent ? '재전송' : '인증번호'}
              </button>
            </div>
            {phoneStatus === 'accepted' && !phoneVerified && (
              <p className="mt-1.5 text-[12px] text-[#FB2C36]">
                이미 같은 휴대폰으로 가입된 상담사가 있습니다. 로그인 후 이용해주세요.
              </p>
            )}
            {phoneStatus === 'pending' && !phoneVerified && (
              <p className="mt-1.5 text-[12px] text-[#8259F5]">
                같은 휴대폰으로 검토중인 신청이 있습니다 — 새 신청 시 기존 신청은 자동으로 대체됩니다.
              </p>
            )}
            {phoneSent && !phoneVerified && (
              <>
                <div className="mt-2 flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      placeholder="인증번호 입력"
                      className="w-full h-[48px] px-4 pr-14 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] text-[15px] text-[#1E2939] focus:outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-[#FB2C36]">
                      {phoneTimerLabel}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyCode}
                    disabled={phoneVerifying || phoneTimer === 0}
                    className={`shrink-0 h-[48px] px-4 rounded-full text-[14px] font-medium ${
                      phoneVerifying || phoneTimer === 0
                        ? 'bg-[#D1D5DB] text-white'
                        : 'bg-[#9B7AF7] text-white'
                    }`}
                  >
                    확인
                  </button>
                </div>
                <p className="mt-1.5 text-[12.5px] leading-[150%] text-[#FB2C36] font-medium flex items-center gap-1">
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" fill="none" aria-hidden>
                    <circle cx="8" cy="8" r="6.5" stroke="#FB2C36" strokeWidth="1.4"/>
                    <path d="M8 5V8.5" stroke="#FB2C36" strokeWidth="1.6" strokeLinecap="round"/>
                    <circle cx="8" cy="11" r="0.8" fill="#FB2C36"/>
                  </svg>
                  인증번호 입력 후 <span className="underline underline-offset-2">[확인]</span> 버튼을 꼭 눌러주세요.
                </p>
              </>
            )}
            {phoneVerified && (
              <p className="mt-1.5 text-[13px] text-[#10B981]">✓ 휴대폰 인증이 완료되었습니다.</p>
            )}
          </Field>
          </div>

          <Field label="이메일">
            <TextInput value={email} onChange={setEmail} placeholder="이메일 주소를 입력해주세요." />
          </Field>
          {isFullForm && (
            <>
              <div id="field-counselField">
              <Field label="상담분야" required>
                <div className="flex gap-2 flex-wrap">
                  {APPLY_FIELD_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setField(opt)}
                      className={`flex-1 min-w-[80px] px-3 py-2.5 rounded-full text-[14px] font-medium border transition ${
                        field === opt
                          ? 'bg-[#9B7AF7] text-white border-[#9B7AF7]'
                          : 'bg-white text-[#4A5565] border-[#E5E7EB] hover:border-[#9B7AF7]'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </Field>
              </div>
              <div id="field-birth">
                <Field label="생년월일" required>
                  <TextInput value={birth} onChange={setBirth} placeholder="YYYY-MM-DD" />
                </Field>
              </div>

              <div id="field-specialties">
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

              {/* 프로필 사진 — 관리자 페이지와 동일 (정사각 200×200, JPG/PNG/GIF/WEBP) */}
              <div id="field-profilePhoto">
              <FileUploadField
                label="프로필 사진"
                required
                hint="JPG/PNG/GIF/WEBP · 30MB 이하 · 권장 사이즈 200×200 (정사각 인물)"
                inputRef={profileFileRef}
                accept="image/jpeg,image/png,image/gif,image/webp"
                uploading={uploading === 'profile'}
                currentFileName={profilePhoto ? extractFileName(profilePhoto) : null}
                onPick={(f) => handleUpload('profile', f)}
                onRemove={() => {
                  setProfilePhoto(null)
                  setProfilePhotoWebp(null)
                }}
                preview={
                  profilePhoto ? (
                    <UploadedImage
                      src={profilePhoto}
                      srcWebp={profilePhotoWebp}
                      alt="프로필 미리보기"
                      className="block"
                      style={{ width: 200, height: 200, objectFit: 'cover' }}
                    />
                  ) : null
                }
              />
              </div>

              {/* 사업자 / 계약 관련 파일 — PDF 또는 이미지, 여러 장 */}
              <ContractUploadField
                label="사업자 / 계약 관련 파일"
                hint="PDF/JPG/PNG/WEBP · 각 30MB 이하 · 여러 장 가능 (사업자등록증, 신분증, 계약서 등)"
                inputRef={contractFileRef}
                uploading={uploading === 'contract'}
                files={contractFiles}
                onPick={(f) => handleUpload('contract', f)}
                onRemove={(idx) =>
                  setContractFiles((prev) => prev.filter((_, i) => i !== idx))
                }
              />
            </>
          )}

          <div id="field-intro">
            <p className="text-[14px] leading-[140%] font-semibold text-[#030712] mb-2">
              {isFullForm ? '본인 소개' : '문의 내용'}<span className="text-[#FF6467] ml-0.5">*</span>
            </p>
            {isFullForm ? (
              <div className="rounded-[10px] bg-[#EFF6FF] border border-[#BFDBFE] px-3 py-2.5 mb-2">
                <p className="text-[13px] leading-[150%] text-[#1E40AF]">
                  상담사 상세 페이지의 <span className="font-semibold">소개 본문으로 노출</span>됩니다. 이미지·서식 포함 가능.
                </p>
                <p className="text-[12px] leading-[150%] text-[#3B82F6] mt-1">
                  💡 부담 갖지 마세요 — <span className="font-semibold">가입 후 마이페이지에서 언제든 수정 가능합니다.</span>
                </p>
              </div>
            ) : (
              <p className="text-[13px] leading-[150%] text-[#6A7282] mb-2">
                문의하실 내용을 자세히 적어주세요. 빠르게 회신드리겠습니다.
              </p>
            )}
            <div className="rounded-[12px] overflow-hidden border border-[#F3F4F6]">
              <HtmlEditor
                ref={introEditorRef}
                initialHtml={intro}
                height="360px"
              />
            </div>
          </div>

          {/* 자동등록방지 — 실제 SVG 캡차 */}
          <div id="field-captcha">
          <Field label="자동등록방지" required>
            <div className="flex gap-2 items-center">
              <div
                className="h-[48px] px-3 rounded-[8px] bg-white border border-[#E5E7EB] flex items-center justify-center min-w-[120px]"
                aria-label="자동등록방지 이미지"
                dangerouslySetInnerHTML={{ __html: captchaSvg }}
              />
              <input
                type="text"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                placeholder="입력"
                className="flex-1 h-[48px] px-4 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] text-[15px] text-[#1E2939] focus:outline-none"
              />
              <button
                type="button"
                onClick={refreshCaptcha}
                disabled={captchaLoading}
                aria-label="새로고침"
                className="w-[48px] h-[48px] rounded-full bg-[#F9FAFB] border border-[#F3F4F6] flex items-center justify-center"
              >
                <img src="/img/ic_reset.svg" alt="" className="w-5 h-5" />
              </button>
            </div>
          </Field>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 px-3 py-2.5 rounded-[12px] bg-[#FEEBEE] border border-[#FFC9CB]">
            <p className="text-[13px] text-[#FF6467] leading-[140%] break-keep">{errorMsg}</p>
          </div>
        )}

        <div className="mt-8">
          <button
            type="button"
            onClick={handleSubmitClick}
            disabled={submitting}
            className={`w-full h-[52px] rounded-full text-[16px] font-medium text-white ${
              submitting ? 'bg-[#D1D5DB]' : 'bg-[#9B7AF7]'
            }`}
          >
            {submitting ? '신청 중...' : '작성완료'}
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

/** URL 끝의 파일명만 추출 — 사용자에게 노출할 표시용. */
function extractFileName(url: string): string {
  const m = url.match(/[^/]+$/)
  return m ? m[0] : url
}

/** 파일 크기를 사람이 읽기 좋은 문자열로 — 사업자 파일 목록 표시용. */
function formatBytes(size: number): string {
  if (size < 1024) return `${size}B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`
  return `${(size / (1024 * 1024)).toFixed(1)}MB`
}

/**
 * 관리자 페이지와 동일한 형태의 단일 슬롯 파일 업로더.
 * 좌측에 라벨/힌트가 있는 Field 와 달리, 이 컴포넌트는 자체적으로
 *  - 상단 헤더: "[파일 선택]  선택된 파일 없음  [삭제]"
 *  - 하단 미리보기
 * 의 2단 구성으로 노출된다. (관리자 CounselorForm.tsx FileSlot 과 동일.)
 */
function FileUploadField({
  label,
  required,
  hint,
  inputRef,
  accept,
  uploading,
  currentFileName,
  onPick,
  onRemove,
  preview,
}: {
  label: string
  required?: boolean
  hint?: string
  inputRef: React.RefObject<HTMLInputElement | null>
  accept: string
  uploading: boolean
  currentFileName: string | null
  onPick: (file: File) => void
  onRemove: () => void
  preview: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[14px] leading-[140%] font-semibold text-[#030712] mb-1.5">
        {label}
        {required && <span className="text-[#FF6467] ml-0.5">*</span>}
      </label>
      {hint && (
        <p className="text-[12px] leading-[140%] text-[#99A1AF] mb-2 whitespace-pre-line">
          {hint}
        </p>
      )}

      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onPick(f)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="h-[36px] px-4 rounded-[8px] bg-[#9B7AF7] text-white text-[14px] font-medium disabled:opacity-60"
        >
          파일 선택
        </button>
        <span className="text-[13px] text-[#6A7282] flex-1 truncate min-w-0">
          {uploading ? '업로드 중…' : currentFileName ?? '선택된 파일 없음'}
        </span>
        {currentFileName && !uploading && (
          <button
            type="button"
            onClick={onRemove}
            className="text-[13px] text-[#FB2C36] font-medium"
          >
            삭제
          </button>
        )}
      </div>

      {preview && <div className="mt-1">{preview}</div>}
    </div>
  )
}

/**
 * 사업자/계약 관련 파일 — 여러 장 + PDF 가능.
 * 관리자 CounselorForm.tsx 의 contract FileSlot (multipleSlot) 과 동일한 동작.
 */
function ContractUploadField({
  label,
  hint,
  inputRef,
  uploading,
  files,
  onPick,
  onRemove,
}: {
  label: string
  hint: string
  inputRef: React.RefObject<HTMLInputElement | null>
  uploading: boolean
  files: Array<{ url: string; original_name: string; size: number }>
  onPick: (file: File) => void
  onRemove: (idx: number) => void
}) {
  return (
    <div>
      <label className="block text-[14px] leading-[140%] font-semibold text-[#030712] mb-1.5">
        {label}
      </label>
      <p className="text-[12px] leading-[140%] text-[#99A1AF] mb-2 whitespace-pre-line">
        {hint}
      </p>

      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onPick(f)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="h-[36px] px-4 rounded-[8px] bg-[#9B7AF7] text-white text-[14px] font-medium disabled:opacity-60"
        >
          파일 추가
        </button>
        <span className="text-[13px] text-[#6A7282]">
          {uploading
            ? '업로드 중…'
            : files.length === 0
            ? '선택된 파일 없음'
            : `${files.length}개 첨부됨`}
        </span>
      </div>

      {files.length > 0 && (
        <ul className="mt-1 space-y-2">
          {files.map((f, i) => {
            const isImage = /\.(jpe?g|png|gif|webp)$/i.test(f.original_name)
            const isPdf = /\.pdf$/i.test(f.original_name)
            return (
              <li
                key={`${f.url}-${i}`}
                className="flex items-center gap-3 px-3 py-2 rounded-[10px] bg-[#F9FAFB] border border-[#F3F4F6]"
              >
                {isImage ? (
                  <UploadedImage
                    src={f.url}
                    alt={f.original_name}
                    style={{ width: 48, height: 48, objectFit: 'cover' }}
                    className="rounded-[6px] border border-[#E5E7EB]"
                  />
                ) : (
                  <span className="w-12 h-12 rounded-[6px] bg-white border border-[#E5E7EB] flex items-center justify-center text-[10px] font-mono text-[#6A7282]">
                    {isPdf ? 'PDF' : 'FILE'}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#1E2939] truncate" title={f.original_name}>
                    {f.original_name}
                  </p>
                  <p className="text-[11px] text-[#99A1AF]">{formatBytes(f.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  aria-label="삭제"
                  className="text-[13px] text-[#FB2C36] font-medium px-2"
                >
                  삭제
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
