import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import MobileHeader from '../components/MobileHeader'
import InputField from '../components/InputField'
import PrimaryButton, { OutlineButton } from '../components/PrimaryButton'
import { CalendarIcon, RefreshIcon } from '../components/icons'
import TermsModal, { TermsKind } from '../components/TermsModal'
import { ApiError, authApi } from '../lib/api'

type Gender = 'M' | 'F' | ''
type DateMode = 'solar' | 'lunar'
type SocialProvider = 'kakao' | 'naver'

/**
 * 회원가입 페이지 — Figma node 13:3112 (01로그인_회원가입)
 * 한 페이지에 폼 전체. 휴대폰 인증은 내부 상태로 단계 전환.
 *
 * 두 가지 모드:
 *  - 로컬: ?social 없음. 추후 휴대폰 인증/캡차 정책 합의 후 활성. 현재는 alert로 막아둠.
 *  - 소셜(?social=kakao|naver): 카카오/네이버 콜백에서 발급된 sjm_social_pending
 *    쿠키의 프로필을 prefill. loginId/password/captcha 필드는 숨김. 약관·이름·닉네임 필수.
 */
export default function Signup() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const socialParam = searchParams.get('social')
  const initialSocial: SocialProvider | null =
    socialParam === 'kakao' || socialParam === 'naver' ? socialParam : null

  // 소셜 모드: pending 프로필 로드
  const [social, setSocial] = useState<SocialProvider | null>(initialSocial)
  const [socialLoading, setSocialLoading] = useState<boolean>(!!initialSocial)

  const [form, setForm] = useState({
    loginId: '',
    password: '',
    passwordConfirm: '',
    name: '',
    gender: '' as Gender,
    nickname: '',
    email: '',
    phone: '',
    phoneCode: '',
    dateMode: 'solar' as DateMode,
    birth: '',
    zipcode: '',
    addr1: '',
    addr2: '',
    referrer: '',
    captcha: '',
  })

  const update = <K extends keyof typeof form>(key: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [key]: v }))

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const [phoneSent, setPhoneSent] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [timer, setTimer] = useState(0) // 초 단위
  const [submitting, setSubmitting] = useState(false)

  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agreeEmail, setAgreeEmail] = useState(false)
  const [agreeSms, setAgreeSms] = useState(false)

  const [modal, setModal] = useState<TermsKind | null>(null)

  // 휴대폰 인증 타이머 (3:00 = 180초)
  useEffect(() => {
    if (!phoneSent || phoneVerified) return
    if (timer <= 0) return
    const id = setInterval(() => setTimer((t) => t - 1), 1000)
    return () => clearInterval(id)
  }, [phoneSent, phoneVerified, timer])

  // 소셜 모드: 콜백에서 심어둔 pending 프로필 로드 → 폼 prefill.
  // pending 이 비어 있으면 (만료/직접 진입 등) 로그인 페이지로 돌려보냄.
  useEffect(() => {
    if (!initialSocial) return
    let alive = true
    authApi.socialPending().then(
      (res) => {
        if (!alive) return
        if (!res.pending) {
          alert('소셜 인증 정보가 없거나 만료되었습니다. 다시 시도해주세요.')
          navigate('/login', { replace: true })
          return
        }
        const pp = res.pending
        setSocial(pp.provider)
        // 카카오는 사업자 검증 없이는 'name' 을 안 줌 → nickname 으로 fallback (사용자가 수정 가능)
        setForm((p) => ({
          ...p,
          name: pp.name ?? pp.nickname ?? p.name,
          nickname: pp.nickname ?? p.nickname,
          email: pp.email ?? p.email,
          phone: (pp.phone ?? '').replace(/[^0-9]/g, '') || p.phone,
        }))
        setSocialLoading(false)
      },
      () => {
        if (!alive) return
        alert('소셜 정보 조회에 실패했습니다.')
        navigate('/login', { replace: true })
      },
    )
    return () => {
      alive = false
    }
  }, [initialSocial, navigate])

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60)
    const ss = s % 60
    return `${m}:${ss.toString().padStart(2, '0')}`
  }

  // 핸들러
  const onCheckId = () => {
    // TODO: 아이디 중복확인 API
    if (!form.loginId.trim()) {
      setErrors((p) => ({ ...p, loginId: '아이디를 입력해주세요.' }))
      return
    }
    alert(`'${form.loginId}' 사용 가능 여부 확인 (미구현)`)
  }

  const onSendPhoneCode = () => {
    // TODO: 휴대폰 인증번호 전송 API
    if (!/^\d{10,11}$/.test(form.phone)) {
      setErrors((p) => ({ ...p, phone: "'-' 없이 숫자만 입력해주세요." }))
      return
    }
    setErrors((p) => ({ ...p, phone: '' }))
    setPhoneSent(true)
    setTimer(180)
  }

  const onVerifyPhoneCode = () => {
    // TODO: 인증번호 검증 API
    if (form.phoneCode.length !== 6) {
      setErrors((p) => ({ ...p, phoneCode: '인증번호 6자리를 입력해주세요.' }))
      return
    }
    setPhoneVerified(true)
    setErrors((p) => ({ ...p, phoneCode: '' }))
  }

  const onAddressSearch = () => {
    // TODO: Daum 우편번호 서비스 연동
    alert('주소 검색 (미구현)')
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return

    const errs: Record<string, string> = {}
    // 소셜 가입: loginId/password/captcha/휴대폰인증 검증 생략 (OAuth 통과 = 본인 인증)
    if (!social) {
      if (!form.loginId.trim()) errs.loginId = '아이디를 입력해주세요.'
      else if (form.loginId.trim().length < 3) errs.loginId = '아이디는 3자 이상이어야 합니다.'
      else if (!/^[A-Za-z0-9._-]+$/.test(form.loginId.trim()))
        errs.loginId = '아이디는 영문/숫자/._- 만 사용 가능합니다.'

      if (!form.password) errs.password = '비밀번호를 입력해주세요.'
      else if (form.password.length < 8)
        errs.password = '비밀번호는 8자 이상이어야 합니다.'

      if (form.password !== form.passwordConfirm)
        errs.passwordConfirm = '비밀번호가 일치하지 않습니다.'

      if (!phoneVerified) errs.phone = '휴대폰 인증을 완료해주세요.'
      if (!form.captcha.trim()) errs.captcha = '자동등록방지를 입력해주세요.'
    }
    if (!form.name.trim()) errs.name = '이름을 입력해주세요.'
    if (!form.gender) errs.gender = '성별을 선택해주세요.'
    if (!form.nickname.trim()) errs.nickname = '닉네임을 입력해주세요.'
    // 이메일: 소셜은 화면 비노출 (hidden input). prefill 값이 있을 수도/없을 수도. UI 검증 생략.
    if (!social) {
      if (!form.email.trim()) errs.email = '이메일을 입력해주세요.'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
        errs.email = '이메일 형식이 올바르지 않습니다.'
    }
    // 휴대폰번호 — 소셜 모드에서 입력했다면 형식 검증 (선택값이지만 입력했으면 9~11자리)
    if (social && form.phone && !/^[0-9]{9,11}$/.test(form.phone))
      errs.phone = '휴대폰번호는 숫자 9~11자리로 입력해주세요.'
    // 생년월일 — 입력했다면 8자리 숫자(YYYYMMDD) 또는 'YYYY. MM. DD' 형식
    if (form.birth.trim() && !parseBirthYmd(form.birth))
      errs.birth = '생년월일은 YYYY. MM. DD 형식으로 입력해주세요.'
    if (!form.referrer.trim()) errs.referrer = '유입경로를 입력해주세요.'
    if (!agreeTerms) errs.agreeTerms = '회원가입약관에 동의해주세요.'
    if (!agreePrivacy) errs.agreePrivacy = '개인정보처리방침에 동의해주세요.'

    if (Object.keys(errs).length) {
      setErrors(errs)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSubmitting(true)
    try {
      if (social) {
        // 소셜 가입 — 백엔드는 sjm_social_pending 쿠키와 폼을 합쳐 member 생성 + JWT 발급
        await authApi.signup({
          name: form.name.trim(),
          nickname: form.nickname.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          birth_date: parseBirthYmd(form.birth) ?? undefined,
          gender: (form.gender || undefined) as 'M' | 'F' | undefined,
          calendar_type: form.dateMode === 'lunar' ? 'LUNAR' : 'SOLAR',
          addr1: form.addr1 || undefined,
          addr2: form.addr2 || undefined,
          zip: form.zipcode || undefined,
          acquisition_source: form.referrer.trim() || undefined,
          agree_terms: agreeTerms,
          agree_privacy: agreePrivacy,
          agree_email: agreeEmail,
          agree_sms: agreeSms,
        })
        navigate('/signup/complete', { replace: true })
        return
      }
      // 로컬 가입은 추후 — 휴대폰 인증/캡차 API 합의 후
      alert('일반 회원가입은 준비 중입니다. 카카오/네이버 가입을 이용해주세요.')
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : '회원가입 중 오류가 발생했습니다.'
      alert(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mobile-frame flex flex-col">
      <MobileHeader title="회원가입" />

      <main className="flex-1 px-4 pb-8">
        {socialLoading && (
          <div className="py-10 text-center text-[14px] text-[#6A7282]">
            소셜 정보를 불러오는 중...
          </div>
        )}
        {social && !socialLoading && (
          <div className="mb-3 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[14px] text-[#374151]">
            <strong className="font-semibold">
              {social === 'kakao' ? '카카오' : '네이버'}
            </strong>{' '}
            계정으로 가입을 진행합니다. 추가 정보를 입력해주세요.
          </div>
        )}
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          {/* 아이디·비밀번호: 로컬 가입에서만 노출 — 소셜은 OAuth 로 본인확인 끝. */}
          {!social && (
            <>
              <Field label="아이디" required error={errors.loginId}>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <InputField
                      value={form.loginId}
                      onChange={(v) =>
                        update('loginId', v.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 60))
                      }
                      placeholder="아이디를 입력해주세요."
                      onClear={() => update('loginId', '')}
                      error={!!errors.loginId}
                      rightPadding="md"
                      maxLength={60}
                      pattern="[A-Za-z0-9._\\-]+"
                    />
                  </div>
                  <OutlineButton type="button" onClick={onCheckId}>중복확인</OutlineButton>
                </div>
              </Field>

              <Field label="비밀번호" required error={errors.password}>
                <InputField
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={(v) => update('password', v.slice(0, 50))}
                  placeholder="영문/숫자/특수문자 조합 8자 이상"
                  autoComplete="new-password"
                  error={!!errors.password}
                  rightSlot={<EyeToggle on={showPw} onClick={() => setShowPw((v) => !v)} />}
                  rightPadding="md"
                  maxLength={50}
                />
              </Field>

              <Field label="비밀번호 확인" required error={errors.passwordConfirm}>
                <InputField
                  type={showPw2 ? 'text' : 'password'}
                  value={form.passwordConfirm}
                  onChange={(v) => update('passwordConfirm', v.slice(0, 50))}
                  placeholder="비밀번호를 한번 더 입력해주세요."
                  autoComplete="new-password"
                  error={!!errors.passwordConfirm}
                  rightSlot={<EyeToggle on={showPw2} onClick={() => setShowPw2((v) => !v)} />}
                  rightPadding="md"
                  maxLength={50}
                />
              </Field>
            </>
          )}

          {/* 이름 */}
          <Field label="이름" required error={errors.name}>
            <InputField
              value={form.name}
              onChange={(v) => update('name', v.slice(0, 50))}
              placeholder="이름을 입력해주세요."
              error={!!errors.name}
              onClear={() => update('name', '')}
              maxLength={50}
            />
          </Field>

          {/* 성별 */}
          <Field label="성별" required error={errors.gender}>
            <div className="grid grid-cols-2 gap-2.5">
              <ToggleButton selected={form.gender === 'M'} onClick={() => update('gender', 'M')}>
                남자
              </ToggleButton>
              <ToggleButton selected={form.gender === 'F'} onClick={() => update('gender', 'F')}>
                여자
              </ToggleButton>
            </div>
          </Field>

          {/* 닉네임 — DB varchar(40), 운영 정책상 30자로 제한 */}
          <Field label="닉네임" required error={errors.nickname}>
            <InputField
              value={form.nickname}
              onChange={(v) => update('nickname', v.slice(0, 30))}
              placeholder="닉네임을 입력해주세요."
              error={!!errors.nickname}
              onClear={() => update('nickname', '')}
              maxLength={30}
            />
          </Field>

          {/* 이메일 — 소셜은 hidden input 으로만 유지 (값은 prefill, 화면 비노출) */}
          {social ? (
            <input type="hidden" name="email" value={form.email} readOnly />
          ) : (
            <Field label="이메일" required error={errors.email}>
              <InputField
                type="email"
                value={form.email}
                onChange={(v) => update('email', v)}
                placeholder="이메일 주소를 입력해주세요."
                autoComplete="email"
                error={!!errors.email}
                onClear={() => update('email', '')}
              />
            </Field>
          )}

          {/* 휴대폰번호 — 소셜은 SMS 인증 생략 (OAuth로 본인확인 완료). 숫자만 11자리. */}
          {social ? (
            <Field label="휴대폰번호" error={errors.phone}>
              <InputField
                type="tel"
                value={form.phone}
                onChange={(v) => update('phone', v.replace(/[^0-9]/g, '').slice(0, 11))}
                placeholder="'-' 없이 숫자만 입력해주세요."
                autoComplete="tel"
                error={!!errors.phone}
                rightPadding="sm"
                maxLength={11}
                inputMode="numeric"
                pattern="\d*"
              />
            </Field>
          ) : (
            <Field
              label="휴대폰번호"
              required
              error={errors.phone}
              rightLabel={phoneSent && !phoneVerified ? <span className="text-[#FF6467] font-medium">{fmtTime(timer)}</span> : null}
            >
              <div className="flex gap-2">
                <div className="flex-1">
                  <InputField
                    type="tel"
                    value={form.phone}
                    onChange={(v) => update('phone', v.replace(/[^0-9]/g, '').slice(0, 11))}
                    placeholder="'-' 없이 숫자만 입력해주세요."
                    autoComplete="tel"
                    error={!!errors.phone}
                    rightPadding="sm"
                    disabled={phoneVerified}
                    maxLength={11}
                    inputMode="numeric"
                    pattern="\d*"
                  />
                </div>
                <OutlineButton type="button" onClick={onSendPhoneCode} disabled={phoneVerified}>
                  {phoneSent ? '재전송' : '인증번호 전송'}
                </OutlineButton>
              </div>
              {phoneSent && !phoneVerified && (
                <div className="flex gap-2 mt-2.5">
                  <div className="flex-1">
                    <InputField
                      value={form.phoneCode}
                      onChange={(v) => update('phoneCode', v.replace(/[^0-9]/g, '').slice(0, 6))}
                      placeholder="인증번호를 입력하세요."
                      error={!!errors.phoneCode}
                      rightPadding="sm"
                      maxLength={6}
                      inputMode="numeric"
                      pattern="\d*"
                    />
                  </div>
                  <OutlineButton type="button" onClick={onVerifyPhoneCode}>인증하기</OutlineButton>
                </div>
              )}
              {phoneVerified && (
                <div className="text-[13px] text-[#10b981] mt-1.5">✓ 휴대폰 인증이 완료되었습니다.</div>
              )}
            </Field>
          )}

          {/* 생년월일 — 8자리 숫자만 받고 'YYYY. MM. DD' 로 자동 포맷 */}
          <Field label="생년월일" error={errors.birth}>
            <div className="grid grid-cols-2 gap-2.5 mb-2.5">
              <ToggleButton selected={form.dateMode === 'solar'} onClick={() => update('dateMode', 'solar')}>
                양력
              </ToggleButton>
              <ToggleButton selected={form.dateMode === 'lunar'} onClick={() => update('dateMode', 'lunar')}>
                음력
              </ToggleButton>
            </div>
            <InputField
              value={form.birth}
              onChange={(v) => update('birth', formatBirthInput(v))}
              placeholder="YYYY. MM. DD"
              rightSlot={<CalendarIcon className="w-5 h-5" />}
              rightPadding="md"
              maxLength={14}
              inputMode="numeric"
              error={!!errors.birth}
            />
          </Field>

          {/* 주소 */}
          <Field label="주소">
            <div className="flex gap-2 mb-2.5">
              <div className="flex-1">
                <InputField
                  value={form.zipcode}
                  onChange={(v) => update('zipcode', v.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="우편번호"
                  rightPadding="sm"
                  disabled
                  maxLength={6}
                  inputMode="numeric"
                />
              </div>
              <OutlineButton type="button" onClick={onAddressSearch}>주소검색</OutlineButton>
            </div>
            <div className="flex flex-col gap-2.5">
              <InputField
                value={form.addr1}
                onChange={(v) => update('addr1', v.slice(0, 255))}
                placeholder="기본주소"
                rightPadding="sm"
                disabled
                maxLength={255}
              />
              <InputField
                value={form.addr2}
                onChange={(v) => update('addr2', v.slice(0, 255))}
                placeholder="상세주소"
                rightPadding="sm"
                maxLength={255}
              />
            </div>
          </Field>

          {/* 유입경로 — textarea (최대 2000자) */}
          <Field label="유입경로" required error={errors.referrer}>
            <textarea
              value={form.referrer}
              onChange={(e) => update('referrer', e.target.value.slice(0, 2000))}
              placeholder="어떤 경로로 사주문을 알게 되셨나요? (예 : SNS, 지인 추천, 인터넷 검색 등)"
              rows={3}
              maxLength={2000}
              className={`w-full rounded-2xl bg-[#f9fafb] border ${errors.referrer ? 'border-[#f87171]' : 'border-[#f3f4f6]'} focus:border-brand-400 focus:bg-white px-4 py-3 text-[15px] text-[#1e2939] placeholder-[#99a1af] focus:outline-none transition resize-none`}
            />
          </Field>

          <hr className="my-2 border-[#e5e7eb]" />

          {/* 자동등록방지 — 소셜은 OAuth 통과 = 사람 확인됨 → 생략 */}
          {!social && (
            <Field label="자동등록방지" required error={errors.captcha}>
              <div className="flex gap-2 items-center">
                <div className="w-[100px] h-10 rounded-md bg-white border border-[#e5e7eb] flex items-center justify-center font-mono text-[15px] tracking-widest text-[#1e2939]" aria-label="자동등록방지 캡차">
                  5A7965
                </div>
                <div className="flex-1">
                  <InputField
                    value={form.captcha}
                    onChange={(v) => update('captcha', v.slice(0, 6))}
                    placeholder=""
                    rightPadding="sm"
                    maxLength={6}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => alert('캡차 새로고침 (미구현)')}
                  className="w-10 h-10 rounded-full border border-[#e5e7eb] bg-white flex items-center justify-center hover:bg-gray-50 transition"
                  aria-label="캡차 새로고침"
                >
                  <RefreshIcon className="w-5 h-5" />
                </button>
              </div>
            </Field>
          )}

          {/* 약관 동의 */}
          <div className="flex flex-col gap-3 mt-2">
            <AgreeRow checked={agreeTerms} onChange={setAgreeTerms} required onMore={() => setModal('terms')}>
              (필수) 회원가입약관 동의
            </AgreeRow>
            <AgreeRow checked={agreePrivacy} onChange={setAgreePrivacy} required onMore={() => setModal('privacy')}>
              (필수) 개인정보처리방침 동의
            </AgreeRow>
            <AgreeRow checked={agreeEmail} onChange={setAgreeEmail}>이메일 수신 동의</AgreeRow>
            <AgreeRow checked={agreeSms} onChange={setAgreeSms}>문자 수신 동의</AgreeRow>
          </div>

          {/* 회원가입 버튼 */}
          <PrimaryButton type="submit" loading={submitting} className="mt-4">
            {submitting ? '가입 중...' : '회원가입'}
          </PrimaryButton>
        </form>
      </main>

      <TermsModal kind={modal} onClose={() => setModal(null)} />
    </div>
  )
}

/**
 * 사용자가 입력한 생년월일 문자열을 'YYYY-MM-DD' 로 정규화.
 * — 8자리 숫자(20000101), '2000-01-01', '2000.01.01', '2000/01/01', 'YYYY. MM. DD' 등 허용
 * — 파싱 실패 시 null
 */
function parseBirthYmd(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  const digits = s.replace(/[^0-9]/g, '')
  if (digits.length !== 8) return null
  const y = digits.slice(0, 4)
  const m = digits.slice(4, 6)
  const d = digits.slice(6, 8)
  const yi = Number(y),
    mi = Number(m),
    di = Number(d)
  if (yi < 1900 || yi > 2100) return null
  if (mi < 1 || mi > 12) return null
  if (di < 1 || di > 31) return null
  return `${y}-${m}-${d}`
}

/**
 * 입력 중인 생년월일 문자열을 'YYYY. MM. DD' 모양으로 정돈.
 * — 사용자가 입력하는 동안 자동으로 점·공백을 추가
 * — 8자리 숫자만 추출 후 길이별로 적절히 잘라 보여줌
 */
function formatBirthInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 8)
  if (digits.length <= 4) return digits
  if (digits.length <= 6) return `${digits.slice(0, 4)}. ${digits.slice(4)}`
  return `${digits.slice(0, 4)}. ${digits.slice(4, 6)}. ${digits.slice(6)}`
}

