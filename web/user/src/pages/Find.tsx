import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MobileHeader from '../components/MobileHeader'
import InputField from '../components/InputField'
import PrimaryButton, { OutlineButton } from '../components/PrimaryButton'

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
  const [timer, setTimer] = useState(0)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)

  // 이메일 탭 상태
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!phoneSent || timer <= 0) return
    const id = setInterval(() => setTimer((t) => t - 1), 1000)
    return () => clearInterval(id)
  }, [phoneSent, timer])

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  const onSendCode = () => {
    if (!/^\d{10,11}$/.test(phone)) {
      setPhoneError("'-' 없이 숫자만 입력해주세요.")
      return
    }
    setPhoneError(null)
    // TODO: 인증번호 전송 API
    setPhoneSent(true)
    setTimer(180)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return

    if (tab === 'phone') {
      if (!phoneSent) {
        setPhoneError('인증번호를 전송해주세요.')
        return
      }
      if (phoneCode.length !== 6) {
        setCodeError('인증번호 6자리를 입력해주세요.')
        return
      }
      setCodeError(null)
    } else {
      if (!email.includes('@')) {
        setEmailError('올바른 이메일 형식이 아닙니다.')
        return
      }
      setEmailError(null)
    }

    setSubmitting(true)
    try {
      // TODO: 찾기 API
      await new Promise((r) => setTimeout(r, 600))
      navigate('/find/complete', { replace: true, state: { method: tab } })
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit =
    tab === 'phone' ? phoneSent && phoneCode.length === 6 : email.includes('@')

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

        <form onSubmit={onSubmit} className="flex-1 flex flex-col mt-6">
          {tab === 'phone' ? (
            <>
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
                <OutlineButton type="button" onClick={onSendCode}>
                  {phoneSent ? '재전송' : '인증번호 전송'}
                </OutlineButton>
              </div>
              {phoneError && <p className="text-[13px] text-[#FF6467] mt-1.5 ml-2">{phoneError}</p>}

              {phoneSent && (
                <>
                  <div className="flex items-end justify-between mt-4 mb-1.5">
                    <FieldLabel required className="mb-0">
                      인증번호
                    </FieldLabel>
                    <span className="text-[13px] text-[#FF6467] font-medium">{fmt(timer)}</span>
                  </div>
                  <InputField
                    value={phoneCode}
                    onChange={(v) => setPhoneCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
                    placeholder="인증번호 6자리를 입력해주세요."
                    error={!!codeError}
                    rightPadding="sm"
                  />
                  {codeError && <p className="text-[13px] text-[#FF6467] mt-1.5 ml-2">{codeError}</p>}
                </>
              )}
            </>
          ) : (
            <>
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
              {emailError && <p className="text-[13px] text-[#FF6467] mt-1.5 ml-2">{emailError}</p>}
            </>
          )}

          {/* 하단 고정 버튼 */}
          <div className="mt-auto pt-8 pb-8">
            <PrimaryButton type="submit" loading={submitting} disabled={!canSubmit}>
              요청하기
            </PrimaryButton>
          </div>
        </form>
      </main>
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
        selected ? 'text-[#8259F5] font-semibold' : 'text-[#99A1AF] font-medium'
      }`}
    >
      {children}
      {selected && <span className="absolute left-0 right-0 bottom-[-1px] h-0.5 bg-[#8259F5]" />}
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
