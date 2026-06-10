import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MobileHeader from '../components/MobileHeader'
import InputField from '../components/InputField'
import PrimaryButton, { OutlineButton } from '../components/PrimaryButton'
import EmailDomainChips from '../components/EmailDomainChips'
import AlertModal from '../components/AlertModal'
import { ApiError, smsApi, authApi } from '../lib/api'

type Tab = 'phone' | 'email'

/**
 * 아이디/비밀번호 찾기 — Figma node 16:44737 (휴대폰), 16:46028 (이메일)
 * 한 페이지 두 탭(휴대폰으로 찾기 / 이메일로 찾기).
 * 휴대폰 탭: 번호 + 인증번호 전송 → 인증번호 입력 → 요청하기
 * 이메일 탭: 이메일 → 요청하기
 */
export default function Find() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('phone')

  // 휴대폰 탭 상태
  const [phone, setPhone] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [phoneSent, setPhoneSent] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [timer, setTimer] = useState(0)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  // 인증 후 새 비밀번호 설정 상태 (휴대폰 탭)
  const [newPw, setNewPw] = useState('')
  const [newPwConfirm, setNewPwConfirm] = useState('')
  const [showNewPw, setShowNewPw] = useState(false)
  const [showNewPwConfirm, setShowNewPwConfirm] = useState(false)
  const [newPwError, setNewPwError] = useState<string | null>(null)

  // 이메일 탭 상태
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [sending, setSending] = useState(false)

  // 알림 모달 — alert() 대체
  const [alertState, setAlertState] = useState<
    { message: string; onConfirm?: () => void } | null
  >(null)
  const showAlert = (message: string, onConfirm?: () => void) =>
    setAlertState({ message, onConfirm })
  const closeAlert = () => {
    const cb = alertState?.onConfirm
    setAlertState(null)
    if (cb) cb()
  }

  useEffect(() => {
    if (!phoneSent || phoneVerified || timer <= 0) return
    const id = setInterval(() => setTimer((t) => t - 1), 1000)
    return () => clearInterval(id)
  }, [phoneSent, phoneVerified, timer])

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  const onVerifyCode = async () => {
    if (phoneCode.length < 4) {
      setCodeError('인증번호를 입력해주세요.')
      return
    }
    if (verifying) return
    setVerifying(true)
    try {
      await smsApi.verify(phone, phoneCode)
      setPhoneVerified(true)
      setCodeError(null)
      showAlert('휴대폰 인증이 완료되었습니다.')
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : '인증번호 확인에 실패했습니다.'
      setCodeError(msg)
      showAlert(msg)
    } finally {
      setVerifying(false)
    }
  }

  const onSendCode = async () => {
    // sample 정책: ^01[0-9]{8,9}$
    if (!/^01[0-9]{8,9}$/.test(phone)) {
      setPhoneError('휴대폰번호를 올바르게 입력해 주십시오.')
      return
    }
    if (sending) return
    setPhoneError(null)
    setCodeError(null)
    setSending(true)
    setPhoneVerified(false)
    setPhoneCode('')
    try {
      await smsApi.send(phone)
      setPhoneSent(true)
      setTimer(180)
      showAlert('인증번호가 발송되었습니다.\n카카오톡을 확인해주세요.')
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : '인증번호 발송에 실패했습니다.'
      setPhoneError(msg)
    } finally {
      setSending(false)
    }
  }

  const onResetPassword = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setNewPwError(null)
    if (!newPw) { setNewPwError('새 비밀번호를 입력해주세요.'); return }
    if (newPw.length < 8 || newPw.length > 20) { setNewPwError('비밀번호는 8~20자여야 합니다.'); return }
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(newPw)) { setNewPwError('영문과 숫자를 각각 1개 이상 포함해야 합니다.'); return }
    if (newPw !== newPwConfirm) { setNewPwError('비밀번호가 일치하지 않습니다.'); return }
    setSubmitting(true)
    try {
      await authApi.resetPasswordByPhone(phone, newPw)
      navigate('/find/complete', { replace: true, state: { method: 'phone' } })
    } catch (e) {
      setNewPwError(e instanceof ApiError ? e.message : '비밀번호 변경에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!email.includes('@')) {
      setEmailError('올바른 이메일 형식이 아닙니다.')
      return
    }
    setEmailError(null)
    setSubmitting(true)
    try {
      await authApi.findByEmail(email)
      navigate('/find/complete', { replace: true, state: { method: 'email' } })
    } catch (e) {
      setEmailError(e instanceof ApiError ? e.message : '요청에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = email.includes('@')

  return (
    <div className="mobile-frame flex flex-col">
      <MobileHeader title="아이디/비밀번호 찾기" />

      <main className="flex-1 flex flex-col px-4">
        {/* 탭 헤더 */}
        <div className="flex border-b border-[#e5e7eb]">
          <TabButton selected={tab === 'phone'} onClick={() => setTab('phone')}>
            휴대폰으로 찾기
          </TabButton>
          <TabButton selected={tab === 'email'} onClick={() => setTab('email')}>
            이메일로 찾기
          </TabButton>
        </div>

        {/* 안내문 */}
        <div className="pt-6">
          {tab === 'phone' ? (
            <>
              <p className="text-[18px] font-bold text-[#1E2939] leading-snug">
                회원가입 시 등록하신
                <br />
                핸드폰 번호를 입력해주세요.
              </p>
              <p className="text-[13px] text-[#4a5565] mt-3 leading-relaxed">
                인증번호 확인 후 해당 번호로 아이디와
                <br />
                변경된 비밀번호 정보를 보내드립니다.
              </p>
            </>
          ) : (
            <>
              <p className="text-[18px] font-bold text-[#1E2939] leading-snug">
                회원가입 시 등록하신
                <br />
                이메일 주소를 입력해주세요.
              </p>
              <p className="text-[13px] text-[#4a5565] mt-3 leading-relaxed">
                해당 이메일로 아이디와
                <br />
                변경된 비밀번호 정보를 보내드립니다.
              </p>
            </>
          )}
        </div>

        {/* 휴대폰 탭 — 인증 전: 폰 + 인증번호 입력 / 인증 후: 새 비밀번호 설정 */}
        {tab === 'phone' && !phoneVerified && (
          <div className="flex-1 flex flex-col mt-6">
            <FieldLabel required>휴대폰번호</FieldLabel>
            <div className="flex gap-2">
              <div className="flex-1">
                <InputField
                  type="tel"
                  value={phone}
                  onChange={(v) => setPhone(v.replace(/[^0-9]/g, ''))}
                  placeholder="'-' 없이 숫자만 입력해주세요."
                  error={!!phoneError}
                  rightPadding="sm"
                  autoComplete="tel"
                  disabled={phoneSent && timer > 0}
                />
              </div>
              <OutlineButton type="button" onClick={onSendCode} disabled={sending}>
                {sending ? '전송 중...' : phoneSent ? '재전송' : '인증번호 전송'}
              </OutlineButton>
            </div>
            {phoneError && <p className="text-[13px] text-[#FF6467] mt-1.5 ml-2">{phoneError}</p>}
            {!phoneSent && !phoneError && (
              <p className="mt-1.5 ml-1 text-[12px] text-[#6A7282]">
                💬 인증번호는 <span className="font-semibold text-[#1E2939]">카카오톡</span>으로 발송됩니다. 카카오톡 알림이 안 오면 잠시 후 다시 시도해 주세요.
              </p>
            )}
            {phoneSent && (
              <>
                <div className="flex items-end justify-between mt-4 mb-1.5">
                  <FieldLabel required className="mb-0">인증번호</FieldLabel>
                  <span className="text-[13px] text-[#FF6467] font-medium">{fmt(timer)}</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <InputField
                      value={phoneCode}
                      onChange={(v) => setPhoneCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
                      placeholder="인증번호 6자리를 입력해주세요."
                      error={!!codeError}
                      rightPadding="sm"
                      maxLength={6}
                      inputMode="numeric"
                    />
                  </div>
                  <OutlineButton type="button" onClick={onVerifyCode} disabled={verifying}>
                    {verifying ? '확인 중...' : '인증하기'}
                  </OutlineButton>
                </div>
                {codeError && (
                  <p className="text-[13px] text-[#FF6467] mt-1.5 ml-2">{codeError}</p>
                )}
              </>
            )}
          </div>
        )}

        {/* 휴대폰 인증 완료 후: 새 비밀번호 직접 설정 */}
        {tab === 'phone' && phoneVerified && (
          <form onSubmit={onResetPassword} className="flex-1 flex flex-col mt-6">
            <p className="text-[13px] text-[#10b981] mb-5">✓ 휴대폰 인증이 완료되었습니다. 새 비밀번호를 설정해주세요.</p>

            <FieldLabel required>새 비밀번호</FieldLabel>
            <PasswordInput
              value={newPw}
              onChange={(v) => { setNewPw(v); setNewPwError(null) }}
              placeholder="새 비밀번호를 입력해주세요."
              visible={showNewPw}
              onToggle={() => setShowNewPw((v) => !v)}
            />
            <p className="text-[12px] text-gray-400 mt-1 mb-4">영문+숫자 혼합 8~20자</p>

            <FieldLabel required>새 비밀번호 확인</FieldLabel>
            <PasswordInput
              value={newPwConfirm}
              onChange={(v) => { setNewPwConfirm(v); setNewPwError(null) }}
              placeholder="새 비밀번호를 한번 더 입력해주세요."
              visible={showNewPwConfirm}
              onToggle={() => setShowNewPwConfirm((v) => !v)}
            />
            {newPw && newPwConfirm && newPw !== newPwConfirm && (
              <p className="text-[13px] text-[#FF6467] mt-1">비밀번호가 일치하지 않습니다.</p>
            )}

            {newPwError && <p className="text-[13px] text-[#FF6467] mt-2">{newPwError}</p>}

            <div className="mt-auto pt-8 pb-8">
              <PrimaryButton
                type="submit"
                loading={submitting}
                disabled={!newPw || !newPwConfirm || newPw !== newPwConfirm}
              >
                비밀번호 변경
              </PrimaryButton>
            </div>
          </form>
        )}

        {/* 이메일 탭 */}
        {tab === 'email' && (
          <form onSubmit={onSubmit} className="flex-1 flex flex-col mt-6">
            <FieldLabel required>이메일</FieldLabel>
            <InputField
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="이메일 주소를 입력해주세요."
              error={!!emailError}
              onClear={() => setEmail('')}
              autoComplete="email"
            />
            <EmailDomainChips value={email} onChange={setEmail} />
            {emailError && <p className="text-[13px] text-[#FF6467] mt-1.5 ml-2">{emailError}</p>}
            <div className="mt-auto pt-8 pb-8">
              <PrimaryButton type="submit" loading={submitting} disabled={!canSubmit}>
                요청하기
              </PrimaryButton>
            </div>
          </form>
        )}
      </main>

      <AlertModal
        open={!!alertState}
        message={alertState?.message ?? ''}
        onClose={closeAlert}
      />
    </div>
  )
}

/* ───────────── 서브 ───────────── */

function TabButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 h-12 text-[15px] transition relative ${
        selected ? 'text-[#ec4899] font-semibold' : 'text-[#99A1AF] font-medium'
      }`}
    >
      {children}
      {selected && <span className="absolute left-0 right-0 bottom-[-1px] h-0.5 bg-[#ec4899]" />}
    </button>
  )
}

function FieldLabel({
  required,
  className = '',
  children,
}: {
  required?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={`text-[14px] font-semibold text-[#1E2939] mb-1.5 ${className}`}>
      {children}
      {required && <span className="text-[#FF6467]"> *</span>}
    </label>
  )
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  visible,
  onToggle,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  visible: boolean
  onToggle: () => void
}) {
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-[50px] px-4 pr-12 rounded-xl border border-[#e5e7eb] text-[15px] text-[#1E2939] placeholder-[#9CA3AF] outline-none focus:border-[#ec4899] focus:ring-2 focus:ring-[#ec4899]/20 bg-white"
        autoComplete="new-password"
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center"
      >
        <img
          src={visible ? '/img/ic_input_eye.svg' : '/img/ic_input_eye_closed.svg'}
          alt=""
          className="w-6 h-6"
        />
      </button>
    </div>
  )
}