/* ───────────── 서브 컴포넌트 ───────────── */

interface FieldProps {
  label: string
  required?: boolean
  error?: string
  rightLabel?: React.ReactNode
  children: React.ReactNode
}
/** 라벨 + 에러 메시지 wrapper */
function Field({ label, required, error, rightLabel, children }: FieldProps) {
  return (
    <div>
      <div className="flex items-end justify-between mb-1.5">
        <label className="text-[14px] font-semibold text-[#1E2939]">
          {label}
          {required && <span className="text-[#FF6467]"> *</span>}
        </label>
        {rightLabel && <div className="text-[13px]">{rightLabel}</div>}
      </div>
      {children}
      {error && <div className="text-[13px] text-[#FF6467] mt-1.5 ml-2">{error}</div>}
    </div>
  )
}

interface ToggleButtonProps {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}
/** 2개 토글 버튼 (남자/여자, 양력/음력) */
function ToggleButton({ selected, onClick, children }: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-12 rounded-full text-[15px] font-medium transition ${
        selected
          ? 'bg-[#8259F5] text-white'
          : 'bg-white border border-[#8259F5] text-[#8259F5] hover:bg-[#f8f5ff]'
      }`}
    >
      {children}
    </button>
  )
}

interface EyeToggleProps {
  on: boolean
  onClick: () => void
}
function EyeToggle({ on, onClick }: EyeToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-6 h-6 flex items-center justify-center transition hover:opacity-70"
      aria-label={on ? '비밀번호 숨기기' : '비밀번호 보이기'}
    >
      <img src={on ? '/img/ic_input_eye.svg' : '/img/ic_input_eye_closed.svg'} alt="" className="w-6 h-6" />
    </button>
  )
}

interface AgreeRowProps {
  checked: boolean
  onChange: (b: boolean) => void
  required?: boolean
  onMore?: () => void
  children: React.ReactNode
}
/** 약관 동의 행 — 체크박스 + 라벨 + (선택) > 화살표 */
function AgreeRow({ checked, onChange, onMore, children }: AgreeRowProps) {
  return (
    <div className="flex items-center justify-between">
      <label className="flex items-center gap-2 cursor-pointer select-none flex-1">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="text-[14px] text-[#374151]">{children}</span>
      </label>
      {onMore && (
        <button
          type="button"
          onClick={onMore}
          className="w-6 h-6 flex items-center justify-center"
          aria-label="자세히 보기"
        >
          <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
            <path d="M7.5 4L13.5 10L7.5 16" stroke="#99A1AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  )
}
